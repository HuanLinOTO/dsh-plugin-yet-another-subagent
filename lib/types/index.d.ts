/**
 * yet-another-subagent — host plugin entry.
 *
 * Single bundle, dual entry: this is the host half (exports `.`). The browser
 * half ships via `./client` (see `src/client/index.ts`).
 *
 * Architecture:
 *   - A single `subagent` tool is exposed to the model. The desired profile
 *     is selected via the `profile` parameter (enum of profile ids). Profile
 *     add/remove updates the enum without changing the tool name set.
 *   - The tool reuses the official `spawn` provider via
 *     `ctx.subagents.startActivation` (dsh 0.2.1-alpha.5: one call shape for
 *     foreground, continuable, and job paths; `delivery` selects the result
 *     recipient).
 *   - Profiles live in a `ProfileStore` whose list is the entry's volatile
 *     Cordis `Config` (`profiles`); runtime mutations commit through the
 *     settings service and persist to the active profile's `cordis.patch.yml`
 *     (dsh 0.1.7-rc.1, DSH-0.1.7-RC1-04).
 *   - Two projections (`subagentProfile` on parent, `yaSubagentProgress` on
 *     child) bridge the client runtime so SubagentCard can subscribe to live
 *     child progress.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent
 */
import type { Context } from '@deepseek-ai/cordis';
import { Config, type EntryConfig } from './config.ts';
export declare const name = "yet-another-subagent";
export declare const inject: string[];
export { Config };
export { SETTINGS_NAMESPACE } from './settings.ts';
export type { SubagentProfile, YaSubagentConfig } from './types.ts';
/**
 * Plugin body: register profile tools, RPC, and projections.
 *
 * Persistence: when a settings service is mounted, the profile list lives in
 * the entry's Config (`profiles`) and runtime mutations commit through
 * `settings.update` into the active profile's `cordis.patch.yml`. The
 * composition `config.profiles` is the first-boot seed. Headless assemblies
 * without a settings provider fall back to in-memory state (seed only).
 * @param ctx - host context carrying `tools`, `subagents`, `sessionProjections`.
 * @param config - the entry's volatile Cordis config.
 */
export declare function apply(ctx: Context, config?: EntryConfig): void;
