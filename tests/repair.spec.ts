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

/** Build a legacy `ya-subagent/started` line at `seq`. */
function startedLine(seq: number): string {
  return `{"type":"ya-subagent/started","seq":${seq},"time":1,"data":{"callId":"c1","childId":"child-${seq}","profileId":"general"}}`
}

/** A neutral event line (type the harness knows). */
const TURN_START_LINE = '{"type":"turn/start","seq":0,"time":1,"data":{"turn":0}}'

/** Event line with an explicit seq, for renumbering assertions. */
function turnStartLine(seq: number): string {
  return `{"type":"turn/start","seq":${seq},"time":1,"data":{"turn":0}}`
}

/** Assistant chunk line (a provenance-citable event). */
function chunkLine(seq: number, text: string): string {
  return `{"type":"assistant/chunk","seq":${seq},"time":1,"data":{"turn":0,"step":0,"chunk":{"type":"text-delta","index":0,"text":"${text}"}}}`
}

/** Assistant message line citing earlier seqs (plain list + encoded range). */
function messageLine(seq: number, provenance: string): string {
  return `{"type":"assistant/message","seq":${seq},"time":2,"sourceEventSeqs":[${provenance}],"data":{"turn":0,"step":0,"message":{"id":"m","role":"assistant","content":[]},"usage":{"inputTokens":1,"outputTokens":1}}}`
}

/** Packed chunk-run storage row covering seq0..seq0+1. */
function packedLine(seq0: number): string {
  return `{"type":"text-chunks","seq0":${seq0},"time0":10,"data":{"turn":0,"step":0,"index":0,"dt":[5],"texts":["a","b"]}}`
}

/** Create a temp sessions root. */
async function makeRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ya-subagent-repair-'))
}

describe('repairSessions — plaintext (.jsonl)', () => {
  it('removes a ya-subagent/started row and renumbers later rows', async () => {
    const root = await makeRoot()
    const file = join(root, 'project--', 'session-1', 'session.jsonl')
    await mkdir(join(root, 'project--', 'session-1'), { recursive: true })
    const content = `${HEADER_LINE}\n${TURN_START_LINE}\n${startedLine(1)}\n${turnStartLine(2)}\n`
    await writeFile(file, content, 'utf8')

    const stats = await repairSessions(root)
    expect(stats.scanned).toBe(1)
    expect(stats.repaired).toBe(1)
    expect(stats.skipped).toBe(0)
    expect(stats.errors).toEqual([])

    const after = await readFile(file, 'utf8')
    expect(after).not.toContain('ya-subagent/started')
    expect(after).toBe(`${HEADER_LINE}\n${TURN_START_LINE}\n${turnStartLine(1)}\n`)
  })

  it('shifts sourceEventSeqs citations (plain entries and encoded ranges)', async () => {
    const root = await makeRoot()
    const file = join(root, 's.jsonl')
    // Dropped row at seq 2: citations 1 stays, 3→2, range [4,5]→[3,4], row 6→5.
    const content = [
      HEADER_LINE,
      chunkLine(1, 'one'),
      startedLine(2),
      chunkLine(3, 'three'),
      chunkLine(4, 'four'),
      chunkLine(5, 'five'),
      messageLine(6, '1,3,[4,5]'),
    ].join('\n') + '\n'
    await writeFile(file, content, 'utf8')

    const stats = await repairSessions(root)
    expect(stats.repaired).toBe(1)

    const after = await readFile(file, 'utf8')
    expect(after).not.toContain('ya-subagent/started')
    expect(after).toContain(messageLine(5, '1,2,[3,4]'))
    // Rows before the dropped seq keep their original bytes.
    expect(after).toContain(chunkLine(1, 'one'))
  })

  it('renumbers packed chunk-run rows via seq0', async () => {
    const root = await makeRoot()
    const file = join(root, 's.jsonl')
    const content = `${HEADER_LINE}\n${startedLine(2)}\n${packedLine(3)}\n`
    await writeFile(file, content, 'utf8')

    const stats = await repairSessions(root)
    expect(stats.repaired).toBe(1)

    const after = await readFile(file, 'utf8')
    expect(after).toBe(`${HEADER_LINE}\n${packedLine(2)}\n`)
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

  it('leaves unparsable lines untouched', async () => {
    const root = await makeRoot()
    const file = join(root, 's.jsonl')
    const content = `${HEADER_LINE}\nnot-json-at-all\n${startedLine(1)}\n`
    await writeFile(file, content, 'utf8')

    const stats = await repairSessions(root)
    expect(stats.repaired).toBe(1)
    const after = await readFile(file, 'utf8')
    expect(after).toContain('not-json-at-all')
    expect(after).not.toContain('ya-subagent/started')
  })
})

describe('repairSessions — zstd (.jsonl.zstd)', () => {
  it('removes a target row from an event frame and renumbers later frames', async () => {
    const root = await makeRoot()
    const file = join(root, 's.jsonl.zstd')
    const headerFrame = compressFrame(`${HEADER_LINE}\n`)
    const eventFrame = compressFrame(`${TURN_START_LINE}\n${startedLine(1)}\n`)
    const laterFrame = compressFrame(`${turnStartLine(2)}\n`)
    await writeFile(file, Buffer.concat([headerFrame, eventFrame, laterFrame]))

    const stats = await repairSessions(root)
    expect(stats.scanned).toBe(1)
    expect(stats.repaired).toBe(1)

    const after = await readFile(file)
    const { zstdDecompressSync } = await import('node:zlib')
    const frames = splitFrames(after)
    const plaintext = frames.map(f => zstdDecompressSync(f).toString('utf8')).join('')
    expect(plaintext).not.toContain('ya-subagent/started')
    expect(plaintext).toContain(HEADER_LINE)
    expect(plaintext).toContain(TURN_START_LINE)
    expect(plaintext).toContain(turnStartLine(1))
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
    // A missing root: should produce one top-level error.
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
