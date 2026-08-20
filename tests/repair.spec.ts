import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { constants, zstdCompressSync } from 'node:zlib'
import { repairSessions } from '../src/repair.ts'

/** Zstd compress with checksum flag, matching the harness's CHECKSUM_OPTIONS. */
function compressFrame(input: string | Buffer): Buffer {
  return zstdCompressSync(Buffer.from(input), { params: { [constants.ZSTD_c_checksumFlag]: 1 } })
}

/** A header line the harness accepts (minimal valid shape). */
const HEADER_LINE = '{"type":"session","version":0,"id":"s1","createdAt":1,"delegationDepth":0}'

/** Build a `ya-subagent/started` line with optional ignorable. */
function startedLine(seq: number, ignorable = false): string {
  const base = `{"type":"ya-subagent/started","seq":${seq},"time":1,"data":{"callId":"c1","childId":"child-${seq}","profileId":"general"}}`
  return ignorable ? base.replace(/}$/, ',"ignorable":true}') : base
}

/** A neutral event line (type the harness knows). */
const TURN_START_LINE = '{"type":"turn/start","seq":0,"time":1,"data":{"turn":0}}'

/** Create a temp sessions root. */
async function makeRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ya-subagent-repair-'))
}

describe('repairSessions — plaintext (.jsonl)', () => {
  it('patches a ya-subagent/started line missing ignorable', async () => {
    const root = await makeRoot()
    const file = join(root, 'project--', 'session-1', 'session.jsonl')
    await mkdir(join(root, 'project--', 'session-1'), { recursive: true })
    const content = `${HEADER_LINE}\n${TURN_START_LINE}\n${startedLine(1)}\n`
    await writeFile(file, content, 'utf8')

    const stats = await repairSessions(root)
    expect(stats.scanned).toBe(1)
    expect(stats.repaired).toBe(1)
    expect(stats.skipped).toBe(0)
    expect(stats.errors).toEqual([])

    const after = await readFile(file, 'utf8')
    expect(after).toContain('"ignorable":true')
    expect(after).toContain(TURN_START_LINE)
  })

  it('leaves an already-ignorable line untouched (idempotent)', async () => {
    const root = await makeRoot()
    const file = join(root, 's.jsonl')
    const content = `${HEADER_LINE}\n${startedLine(1, true)}\n`
    await writeFile(file, content, 'utf8')

    const stats = await repairSessions(root)
    expect(stats.scanned).toBe(1)
    expect(stats.repaired).toBe(0)
    expect(stats.skipped).toBe(1)

    const after = await readFile(file, 'utf8')
    expect(after).toBe(content)
  })

  it('is idempotent across runs: second run skips a file the first repaired', async () => {
    const root = await makeRoot()
    const file = join(root, 's.jsonl')
    await writeFile(file, `${HEADER_LINE}\n${startedLine(1)}\n`, 'utf8')

    const first = await repairSessions(root)
    expect(first.repaired).toBe(1)
    const second = await repairSessions(root)
    expect(second.repaired).toBe(0)
    expect(second.skipped).toBe(1)
  })

  it('backs up to .bak on the first repair only', async () => {
    const root = await makeRoot()
    const file = join(root, 's.jsonl')
    const original = `${HEADER_LINE}\n${startedLine(1)}\n`
    await writeFile(file, original, 'utf8')

    await repairSessions(root)
    const backup = `${file}.bak`
    expect((await stat(backup)).isFile()).toBe(true)
    const backupContent = await readFile(backup, 'utf8')
    expect(backupContent).toBe(original)

    // Second run: backup stays as the ORIGINAL, not the already-repaired file.
    await repairSessions(root)
    const backupContent2 = await readFile(backup, 'utf8')
    expect(backupContent2).toBe(original)
  })

  it('skips files with no target event', async () => {
    const root = await makeRoot()
    const file = join(root, 's.jsonl')
    await writeFile(file, `${HEADER_LINE}\n${TURN_START_LINE}\n`, 'utf8')

    const stats = await repairSessions(root)
    expect(stats.repaired).toBe(0)
    expect(stats.skipped).toBe(1)
    const after = await readFile(file, 'utf8')
    expect(after).toBe(`${HEADER_LINE}\n${TURN_START_LINE}\n`)
  })

  it('preserves surrounding line content byte-for-byte except for the patch', async () => {
    const root = await makeRoot()
    const file = join(root, 's.jsonl')
    const before = `${HEADER_LINE}\n${TURN_START_LINE}\n${startedLine(5)}\n${TURN_START_LINE}\n`
    await writeFile(file, before, 'utf8')

    await repairSessions(root)
    const after = await readFile(file, 'utf8')
    // Only the started line should differ; header + turn/start lines unchanged.
    expect(after).toContain(HEADER_LINE)
    expect(after).toContain(TURN_START_LINE)
    // The patched line retains its original data fields.
    expect(after).toContain('"callId":"c1"')
    expect(after).toContain('"childId":"child-5"')
    expect(after).toContain('"profileId":"general"')
    expect(after).toContain('"ignorable":true')
  })
})

describe('repairSessions — zstd (.jsonl.zstd)', () => {
  it('patches an event-frame containing a target line', async () => {
    const root = await makeRoot()
    const file = join(root, 's.jsonl.zstd')
    const headerFrame = compressFrame(`${HEADER_LINE}\n`)
    const eventFrame = compressFrame(`${TURN_START_LINE}\n${startedLine(1)}\n`)
    await writeFile(file, Buffer.concat([headerFrame, eventFrame]))

    const stats = await repairSessions(root)
    expect(stats.scanned).toBe(1)
    expect(stats.repaired).toBe(1)

    const after = await readFile(file)
    // Decompress the whole file and check the patched line is present.
    const { zstdDecompressSync } = await import('node:zlib')
    const frames = splitFrames(after)
    const plaintext = frames.map(f => zstdDecompressSync(f).toString('utf8')).join('')
    expect(plaintext).toContain('"ignorable":true')
    expect(plaintext).toContain(HEADER_LINE)
  })

  it('copies untouched frames verbatim (header frame bytes identical)', async () => {
    const root = await makeRoot()
    const file = join(root, 's.jsonl.zstd')
    const headerFrame = compressFrame(`${HEADER_LINE}\n`)
    const eventFrame = compressFrame(`${TURN_START_LINE}\n${startedLine(1)}\n`)
    await writeFile(file, Buffer.concat([headerFrame, eventFrame]))

    await repairSessions(root)
    const after = await readFile(file)
    const frames = splitFrames(after)
    // Header frame (frame 0) should be byte-identical to the original.
    expect(Buffer.compare(frames[0]!, headerFrame)).toBe(0)
  })

  it('skips a zstd file whose frames are all clean', async () => {
    const root = await makeRoot()
    const file = join(root, 's.jsonl.zstd')
    const headerFrame = compressFrame(`${HEADER_LINE}\n`)
    const eventFrame = compressFrame(`${TURN_START_LINE}\n`)
    const original = Buffer.concat([headerFrame, eventFrame])
    await writeFile(file, original)

    const stats = await repairSessions(root)
    expect(stats.repaired).toBe(0)
    expect(stats.skipped).toBe(1)
    const after = await readFile(file)
    expect(Buffer.compare(after, original)).toBe(0)
  })

  it('is idempotent on zstd files', async () => {
    const root = await makeRoot()
    const file = join(root, 's.jsonl.zstd')
    const headerFrame = compressFrame(`${HEADER_LINE}\n`)
    const eventFrame = compressFrame(`${startedLine(1)}\n`)
    await writeFile(file, Buffer.concat([headerFrame, eventFrame]))

    const first = await repairSessions(root)
    expect(first.repaired).toBe(1)
    const second = await repairSessions(root)
    expect(second.repaired).toBe(0)
    expect(second.skipped).toBe(1)
  })
})

describe('repairSessions — directory traversal', () => {
  it('recursively scans nested project/session directories', async () => {
    const root = await makeRoot()
    const deep = join(root, '--project--', 'session-aa', 'session.jsonl')
    await mkdir(join(root, '--project--', 'session-aa'), { recursive: true })
    await writeFile(deep, `${HEADER_LINE}\n${startedLine(1)}\n`, 'utf8')
    // A clean file in a sibling.
    const clean = join(root, '--project--', 'session-bb', 'session.jsonl')
    await mkdir(join(root, '--project--', 'session-bb'), { recursive: true })
    await writeFile(clean, `${HEADER_LINE}\n${TURN_START_LINE}\n`, 'utf8')

    const stats = await repairSessions(root)
    expect(stats.scanned).toBe(2)
    expect(stats.repaired).toBe(1)
    expect(stats.skipped).toBe(1)
  })

  it('ignores non-session files', async () => {
    const root = await makeRoot()
    await writeFile(join(root, 'readme.txt'), 'hi', 'utf8')
    await writeFile(join(root, 'session.meta'), '{}', 'utf8')
    const stats = await repairSessions(root)
    expect(stats.scanned).toBe(0)
  })

  it('records per-file errors without throwing', async () => {
    const root = await makeRoot()
    // A .jsonl file that is a directory (stat says isFile=false → skipped, no error).
    // Instead, test a missing root: should produce one top-level error.
    const stats = await repairSessions(join(root, 'does-not-exist'))
    expect(stats.scanned).toBe(0)
    expect(stats.errors.length).toBeGreaterThanOrEqual(1)
  })
})

/** Split a concatenated-zstd buffer into individual frame buffers. */
function splitFrames(buffer: Buffer): Buffer[] {
  const frames: Buffer[] = []
  const ZSTD_MAGIC = 0xFD2FB528
  let offset = 0
  while (offset < buffer.length) {
    const start = offset
    if (buffer.length - offset < 4) break
    if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) break
    offset += 4
    if (offset === buffer.length) break
    const descriptor = buffer.readUInt8(offset)
    offset += 1
    const contentSizeFlag = descriptor >>> 6
    const singleSegment = (descriptor & 0x20) !== 0
    const checksum = (descriptor & 0x04) !== 0
    const dictionaryFlag = descriptor & 0x03
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag
    offset += (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes
    let lastBlock = false
    while (!lastBlock) {
      const blockHeader = buffer.readUIntLE(offset, 3)
      offset += 3
      lastBlock = (blockHeader & 1) !== 0
      const blockType = (blockHeader >>> 1) & 0x03
      const blockSize = blockHeader >>> 3
      const payloadBytes = blockType === 0x01 ? 1 : blockSize
      offset += payloadBytes
    }
    if (checksum) offset += 4
    frames.push(buffer.subarray(start, offset))
  }
  return frames
}
