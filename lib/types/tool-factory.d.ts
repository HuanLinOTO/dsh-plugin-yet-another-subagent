/**
 * Tool factory: compile the profile list into a single `defineTool` definition.
 *
 * One `subagent` tool is exposed to the model regardless of how many profiles
 * are configured. The desired profile is selected via the `profile` parameter
 * (an enum of available profile ids). This keeps the tool surface flat — the
 * model learns one tool, not N — and profile add/remove does not change the
 * tool name set the model was trained against.
 *
 * Two profile-specific extensions are preserved from the per-profile design:
 *   1. The continuable result content embeds `profileLabel` so SubagentCard
 *      can render with zero RPC (SkillRow paradigm, design doc §4.4).
 *   2. The `profile` parameter enum lists the live profile ids.
 *
 * Foreground (one-shot) path is kept for `run_in_background: false`; the
 * default is continuable background.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/tool-factory
 */
import type { Context } from 'cordis';
import type { SubagentProvider, SubagentResult, SubagentRun } from '@deepseek-ai/dsh-subagent';
import type { JobOutcome } from '@deepseek-ai/dsh-jobs';
import type { SubagentProfile } from './types.ts';
/** Merge-extensible session event: child started for a tool call. */
declare module '@deepseek-ai/dsh-session' {
    interface SessionEventMap {
        'ya-subagent/started': {
            callId: string;
            childId: string;
            profileId: string;
        };
    }
}
/** Settle pending startup without rejecting the task producer contract. */
declare function settleStart(start: Promise<SubagentRun>, signal: AbortSignal): Promise<JobOutcome>;
/**
 * Build the single model-facing `subagent` tool definition.
 *
 * @param profiles - the live profile list (drives the `profile` enum).
 * @param ctx - host context carrying `subagents` (and `jobs` for one-shot background).
 * @returns a `defineTool` definition ready for `ctx.tools.register`.
 */
export declare function buildTool(profiles: readonly SubagentProfile[], ctx: Context): import("@deepseek-ai/dsh-tools").ToolDefinition;
export { settleStart };
export type { SubagentProvider, SubagentResult, SubagentRun, JobOutcome };
