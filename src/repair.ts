/**
 * One-shot session-log repair: stamp `"ignorable": true` onto legacy
 * `ya-subagent/started` events so the harness persistence read path
 * (`assertEventsSupported`) will skip them instead of refusing the whole log.
 *
 * Background: older plugin versions wrote `ya-subagent/started` via
 * `session.append(...)`, but `session.append` cannot set the `ignorable`
 * envelope flag, and `KNOWN_SESSION_EVENT_TYPES` is code-generated with no
 * plugin registration surface. The read path therefore refuses any log
 * containing the type unless each occurrence carries `ignorable: true`.
 * This module rewrites on-disk artifacts in place (after a `.bak` backup) to
 * add that flag to every `ya-subagent/started` row missing it.
 *
 * Two physical encodings (mirrors `session-persistence-jsonl`):
 *   - `.jsonl`        — plaintext, one JSON record per line.
 *   - `.jsonl.zstd`   — concatenated independent Zstandard frames: the first
 *                       frame holds the session header line, subsequent
 *                       frames each hold one append batch of event lines.
 *                       Each frame is independently decodable + checksummed.
 *                       Only frames whose decoded plaintext contains a target
 *                       row are recompressed; untouched frames are copied
 *                       verbatim so byte-identity is preserved where possible.
 *
 * Idempotent: rows already carrying `ignorable: true` are skipped; files with
 * no target rows are left untouched (no backup, no rewrite).
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/repair
 */

import { constants, zstdCompressSync, zstdDecompressSync } from 'node:zlib'
import { readFile, writeFile, readdir, stat, copyFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The event type this module targets. */
const TARGET_TYPE = 'ya-subagent/started'

/** Zstandard magic number (little-endian 0xFD2FB528). */
const ZSTD_MAGIC = 0xFD2FB528

/** Compression options matching the harness's `CHECKSUM_OPTIONS`. */
const CHECKSUM_OPTIONS = { params: { [constants.ZSTD_c_checksumFlag]: 1 } }

/** Aggregate result of one repair run. */
export interface RepairStats {
  /** Session log files examined (`.jsonl` + `.jsonl.zstd`). */
  readonly scanned: number
  /** Files rewritten because at least one target row was patched. */
  readonly repaired: number
  /** Files with no patchable rows (already clean or no target events). */
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
  const { lines, changed } = patchPlaintextLines(raw)
  if (!changed) return { kind: 'clean' }
  await ensureBackup(path)
  return { kind: 'repaired', bytes: Buffer.from(lines, 'utf8') }
}

/**
 * Repair one `.jsonl.zstd` concatenated-frame file. The header frame is
 * decoded to check for a target row (current harness writes the header as its
 * own frame, so a target there is theoretically possible but unlikely); event
 * frames are decoded and patched individually. Only frames with a patch are
 * recompressed; untouched frames are copied verbatim.
 */
async function repairZstdFile(path: string): Promise<FileOutcome> {
  const buffer = await readFile(path)
  const frames = scanZstdFrames(buffer)
  if (frames.length === 0) return { kind: 'clean' }

  const rebuilt: Buffer[] = []
  let changed = false
  for (const frame of frames) {
    const frameBytes = buffer.subarray(frame.start, frame.end)
    const plaintext = zstdDecompressSync(frameBytes).toString('utf8')
    const { lines, changed: frameChanged } = patchPlaintextLines(plaintext)
    if (frameChanged) {
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
 * Patch every `ya-subagent/started` line missing `ignorable` by inserting
 * `"ignorable":true` into the JSON object. Returns the new text and whether
 * any line changed. Lines that fail to parse as JSON are left untouched
 * (a corrupt line is the harness's refusal job, not ours).
 */
function patchPlaintextLines(text: string): { lines: string; changed: boolean } {
  const lines = text.split('\n')
  let changed = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === '') continue
    if (!line.includes(TARGET_TYPE)) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }
    if (typeof parsed !== 'object' || parsed === null) continue
    const record = parsed as Record<string, unknown>
    if (record['type'] !== TARGET_TYPE) continue
    if (record['ignorable'] === true) continue
    // Insert `ignorable` before the closing brace, preserving key order as
    // closely as possible. JSON.stringify would re-sort/re-format the whole
    // record; a surgical string edit keeps the rest of the line byte-stable.
    const trimmed = line.trimEnd()
    if (trimmed.endsWith('}')) {
      lines[i] = trimmed.slice(0, -1) + ',"ignorable":true}'
      changed = true
    }
  }
  return { lines: lines.join('\n'), changed }
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
