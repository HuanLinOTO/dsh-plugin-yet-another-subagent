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
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
/** `subagentProfile` wire shape: childId → profileId, plus callId → childId. */
export interface SubagentProfileProjection {
    /** childId → profileId (durable). */
    readonly children: Record<string, string>;
    /** callId → childId (for foreground calls where the result text has no embedded id). */
    readonly calls: Record<string, string>;
}
/** Internal fold state for `subagentProfile`. */
interface ProfileState {
    /** callId → profileId, awaiting the matching `tool/result`. */
    readonly pending: Map<string, string>;
    /** childId → profileId (the durable mapping). */
    readonly mapping: Record<string, string>;
    /** callId → childId (survives after the pending entry is consumed). */
    readonly callToChild: Record<string, string>;
}
/**
 * Fold the parent session's `tool/call` + `tool/result` for tool name
 * `subagent`. The profile id is carried in `tool/call.arguments.profile`
 * (JSON-encoded). The result content embeds `subagentId` (continuable branch)
 * or `runId` (foreground branch); the continuable branch is the durable
 * child identity that survives across activations.
 */
export declare const subagentProfileProjection: ProjectionDefinition<'subagentProfile', ProfileState>;
/** `yaSubagentProgress` wire shape: live child progress for the parent's card. */
export interface YaSubagentProgressProjection {
    /** Number of `tool/call` events folded so far. */
    readonly toolCallCount: number;
    /** Cumulative token usage folded from `assistant/message.usage`. */
    readonly tokens: {
        readonly input: number;
        readonly output: number;
        readonly cacheRead: number;
        readonly cacheWrite: number;
        readonly reasoning: number;
    };
    /** Lifecycle state derived from turn boundaries. */
    readonly state: 'running' | 'idle' | 'settled';
    /** Latest activity: streaming text, tool call, or finalized message text. */
    readonly activity?: Activity;
}
/** Discriminated activity union: text or tool call. */
export type Activity = {
    readonly kind: 'text';
    readonly text: string;
} | {
    readonly kind: 'tool';
    readonly name: string;
    readonly args?: string;
};
interface ProgressState {
    readonly toolCallCount: number;
    readonly tokens: {
        readonly input: number;
        readonly output: number;
        readonly cacheRead: number;
        readonly cacheWrite: number;
        readonly reasoning: number;
    };
    readonly state: 'running' | 'idle' | 'settled';
    /** Accumulator for the current text block's streaming deltas. */
    readonly streamingText: string;
    readonly activity?: Activity;
}
/**
 * Fold the child session's own events into a compact progress view. Token
 * usage accumulates from `assistant/message.usage` (cache fields are
 * optional); tool calls are counted; lifecycle follows turn boundaries.
 */
export declare const yaSubagentProgressProjection: ProjectionDefinition<'yaSubagentProgress', ProgressState>;
/** Convenience: the projection keys registered by this plugin. */
export declare const PROJECTION_KEYS: readonly ["subagentProfile", "yaSubagentProgress"];
/** Type-side declaration merge so consumers can read these keys via the projection registry. */
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionMap {
        /** Parent-session map of childId → profileId. Empty object when no children yet. */
        subagentProfile: SubagentProfileProjection;
        /** Child-session live progress (toolcall count + token usage + state). */
        yaSubagentProgress: YaSubagentProgressProjection;
    }
}
export type { SessionEvent };
