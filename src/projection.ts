/**
 * Two session projections (design doc §3.6):
 *
 *   - `subagentProfile` (parent session): fold `tool/call` (name `subagent`,
 *     profile in `arguments.profile`) + the matching `tool/result.subagentId`,
 *     building a `childId → profileId` map. Used as a cross-check / fallback
 *     for SubagentCard (which usually reads `profileLabel` straight from the
 *     result content).
 *
 *   - `yaSubagentProgress` (child session): toolcall count, token usage,
 *     and lifecycle state. Pushed over the projection frame so the parent's
 *     SubagentCard can subscribe even though client runtime drops non-current
 *     `session/event` frames (single-stage model).
 *
 * Both units are pure synchronous folds; the framework drives them and the
 * host wire layer ships the validated views.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/projection
 */

import { z } from 'zod'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { SessionEvent } from '@deepseek-ai/dsh-session'

// ---------------------------------------------------------------------------
// subagentProfile (parent session): childId → profileId
// ---------------------------------------------------------------------------

/** `subagentProfile` wire shape: childId → profileId, plus callId → childId. */
export interface SubagentProfileProjection {
  /** childId → profileId (durable). */
  readonly children: Record<string, string>
  /** callId → childId (for foreground calls where the result text has no embedded id). */
  readonly calls: Record<string, string>
}

/** Internal fold state for `subagentProfile`. */
interface ProfileState {
  /** callId → profileId, awaiting the matching `tool/result`. */
  readonly pending: Map<string, string>
  /** childId → profileId (the durable mapping). */
  readonly mapping: Record<string, string>
  /** callId → childId (survives after the pending entry is consumed). */
  readonly callToChild: Record<string, string>
}

const profileSchema = z.object({
  children: z.record(z.string(), z.string()),
  calls: z.record(z.string(), z.string()),
}).strict() as unknown as z.ZodType<SubagentProfileProjection>

/**
 * Fold the parent session's `tool/call` + `tool/result` for tool name
 * `subagent`. The profile id is carried in `tool/call.arguments.profile`
 * (JSON-encoded). The result content embeds `subagentId` (continuable branch)
 * or `runId` (foreground branch); the continuable branch is the durable
 * child identity that survives across activations.
 */
export const subagentProfileProjection: ProjectionDefinition<'subagentProfile', ProfileState> = {
  key: 'subagentProfile',
  schema: profileSchema,
  stateVersion: 3,
  init: () => ({ pending: new Map(), mapping: {}, callToChild: {} }),
  apply: (state, event) => {
    // `ya-subagent/started` is appended by the tool execute immediately after
    // the child session is created, so the client card can resolve the childId
    // before `tool/result` lands (while the subagent is still running).
    if (event.type === 'ya-subagent/started') {
      const { callId, childId, profileId } = event.data
      const nextMapping = { ...state.mapping, [childId]: profileId }
      const nextCallToChild = { ...state.callToChild, [callId]: childId }
      const nextPending = new Map(state.pending)
      nextPending.delete(callId)
      return { pending: nextPending, mapping: nextMapping, callToChild: nextCallToChild }
    }
    if (event.type === 'tool/call' && event.data.name === 'subagent') {
      const profileId = readProfileId(event.data.arguments)
      if (profileId === undefined) return state
      const nextPending = new Map(state.pending)
      nextPending.set(event.data.callId, profileId)
      return { ...state, pending: nextPending }
    }
    if (event.type === 'tool/result') {
      // `tool/result` carries the callId on the message's first content block
      // (a ToolResultBlock), not on the event data itself.
      const callId = event.data.message.content[0]?.toolCallId
      if (callId === undefined) return state
      const profileId = state.pending.get(callId)
      if (profileId === undefined) return state
      const childId = readChildId(event.data.message)
      const nextPending = new Map(state.pending)
      nextPending.delete(callId)
      if (childId === undefined) return { ...state, pending: nextPending }
      const nextMapping = { ...state.mapping, [childId]: profileId }
      const nextCallToChild = { ...state.callToChild, [callId]: childId }
      return { pending: nextPending, mapping: nextMapping, callToChild: nextCallToChild }
    }
    return state
  },
  view: state => ({ children: state.mapping, calls: state.callToChild }),
}

/** Parse the `profile` field from a `tool/call` arguments JSON string. */
function readProfileId(argumentsRaw: string): string | undefined {
  try {
    const parsed = JSON.parse(argumentsRaw) as { readonly profile?: unknown }
    return typeof parsed.profile === 'string' ? parsed.profile : undefined
  } catch {
    return undefined
  }
}

/** Extract the durable child id from a `tool/result` message's nested text blocks. */
function readChildId(message: { readonly content: readonly { readonly type: string; readonly toolCallId?: string; readonly content?: readonly { readonly type: string; readonly text?: string }[] }[] }): string | undefined {
  for (const block of message.content) {
    if (block.type !== 'tool-result' || block.content === undefined) continue
    for (const inner of block.content) {
      if (inner.type !== 'text' || typeof inner.text !== 'string') continue
      // Continuable render: `started <profileLabel> subagent <subagentId>`.
      const continuableMatch = inner.text.match(/^started \S+ subagent (\S+)$/)
      if (continuableMatch !== null && continuableMatch[1] !== undefined) {
        return continuableMatch[1]
      }
      // Foreground render: `completed <profileLabel> subagent <runId>\n<output>`.
      const foregroundMatch = inner.text.match(/^completed \S+ subagent (\S+)/)
      if (foregroundMatch !== null && foregroundMatch[1] !== undefined) {
        return foregroundMatch[1]
      }
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// yaSubagentProgress (child session): toolcall count + token usage + state
// ---------------------------------------------------------------------------

/** Max length of the `lastText` snippet folded from assistant messages. */
const LAST_TEXT_MAX = 120

/** Truncate text to `max` chars with ellipsis. */
function truncateText(text: string, max = LAST_TEXT_MAX): string {
  const single = text.replace(/\s+/g, ' ').trim()
  return single.length > max ? single.slice(0, max) + '…' : single
}

/** Max length of formatted tool arguments. */
const TOOL_ARGS_MAX = 80

/**
 * Format a tool's arguments into a compact display string, picking the most
 * relevant field by tool name. Returns `undefined` when no suitable field
 * is found or the arguments are not valid JSON.
 */
function formatToolArgs(name: string, argsRaw: string): string | undefined {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(argsRaw) as Record<string, unknown>
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined

  // Tool-specific field priority: show the most informative argument.
  const fieldPriority: Record<string, readonly string[]> = {
    grep: ['pattern', 'path', 'include'],
    rg: ['pattern', 'path', 'include'],
    bash: ['command', 'cmd'],
    read: ['path', 'filePath', 'file_path'],
    edit: ['filePath', 'path', 'file_path'],
    write: ['filePath', 'path', 'file_path'],
    subagent: ['description', 'prompt'],
    'web_search': ['query', 'search'],
    webfetch: ['url'],
    web_fetch: ['url'],
    glob: ['pattern', 'path'],
    'task': ['description'],
  }
  const fields = fieldPriority[name] ?? Object.keys(parsed).filter(k => typeof parsed[k] === 'string')
  for (const field of fields) {
    const val = parsed[field]
    if (typeof val === 'string' && val.length > 0) {
      return truncateText(val, TOOL_ARGS_MAX)
    }
  }
  return undefined
}

/**
 * Extract the last text block from an assistant message's content, truncated
 * to {@link LAST_TEXT_MAX} chars. Returns `undefined` when the message has no
 * text blocks (e.g. only tool-call blocks).
 */
function readLastText(message: { readonly content?: readonly { readonly type?: string; readonly text?: string }[] }): string | undefined {
  if (message.content === undefined) return undefined
  let last: string | undefined
  for (const block of message.content) {
    if (block.type === 'text' && typeof block.text === 'string') {
      last = block.text
    }
  }
  if (last === undefined) return undefined
  return truncateText(last)
}

/** `yaSubagentProgress` wire shape: live child progress for the parent's card. */
export interface YaSubagentProgressProjection {
  /** Number of `tool/call` events folded so far. */
  readonly toolCallCount: number
  /** Cumulative token usage folded from `assistant/message.usage`. */
  readonly tokens: {
    readonly input: number
    readonly output: number
    readonly cacheRead: number
    readonly cacheWrite: number
    readonly reasoning: number
  }
  /** Lifecycle state derived from turn boundaries. */
  readonly state: 'running' | 'idle' | 'settled'
  /** Latest activity: streaming text, tool call, or finalized message text. */
  readonly activity?: Activity
}

/** Discriminated activity union: text or tool call. */
export type Activity =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'tool'; readonly name: string; readonly args?: string }

interface ProgressState {
  readonly toolCallCount: number
  readonly tokens: {
    readonly input: number
    readonly output: number
    readonly cacheRead: number
    readonly cacheWrite: number
    readonly reasoning: number
  }
  readonly state: 'running' | 'idle' | 'settled'
  /** Accumulator for the current text block's streaming deltas. */
  readonly streamingText: string
  readonly activity?: Activity
}

const activitySchema = z.union([
  z.object({ kind: z.literal('text'), text: z.string() }).strict(),
  z.object({ kind: z.literal('tool'), name: z.string(), args: z.string().optional() }).strict(),
])

const progressSchema = z.object({
  toolCallCount: z.number().int().nonnegative(),
  tokens: z.object({
    input: z.number().int().nonnegative(),
    output: z.number().int().nonnegative(),
    cacheRead: z.number().int().nonnegative(),
    cacheWrite: z.number().int().nonnegative(),
    reasoning: z.number().int().nonnegative(),
  }).strict(),
  state: z.union([z.literal('running'), z.literal('idle'), z.literal('settled')]),
  activity: activitySchema.optional(),
}).strict() as unknown as z.ZodType<YaSubagentProgressProjection>

/**
 * Fold the child session's own events into a compact progress view. Token
 * usage accumulates from `assistant/message.usage` (cache fields are
 * optional); tool calls are counted; lifecycle follows turn boundaries.
 */
export const yaSubagentProgressProjection: ProjectionDefinition<'yaSubagentProgress', ProgressState> = {
  key: 'yaSubagentProgress',
  schema: progressSchema,
  stateVersion: 2,
  init: () => ({
    toolCallCount: 0,
    tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
    state: 'idle',
    streamingText: '',
  }),
  apply: (state, event) => {
    if (event.type === 'turn/start') {
      return { ...state, state: 'running' as const }
    }
    if (event.type === 'turn/end') {
      return { ...state, state: 'idle' as const }
    }
    if (event.type === 'step/start') {
      // Reset the streaming text accumulator for the new step.
      return { ...state, streamingText: '' }
    }
    if (event.type === 'assistant/chunk') {
      const chunk = (event.data as { chunk: { type: string; text?: string; name?: string; blockType?: string } }).chunk
      // New text block starting → reset the accumulator so we show only the
      // latest text block, not concatenated text from multiple blocks.
      if (chunk.type === 'block-start' && chunk.blockType === 'text') {
        return { ...state, streamingText: '' }
      }
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
        const streamingText = state.streamingText + chunk.text
        const truncated = truncateText(streamingText)
        return {
          ...state,
          streamingText,
          activity: { kind: 'text' as const, text: truncated },
        }
      }
      // Tool-call-delta carries the tool name as soon as the model emits it,
      // giving real-time visibility before tool/call fires.
      if (chunk.type === 'tool-call-delta' && typeof chunk.name === 'string') {
        return { ...state, activity: { kind: 'tool' as const, name: chunk.name } }
      }
      return state
    }
    if (event.type === 'tool/call') {
      return {
        ...state,
        toolCallCount: state.toolCallCount + 1,
        activity: {
          kind: 'tool' as const,
          name: event.data.name,
          ...formatToolArgs(event.data.name, event.data.arguments) !== undefined
            ? { args: formatToolArgs(event.data.name, event.data.arguments) }
            : {},
        },
      }
    }
    if (event.type === 'assistant/message') {
      const usage = event.data.usage
      const tokens = usage === undefined ? state.tokens : {
        input: state.tokens.input + (usage.inputTokens ?? 0),
        output: state.tokens.output + (usage.outputTokens ?? 0),
        cacheRead: state.tokens.cacheRead + (usage.cacheReadTokens ?? 0),
        cacheWrite: state.tokens.cacheWrite + (usage.cacheWriteTokens ?? 0),
        reasoning: state.tokens.reasoning + (usage.reasoningTokens ?? 0),
      }
      // assistant/message fires BEFORE tool/call when the message has tool-call
      // blocks. Setting activity to text here is correct: if a tool/call
      // follows, it overrides; if not, the finalized text is the latest activity.
      const lastText = readLastText(event.data.message)
      return {
        ...state,
        tokens,
        ...(lastText !== undefined ? { activity: { kind: 'text' as const, text: lastText } } : {}),
      }
    }
    return state
  },
  view: state => {
    const { streamingText: _, ...rest } = state
    return rest
  },
}

/** Convenience: the projection keys registered by this plugin. */
export const PROJECTION_KEYS = ['subagentProfile', 'yaSubagentProgress'] as const

/** Type-side declaration merge so consumers can read these keys via the projection registry. */
declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Parent-session map of childId → profileId. Empty object when no children yet. */
    subagentProfile: SubagentProfileProjection
    /** Child-session live progress (toolcall count + token usage + state). */
    yaSubagentProgress: YaSubagentProgressProjection
  }
}

// Re-export the SessionEvent type so callers can fold manually if needed.
export type { SessionEvent }
