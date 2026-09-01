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
 * Alpha.3 change-feed contract (`@deepseek-ai/dsh-session-projection`): the
 * drive publishes a client view only when its raw output changes by
 * `Object.is`, so an object-valued view MUST reuse its reference while the
 * wire content is unchanged — a fresh object per call republishes on every
 * internal-only state change (e.g. the excluded `streamingText`
 * accumulator). Both `view`s below go through {@link memoizeView} for that
 * reference-stability guarantee.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/projection
 */
import { z } from 'zod';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
/** `subagentProfile` wire shape: childId → profileId, plus callId → childId. */
export interface SubagentProfileProjection {
    /** childId → profileId (durable). */
    readonly children: Record<string, string>;
    /** callId → childId (for foreground calls where the result text has no embedded id). */
    readonly calls: Record<string, string>;
}
/**
 * Internal fold state for `subagentProfile`. Plain JSON only (the persisted
 * projection-cache precondition), so the pending callId map is a Record,
 * not a Map.
 */
interface ProfileState {
    /** callId → profileId, awaiting the matching `tool/result`. */
    readonly pending: Record<string, string>;
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
export declare const subagentProfileProjection: {
    key: "subagentProfile";
    stateSchema: z.ZodObject<{
        pending: z.ZodRecord<z.ZodString, z.ZodString>;
        mapping: z.ZodRecord<z.ZodString, z.ZodString>;
        callToChild: z.ZodRecord<z.ZodString, z.ZodString>;
    }, z.core.$strict>;
    stateVersion: number;
    init: () => {
        pending: {};
        mapping: {};
        callToChild: {};
    };
    apply: (state: NoInfer<ProfileState>, event: SessionEvent) => ProfileState;
    wire: {
        viewSchema: z.ZodObject<{
            children: z.ZodRecord<z.ZodString, z.ZodString>;
            calls: z.ZodRecord<z.ZodString, z.ZodString>;
        }, z.core.$strict>;
        view: (state: NoInfer<ProfileState>) => {
            children: Record<string, string>;
            calls: Record<string, string>;
        };
    };
};
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
export declare const yaSubagentProgressProjection: {
    key: "yaSubagentProgress";
    stateSchema: z.ZodObject<{
        toolCallCount: z.ZodNumber;
        tokens: z.ZodObject<{
            input: z.ZodNumber;
            output: z.ZodNumber;
            cacheRead: z.ZodNumber;
            cacheWrite: z.ZodNumber;
            reasoning: z.ZodNumber;
        }, z.core.$strict>;
        state: z.ZodUnion<readonly [z.ZodLiteral<"running">, z.ZodLiteral<"idle">, z.ZodLiteral<"settled">]>;
        activity: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
            kind: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"tool">;
            name: z.ZodString;
            args: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>]>>;
        streamingText: z.ZodString;
    }, z.core.$strict>;
    stateVersion: number;
    init: () => {
        toolCallCount: number;
        tokens: {
            input: number;
            output: number;
            cacheRead: number;
            cacheWrite: number;
            reasoning: number;
        };
        state: "idle";
        streamingText: string;
    };
    apply: (state: NoInfer<ProgressState>, event: SessionEvent) => ProgressState;
    wire: {
        viewSchema: z.ZodObject<{
            toolCallCount: z.ZodNumber;
            tokens: z.ZodObject<{
                input: z.ZodNumber;
                output: z.ZodNumber;
                cacheRead: z.ZodNumber;
                cacheWrite: z.ZodNumber;
                reasoning: z.ZodNumber;
            }, z.core.$strict>;
            state: z.ZodUnion<readonly [z.ZodLiteral<"running">, z.ZodLiteral<"idle">, z.ZodLiteral<"settled">]>;
            activity: z.ZodOptional<z.ZodUnion<readonly [z.ZodObject<{
                kind: z.ZodLiteral<"text">;
                text: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                kind: z.ZodLiteral<"tool">;
                name: z.ZodString;
                args: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>]>>;
        }, z.core.$strict>;
        view: (state: NoInfer<ProgressState>) => {
            toolCallCount: number;
            tokens: {
                readonly input: number;
                readonly output: number;
                readonly cacheRead: number;
                readonly cacheWrite: number;
                readonly reasoning: number;
            };
            state: "running" | "idle" | "settled";
            activity?: Activity;
        };
    };
};
/** Convenience: the projection keys registered by this plugin. */
export declare const PROJECTION_KEYS: readonly ["subagentProfile", "yaSubagentProgress"];
/** Type-side declaration merges so consumers can read these keys via the projection registry. */
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionMap {
        /** Parent-session map of childId → profileId. */
        subagentProfile: SubagentProfileProjection;
        /** Child-session live progress (toolcall count + token usage + state). */
        yaSubagentProgress: YaSubagentProgressProjection;
    }
    interface SessionProjectionStateMap {
        /** Host fold state behind {@link SubagentProfileProjection}. */
        subagentProfile: ProfileState;
        /** Host fold state behind {@link YaSubagentProgressProjection}. */
        yaSubagentProgress: ProgressState;
    }
}
export type { SessionEvent };
