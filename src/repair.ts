/**
 * One-shot session-log repair: physically REMOVE legacy `ya-subagent/started`
 * event rows so the harness persistence read path (`assertEventsSupported`)
 * loads the log again.
 *
 * Background: plugin versions ≤0.1.2 appended `ya-subagent/started` via
 * `session.append(...)`. `KNOWN_SESSION_EVENT_TYPES` is code-generated with no
 * plugin registration surface, and v0.1.2-alpha.1 refuses EVERY log row whose
 * type is outside that set — the old `ignorable` envelope flag no longer
 * exists, so stamping it (the ≤0.1.5 repair) cannot help. The only repair is
 * removal.
 *
 * Rows cannot simply be deleted: the read path enforces contiguous `seq`
 * numbers. This module therefore rewrites the log in place (after a `.bak`
 * backup):
 *
 *   - drops every `ya-subagent/started` row;
 *   - decrements the `seq` of every later ordinary event row (packed
 *     `text-chunks` / `reasoning-chunks` / `tool-call-chunks` storage rows
 *     shift their `seq0` instead);
 *   - shifts every `sourceEventSeqs` citation by the number of dropped rows
 *     ahead of it (dropped rows are never cited: only surface events carry
 *     provenance and they cite assistant chunks / surface nodes, which a
 *     plugin row never is).
 *
 * Two physical encodings (mirrors `session-persistence-jsonl`):
 *   - `.jsonl`        — plaintext, one JSON record per line.
 *   - `.jsonl.zstd`   — concatenated independent Zstandard frames: the first
 *                       frame holds the session header line, subsequent
 *                       frames each hold one append batch of event lines.
 *                       Each frame is independently decodable + checksummed.
 *                       The first frame containing a dropped row and every
 *                       frame after it are recompressed (their rows renumber);
 *                       untouched earlier frames are copied verbatim.
 *
 * Modified rows are re-encoded with `JSON.stringify`, which reproduces the
 * write path's canonical single-line form and preserves the parsed key order;
 * untouched lines stay byte-identical.
 *
 * Idempotent: a log with no target rows is left untouched (no backup, no
 * rewrite). A corrupt (unparsable) line is left untouched — that is the
 * harness's refusal job, not ours.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/repair
 */

import { constants, zstdCompressSync, zstdDecompressSync } from 'node:zlib'
import { readFile, writeFile, readdir, stat, copyFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The event type this module targets. */
const TARGET_TYPE = 'ya-subagent/started'

/** Packed chunk-run storage row tags (their span start rides `seq0`). */
const CHUNK_ROW_TYPES = new Set(['text-chunks', 'reasoning-chunks', 'tool-call-chunks'])

/** Zstandard magic number (little-endian 0xFD2FB528). */
const ZSTD_MAGIC = 0xFD2FB528

/** Compression options matching the harness's `CHECKSUM_OPTIONS`. */
const CHECKSUM_OPTIONS = { params: { [constants.ZSTD_c_checksumFlag]: 1 } }

/** Aggregate result of one repair run. */
export interface RepairStats {
  /** Session log files examined (`.jsonl` + `.jsonl.zstd`). */
  readonly scanned: number
  /** Files rewritten because at least one target row was removed. */
  readonly repaired: number
  /** Files with no target rows (already clean). */
  readonly skipped: number
  /** Per-file errors (path + message); empty on a clean run. */
  readonly errors: readonly { readonly path: string; readonly message: string }[]
}

/** Per-file outcome used internally before aggregation. */
type FileOutcome =
  | { kind: 'clean' }
  | { kind: 'repaired'; bytes: Buffer }
  | { kind: 'error'; message: string }

/**
 * Recursively repair every session log under `sessionsRoot`.
 *
 * @param sessionsRoot - absolute path to `$DSH_HOME/sessions`.
 * @returns aggregate stats. Never throws — per-file failures land in `errors`.
 */
export async function repairSessions(sessionsRoot: string): Promise<RepairStats> {
  const errors: { path: string; message: string }[] = []
  let scanned = 0
  let repaired = 0
  let skipped = 0

  const visit = async (dir: string): Promise<void> => {
    let entries: string[]
    try {
      entries = await readdir(dir)
    } catch (err) {
      errors.push({ path: dir, message: errorMessage(err) })
      return
    }
    await Promise.all(entries.map(async (name) => {
      const path = join(dir, name)
      let isDir: boolean
      let isFile: boolean
      try {
        const info = await stat(path)
        isDir = info.isDirectory()
        isFile = info.isFile()
      } catch (err) {
        errors.push({ path, message: `stat failed: ${errorMessage(err)}` })
        return
      }
      if (isDir) {
        await visit(path)
        return
      }
      if (!isFile) return
      const isJsonl = name.endsWith('.jsonl')
      const isZstd = name.endsWith('.jsonl.zstd')
      if (!isJsonl && !isZstd) return
      scanned += 1
      try {
        const outcome = isJsonl
          ? await repairPlaintextFile(path)
          : await repairZstdFile(path)
        if (outcome.kind === 'repaired') {
          await writeFile(path, outcome.bytes)
          repaired += 1
        } else if (outcome.kind === 'clean') {
          skipped += 1
        }
      } catch (err) {
        errors.push({ path, message: errorMessage(err) })
      }
    }))
  }

  try {
    await visit(sessionsRoot)
  } catch (err) {
    errors.push({ path: sessionsRoot, message: errorMessage(err) })
  }

  return { scanned, repaired, skipped, errors }
}

/**
 * Repair one `.jsonl` plaintext file. Backs up to `.bak` first if a repair is
 * needed and no backup exists yet.
 */
async function repairPlaintextFile(path: string): Promise<FileOutcome> {
  const raw = await readFile(path, 'utf8')
  const lines = stripLegacyRows(raw, [])
  if (lines === raw) return { kind: 'clean' }
  await ensureBackup(path)
  return { kind: 'repaired', bytes: Buffer.from(lines, 'utf8') }
}

/**
 * Repair one `.jsonl.zstd` concatenated-frame file. The header frame is
 * decoded but never carries event rows; once a dropped row is found, that
 * frame and every later frame are renumbered and recompressed (later rows'
 * seqs shift even when their own text is otherwise unchanged). Frames before
 * the first change are copied verbatim.
 */
async function repairZstdFile(path: string): Promise<FileOutcome> {
  const buffer = await readFile(path)
  const frames = scanZstdFrames(buffer)
  if (frames.length === 0) return { kind: 'clean' }

  const rebuilt: Buffer[] = []
  const droppedSeqs: number[] = []
  let changed = false
  for (const frame of frames) {
    const frameBytes = buffer.subarray(frame.start, frame.end)
    const plaintext = zstdDecompressSync(frameBytes).toString('utf8')
    const lines = stripLegacyRows(plaintext, droppedSeqs)
    if (lines !== plaintext) {
      changed = true
      rebuilt.push(zstdCompressSync(Buffer.from(lines, 'utf8'), CHECKSUM_OPTIONS))
    } else {
      // Copy verbatim: re-encoding an unchanged frame would still produce a
      // valid log, but preserving bytes avoids needless checksum churn.
      rebuilt.push(Buffer.from(frameBytes))
    }
  }
  if (!changed) return { kind: 'clean' }
  await ensureBackup(path)
  return { kind: 'repaired', bytes: Buffer.concat(rebuilt) }
}

/**
 * Strip every `ya-subagent/started` row from JSONL text and renumber the
 * surviving rows so the read path's contiguity check still passes. The
 * dropped-seq accumulator is shared across calls (zstd frames of one file are
 * transformed sequentially) so later frames renumber against earlier drops.
 * Returns the new text, or the input reference when nothing changed.
 */
function stripLegacyRows(text: string, droppedSeqs: number[]): string {
  const source = text.split('\n')
  const kept: string[] = []
  let changed = false
  for (const line of source) {
    if (line === '') {
      // Preserve the trailing newline (the final empty segment) verbatim.
      kept.push(line)
      continue
    }
    const rewritten = rewriteLine(line, droppedSeqs)
    if (rewritten === undefined) {
      // Target row: dropped (its seq is already recorded in droppedSeqs).
      changed = true
      continue
    }
    if (rewritten !== line) changed = true
    kept.push(rewritten)
  }
  return changed ? kept.join('\n') : text
}

/**
 * Rewrite one JSONL line under the current dropped-seq prefix.
 * @returns the (possibly original) line text, or `undefined` when the line is
 * a dropped target row.
 */
function rewriteLine(line: string, droppedSeqs: number[]): string | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return line
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return line
  const record = parsed as Record<string, unknown>

  if (record['type'] === TARGET_TYPE && typeof record['seq'] === 'number') {
    droppedSeqs.push(record['seq'])
    return undefined
  }

  // Count dropped rows strictly before a seq: lines (and citations) are
  // visited in ascending seq order, but a citation may point before or after
  // individual dropped rows, so each value is shifted independently.
  const shiftOf = (seq: number): number => {
    let shift = 0
    for (const dropped of droppedSeqs) {
      if (dropped < seq) shift += 1
    }
    return shift
  }

  let modified = false

  if (CHUNK_ROW_TYPES.has(String(record['type'])) && typeof record['seq0'] === 'number') {
    const seq0 = record['seq0']
    const shifted = seq0 - shiftOf(seq0)
    if (shifted !== seq0) {
      record['seq0'] = shifted
      modified = true
    }
  } else if (typeof record['seq'] === 'number') {
    const seq = record['seq']
    const shifted = seq - shiftOf(seq)
    if (shifted !== seq) {
      record['seq'] = shifted
      modified = true
    }
  }

  if (Array.isArray(record['sourceEventSeqs'])) {
    const shiftedEntries: unknown[] = []
    let provenanceModified = false
    for (const entry of record['sourceEventSeqs']) {
      if (typeof entry === 'number') {
        const shifted = entry - shiftOf(entry)
        if (shifted !== entry) provenanceModified = true
        shiftedEntries.push(shifted)
      } else if (Array.isArray(entry) && entry.length === 2
        && typeof entry[0] === 'number' && typeof entry[1] === 'number') {
        const start = entry[0] - shiftOf(entry[0])
        const end = entry[1] - shiftOf(entry[1])
        if (start !== entry[0] || end !== entry[1]) provenanceModified = true
        shiftedEntries.push([start, end])
      } else {
        // Malformed provenance: leave the whole array untouched.
        shiftedEntries.length = 0
        provenanceModified = false
        break
      }
    }
    if (provenanceModified) {
      record['sourceEventSeqs'] = shiftedEntries
      modified = true
    }
  }

  return modified ? JSON.stringify(record) : line
}

/** Byte range of one complete Zstandard frame. */
interface ZstdFrameRange {
  start: number
  end: number
}

/**
 * Locate complete Zstandard frames in a concatenated stream. A structurally
 * incomplete final frame (torn tail from a concurrent writer) is skipped —
 * repairing it would risk data loss, and the harness treats it as a torn tail
 * too. Mirrors `scanZstdFrames` in `session-persistence-jsonl/src/zstd.ts`.
 */
function scanZstdFrames(buffer: Buffer): ZstdFrameRange[] {
  const frames: ZstdFrameRange[] = []
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break
    offset += 4
    if (offset === buffer.length) break
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    if ((descriptor & 0x18) !== 0) break
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0
      ? (singleSegment ? 1 : 0)
      : 1 << contentSizeFlag
    const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    if (buffer.length - offset < remainingHeaderBytes) break
    offset += remainingHeaderBytes
    let lastBlock = false
    while (!lastBlock) {
      if (buffer.length - offset < 3) { offset = start; break }
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 0x03
      const blockSize = blockHeader >>> 3
      if (blockType === 0x03) { offset = start; break }
      const payloadBytes = blockType === 0x01 ? 1 : blockSize
      if (buffer.length - offset < payloadBytes) { offset = start; break }
      offset += payloadBytes
    }
    if (offset === start) break
    if (checksum) {
      if (buffer.length - offset < 4) { offset = start; break }
      offset += 4
    }
    frames.push({ start, end: offset })
  }
  return frames
}

/**
 * Copy `path` to `path.bak` if no backup exists yet. A concurrent repair run
 * leaves the original backup in place; a pre-existing `.bak` from another tool
 * is also preserved.
 */
async function ensureBackup(path: string): Promise<void> {
  const backup = `${path}.bak`
  try {
    await stat(backup)
    return
  } catch {
    // No existing backup — proceed to create one.
  }
  await copyFile(path, backup)
}

/** Extract a human-readable message from an unknown error. */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
