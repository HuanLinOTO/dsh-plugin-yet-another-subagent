import { describe, expect, it } from 'vitest'
import {
  subagentProfileProjection,
  yaSubagentProgressProjection,
} from '../src/projection.ts'
import type { SessionEvent } from '@deepseek-ai/dsh-session'

/** Build a minimal `tool/call` event. */
function toolCallEvent(seq: number, callId: string, name: string, args: string): SessionEvent {
  return {
    type: 'tool/call',
    seq,
    time: 0,
    data: { turn: 0, step: 0, callId, name, arguments: args },
  } as unknown as SessionEvent
}

/** Build a minimal `tool/call` event for the `subagent` tool with a profile arg. */
function subagentCallEvent(seq: number, callId: string, profile: string): SessionEvent {
  return toolCallEvent(seq, callId, 'subagent', JSON.stringify({ profile }))
}

/** Build a minimal `tool/result` event whose first block text matches the continuable render. */
function toolResultEvent(seq: number, callId: string, text: string): SessionEvent {
  return {
    type: 'tool/result',
    seq,
    time: 0,
    data: {
      turn: 0,
      step: 0,
      message: {
        id: 'm' as never,
        role: 'user',
        content: [{ type: 'tool-result', toolCallId: callId, content: [{ type: 'text', text }] }],
        source: { kind: 'tool', callId },
      },
    },
  } as unknown as SessionEvent
}

/** Build a minimal `turn/start` event. */
function turnStartEvent(seq: number): SessionEvent {
  return { type: 'turn/start', seq, time: 0, data: { turn: 0 } } as unknown as SessionEvent
}

/** Build a minimal `turn/end` event. */
function turnEndEvent(seq: number): SessionEvent {
  return { type: 'turn/end', seq, time: 0, data: { turn: 0, reason: 'completed' } } as unknown as SessionEvent
}

/** Build a minimal `tool/call` event that is NOT a subagent tool. */
function foreignToolCallEvent(seq: number, callId: string): SessionEvent {
  return toolCallEvent(seq, callId, 'bash', '{}')
}

/** Build a minimal `assistant/message` event with token usage and optional text content. */
function assistantMessageEvent(seq: number, usage: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number }, texts?: string[]): SessionEvent {
  const content = texts === undefined
    ? []
    : texts.map(text => ({ type: 'text' as const, text }))
  return {
    type: 'assistant/message',
    seq,
    time: 0,
    data: {
      turn: 0,
      step: 0,
      message: { id: 'm' as never, role: 'assistant', content, source: { kind: 'model' } },
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        cacheReadTokens: usage.cacheReadTokens,
      },
    },
  } as unknown as SessionEvent
}

describe('subagentProfileProjection', () => {
  it('initializes with an empty mapping', () => {
    const state = subagentProfileProjection.init()
    expect(subagentProfileProjection.wire.view(state)).toEqual({ children: {}, calls: {} })
  })

  it('folds a continuable tool/call + tool/result into the mapping', () => {
    let state = subagentProfileProjection.init()
    state = subagentProfileProjection.apply(state, subagentCallEvent(0, 'call-1', 'general'))
    state = subagentProfileProjection.apply(state, toolResultEvent(1, 'call-1', 'started General subagent child-42'))
    expect(subagentProfileProjection.wire.view(state)).toEqual({ children: { 'child-42': 'general' }, calls: { 'call-1': 'child-42' } })
  })

  it('ignores non-subagent tool calls', () => {
    let state = subagentProfileProjection.init()
    state = subagentProfileProjection.apply(state, foreignToolCallEvent(0, 'call-1'))
    state = subagentProfileProjection.apply(state, toolResultEvent(1, 'call-1', 'done'))
    expect(subagentProfileProjection.wire.view(state)).toEqual({ children: {}, calls: {} })
  })

  it('keeps a pending callId when the result has not landed yet', () => {
    let state = subagentProfileProjection.init()
    state = subagentProfileProjection.apply(state, subagentCallEvent(0, 'call-1', 'general'))
    expect(subagentProfileProjection.wire.view(state)).toEqual({ children: {}, calls: {} })
  })

  it('drops the pending entry when the result text does not match the continuable render', () => {
    let state = subagentProfileProjection.init()
    state = subagentProfileProjection.apply(state, subagentCallEvent(0, 'call-1', 'general'))
    state = subagentProfileProjection.apply(state, toolResultEvent(1, 'call-1', 'some unrelated text'))
    expect(subagentProfileProjection.wire.view(state)).toEqual({ children: {}, calls: {} })
  })

  it('handles multiple concurrent subagent calls', () => {
    let state = subagentProfileProjection.init()
    state = subagentProfileProjection.apply(state, subagentCallEvent(0, 'call-1', 'general'))
    state = subagentProfileProjection.apply(state, subagentCallEvent(1, 'call-2', 'research'))
    state = subagentProfileProjection.apply(state, toolResultEvent(2, 'call-2', 'started Research subagent child-r'))
    state = subagentProfileProjection.apply(state, toolResultEvent(3, 'call-1', 'started General subagent child-g'))
    expect(subagentProfileProjection.wire.view(state)).toEqual({
      children: { 'child-r': 'research', 'child-g': 'general' },
      calls: { 'call-2': 'child-r', 'call-1': 'child-g' },
    })
  })

  it('folds a foreground tool/call + tool/result into the mapping', () => {
    let state = subagentProfileProjection.init()
    state = subagentProfileProjection.apply(state, subagentCallEvent(0, 'call-fg', 'general'))
    state = subagentProfileProjection.apply(state, toolResultEvent(1, 'call-fg', 'completed General subagent child-fg\noutput text'))
    expect(subagentProfileProjection.wire.view(state)).toEqual({ children: { 'child-fg': 'general' }, calls: { 'call-fg': 'child-fg' } })
  })

  it('ignores unrelated event types', () => {
    let state = subagentProfileProjection.init()
    state = subagentProfileProjection.apply(state, turnStartEvent(0))
    state = subagentProfileProjection.apply(state, turnEndEvent(1))
    expect(subagentProfileProjection.wire.view(state)).toEqual({ children: {}, calls: {} })
  })
})

describe('yaSubagentProgressProjection', () => {
  it('initializes idle with zero counts', () => {
    const state = yaSubagentProgressProjection.init()
    expect(yaSubagentProgressProjection.wire.view(state)).toEqual({
      toolCallCount: 0,
      tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
      state: 'idle',
      activity: undefined,
    })
  })

  it('transitions to running on turn/start and idle on turn/end', () => {
    let state = yaSubagentProgressProjection.init()
    state = yaSubagentProgressProjection.apply(state, turnStartEvent(0))
    expect(yaSubagentProgressProjection.wire.view(state).state).toBe('running')
    state = yaSubagentProgressProjection.apply(state, turnEndEvent(1))
    expect(yaSubagentProgressProjection.wire.view(state).state).toBe('idle')
  })

  it('counts tool/call events', () => {
    let state = yaSubagentProgressProjection.init()
    state = yaSubagentProgressProjection.apply(state, toolCallEvent(0, 'c1', 'bash', '{}'))
    state = yaSubagentProgressProjection.apply(state, toolCallEvent(1, 'c2', 'subagent', '{"profile":"general"}'))
    expect(yaSubagentProgressProjection.wire.view(state).toolCallCount).toBe(2)
  })

  it('accumulates token usage from assistant/message events', () => {
    let state = yaSubagentProgressProjection.init()
    state = yaSubagentProgressProjection.apply(state, assistantMessageEvent(0, { inputTokens: 100, outputTokens: 50 }))
    state = yaSubagentProgressProjection.apply(state, assistantMessageEvent(1, { inputTokens: 200, outputTokens: 30, cacheReadTokens: 80 }))
    const view = yaSubagentProgressProjection.wire.view(state)
    expect(view.tokens).toEqual({ input: 300, output: 80, cacheRead: 80, cacheWrite: 0, reasoning: 0 })
  })

  it('ignores assistant/message events without usage', () => {
    let state = yaSubagentProgressProjection.init()
    state = yaSubagentProgressProjection.apply(state, {
      type: 'assistant/message',
      seq: 0,
      time: 0,
      data: { turn: 0, step: 0, message: { id: 'm' as never, role: 'assistant', content: [], source: { kind: 'model' } } },
    } as unknown as SessionEvent)
    expect(yaSubagentProgressProjection.wire.view(state).tokens).toEqual({
      input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0,
    })
  })

  it('sets activity to tool on tool/call with formatted args', () => {
    let state = yaSubagentProgressProjection.init()
    state = yaSubagentProgressProjection.apply(state, toolCallEvent(0, 'c1', 'grep', '{"pattern":"TODO","path":"src"}'))
    const view = yaSubagentProgressProjection.wire.view(state)
    expect(view.activity).toEqual({ kind: 'tool', name: 'grep', args: 'TODO' })
  })

  it('sets activity to tool without args when no relevant field found', () => {
    let state = yaSubagentProgressProjection.init()
    state = yaSubagentProgressProjection.apply(state, toolCallEvent(0, 'c1', 'unknown_tool', '{"x":42}'))
    const view = yaSubagentProgressProjection.wire.view(state)
    expect(view.activity).toEqual({ kind: 'tool', name: 'unknown_tool' })
  })

  it('tool/call overrides previous text activity', () => {
    let state = yaSubagentProgressProjection.init()
    state = yaSubagentProgressProjection.apply(state, assistantMessageEvent(0, { inputTokens: 10 }, ['Let me search for…']))
    expect(yaSubagentProgressProjection.wire.view(state).activity?.kind).toBe('text')
    state = yaSubagentProgressProjection.apply(state, toolCallEvent(1, 'c1', 'grep', '{"pattern":"TODO"}'))
    expect(yaSubagentProgressProjection.wire.view(state).activity).toEqual({ kind: 'tool', name: 'grep', args: 'TODO' })
  })

  it('assistant/message sets text activity from last text block', () => {
    let state = yaSubagentProgressProjection.init()
    state = yaSubagentProgressProjection.apply(state, assistantMessageEvent(0, { inputTokens: 10 }, ['Thinking about the task…']))
    expect(yaSubagentProgressProjection.wire.view(state).activity).toEqual({ kind: 'text', text: 'Thinking about the task…' })
    state = yaSubagentProgressProjection.apply(state, assistantMessageEvent(1, { inputTokens: 10 }, ['Now reading files.']))
    expect(yaSubagentProgressProjection.wire.view(state).activity).toEqual({ kind: 'text', text: 'Now reading files.' })
  })

  it('does not set activity when assistant message has no text blocks', () => {
    let state = yaSubagentProgressProjection.init()
    state = yaSubagentProgressProjection.apply(state, assistantMessageEvent(0, { inputTokens: 10 }))
    expect(yaSubagentProgressProjection.wire.view(state).activity).toBeUndefined()
  })

  it('truncates text activity to 120 chars with ellipsis', () => {
    const long = 'x'.repeat(200)
    let state = yaSubagentProgressProjection.init()
    state = yaSubagentProgressProjection.apply(state, assistantMessageEvent(0, { inputTokens: 10 }, [long]))
    const view = yaSubagentProgressProjection.wire.view(state)
    expect(view.activity?.kind).toBe('text')
    if (view.activity?.kind === 'text') {
      expect(view.activity.text).toHaveLength(121)
      expect(view.activity.text.endsWith('…')).toBe(true)
    }
  })

  it('formatToolArgs picks bash command', () => {
    let state = yaSubagentProgressProjection.init()
    state = yaSubagentProgressProjection.apply(state, toolCallEvent(0, 'c1', 'bash', '{"command":"ls -la"}'))
    expect(yaSubagentProgressProjection.wire.view(state).activity).toEqual({ kind: 'tool', name: 'bash', args: 'ls -la' })
  })

  it('formatToolArgs picks read path', () => {
    let state = yaSubagentProgressProjection.init()
    state = yaSubagentProgressProjection.apply(state, toolCallEvent(0, 'c1', 'read', '{"path":"/src/index.ts"}'))
    expect(yaSubagentProgressProjection.wire.view(state).activity).toEqual({ kind: 'tool', name: 'read', args: '/src/index.ts' })
  })

  it('formatToolArgs truncates long args', () => {
    const longCmd = 'x'.repeat(200)
    let state = yaSubagentProgressProjection.init()
    state = yaSubagentProgressProjection.apply(state, toolCallEvent(0, 'c1', 'bash', `{"command":"${longCmd}"}`))
    const view = yaSubagentProgressProjection.wire.view(state)
    expect(view.activity?.kind).toBe('tool')
    if (view.activity?.kind === 'tool') {
      expect(view.activity.args).toHaveLength(81)
      expect(view.activity.args?.endsWith('…')).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// View reference stability (dsh change feed)
//
// The drive publishes a client view only when its raw output changes by
// `Object.is`; an object-valued view must therefore reuse its reference
// while the wire content is unchanged. These specs pin the memoized views'
// contract: same content → same reference, changed content → new reference.
// ---------------------------------------------------------------------------

describe('projection view reference stability (Object.is change feed)', () => {
  it('subagentProfile keeps one reference while pending entries churn without mapping changes', () => {
    const view = subagentProfileProjection.wire.view
    const empty = subagentProfileProjection.init()
    const baseline = view(empty)
    // A subagent tool/call only writes the pending map — the wire content
    // (children/calls) is unchanged, so the view reference must be stable.
    const pendingState = subagentProfileProjection.apply(empty, subagentCallEvent(0, 'call-1', 'general'))
    expect(view(pendingState)).toBe(baseline)
    // Same state twice → the exact same object (registry replays).
    expect(view(pendingState)).toBe(view(pendingState))
    // A result without an extractable childId consumes the pending entry;
    // the wire content is still unchanged → same reference.
    const consumedState = subagentProfileProjection.apply(pendingState, toolResultEvent(1, 'call-1', 'some unrelated text'))
    expect(view(consumedState)).toBe(baseline)
    // A real mapping change must produce a NEW reference (publication fires).
    const calledState = subagentProfileProjection.apply(consumedState, subagentCallEvent(2, 'call-2', 'general'))
    const mappedState = subagentProfileProjection.apply(calledState, toolResultEvent(3, 'call-2', 'started General subagent child-42'))
    const mappedView = view(mappedState)
    expect(mappedView).not.toBe(baseline)
    expect(mappedView).toEqual({ children: { 'child-42': 'general' }, calls: { 'call-2': 'child-42' } })
  })

  it('subagentProfile returns a fresh reference once content actually changes', () => {
    const view = subagentProfileProjection.wire.view
    let state = subagentProfileProjection.init()
    const emptyView = view(state)
    state = subagentProfileProjection.apply(state, subagentCallEvent(0, 'call-1', 'general'))
    state = subagentProfileProjection.apply(state, toolResultEvent(1, 'call-1', 'started General subagent child-42'))
    const mappedView = view(state)
    expect(mappedView).not.toBe(emptyView)
    expect(mappedView).toEqual({ children: { 'child-42': 'general' }, calls: { 'call-1': 'child-42' } })
  })

  it('yaSubagentProgress keeps its reference across view-invisible state changes', () => {
    const view = yaSubagentProgressProjection.wire.view
    // Repeated reads of the same state share one reference (registry replays).
    let state = yaSubagentProgressProjection.init()
    const baseline = view(state)
    expect(view(state)).toBe(baseline)
    // assistant/message without usage and without text blocks changes nothing visible.
    state = yaSubagentProgressProjection.apply(state, {
      type: 'assistant/message',
      seq: 2,
      time: 0,
      data: { turn: 0, step: 0, message: { id: 'm' as never, role: 'assistant', content: [], source: { kind: 'model' } } },
    } as unknown as SessionEvent)
    expect(view(state)).toBe(baseline)
  })

  it('yaSubagentProgress publishes text activity changes but stays quiet once truncated text stabilizes', () => {
    const view = yaSubagentProgressProjection.wire.view
    let state = yaSubagentProgressProjection.init()
    const idle = view(state)
    // A finalized message with text → content changes → NEW reference.
    state = yaSubagentProgressProjection.apply(state, assistantMessageEvent(0, { inputTokens: 10 }, ['Hello']))
    const withText = view(state)
    expect(withText).not.toBe(idle)
    // Past LAST_TEXT_MAX the truncated activity string is stable: further
    // finalized messages that extend the same prefix truncate to identical
    // text, so the fold state moves but the view reference must NOT flip.
    state = yaSubagentProgressProjection.apply(state, assistantMessageEvent(1, {}, ['a'.repeat(200)]))
    const saturated = view(state)
    expect(saturated).not.toBe(withText)
    state = yaSubagentProgressProjection.apply(state, assistantMessageEvent(2, {}, ['a'.repeat(200) + 'b']))
    expect(view(state)).toBe(saturated)
    state = yaSubagentProgressProjection.apply(state, assistantMessageEvent(3, {}, ['a'.repeat(200) + 'c']))
    expect(view(state)).toBe(saturated)
    // A real change (tool call) still publishes.
    state = yaSubagentProgressProjection.apply(state, toolCallEvent(4, 'c1', 'grep', '{"pattern":"TODO"}'))
    expect(view(state)).not.toBe(saturated)
  })

  it('yaSubagentProgress republishes when turn state cycles back to a prior value', () => {
    const view = yaSubagentProgressProjection.wire.view
    let state = yaSubagentProgressProjection.init()
    const idle = view(state)
    // turn/start → running (content changes → fresh reference).
    state = yaSubagentProgressProjection.apply(state, turnStartEvent(0))
    const running = view(state)
    expect(running).not.toBe(idle)
    // turn/end → idle again: the content differs from the immediately
    // preceding running view, so the gate publishes a fresh (equal-content)
    // object; repeated reads of the same state then share that reference.
    state = yaSubagentProgressProjection.apply(state, turnEndEvent(1))
    const settled = view(state)
    expect(settled).not.toBe(running)
    expect(settled).toEqual(idle)
    expect(view(state)).toBe(settled)
  })
})
