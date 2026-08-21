/**
 * yet-another-subagent — host plugin entry.
 *
 * Single bundle, dual entry: this is the host half (exports `.`). The browser
 * half ships via `./client` (see `src/client/index.ts`).
 *
 * Architecture (design doc §1):
 *   - A single `subagent` tool is exposed to the model. The desired profile
 *     is selected via the `profile` parameter (enum of profile ids). Profile
 *     add/remove updates the enum without changing the tool name set.
 *   - The tool reuses the official `spawn` provider via `ctx.subagents.startContinuable`.
 *   - Profiles live in an in-memory `ProfileStore` mutated through RPC.
 *   - Two projections (`subagentProfile` on parent, `yaSubagentProgress` on
 *     child) bridge the single-stage client runtime so SubagentCard can
 *     subscribe to live child progress.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent
 */
import type { Context } from 'cordis';
import z from 'schemastery';
import type { YaSubagentConfig } from './types.ts';
export declare const name = "yet-another-subagent";
export declare const inject: string[];
export type { SubagentProfile, YaSubagentConfig } from './types.ts';
/** Settings namespace under which profile state persists (`$DSH_HOME/settings.yaml`). */
export declare const SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
export interface Config extends YaSubagentConfig {
}
export declare const Config: z<Config>;
/**
 * Plugin body: register profile tools, RPC, and projections.
 *
 * Persistence: when a settings service is mounted, the profile list lives
 * under the `ya-subagent` namespace in `$DSH_HOME/settings.yaml`. The
 * cordis.yml `profiles` field is the composition `base` (first-boot seed);
 * runtime mutations persist through `scope.replace()`. Headless assemblies
 * without a settings provider fall back to in-memory state (cordis.yml seed
 * only, no persistence).
 * @param ctx - host context carrying `tools`, `subagents`, `sessionProjections`.
 * @param config - resolved config (seed profiles + generalFixed).
 */
export declare function apply(ctx: Context, config: Config): void;
