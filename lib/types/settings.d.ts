/**
 * settings.ts — host-side bridge between the entry's profile-owned Config and
 * the plugin's other halves (profile store + RPC).
 *
 * dsh 0.1.7-rc.1 (`DSH-0.1.7-RC1-04`) removed the namespace-registration API:
 * a plugin declares a Cordis `Config` (see `config.ts`, `profiles` marked
 * `.volatile()`) and only declares the presentation policy for its own page.
 *
 * The bridge exposes:
 *   - `source()`: the current committed profile list, read from the live
 *     volatile reference on every call, so the RPC surface always serves the
 *     latest accepted value.
 *   - `persist(profiles)`: commits a new list through the settings service,
 *     which writes it into the active profile's `cordis.patch.yml` under the
 *     entry id and updates the live reference in place.
 *
 * Headless assemblies without a settings provider still load the plugin from
 * the composition seed; `persist` becomes a no-op and `writable` is false.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/settings
 */
import type { Context } from '@deepseek-ai/cordis';
import type { EntryConfig } from './config.ts';
import type { SubagentProfile } from './types.ts';
/** Profile entry id under which the profile list persists (`cordis.patch.yml`). */
export declare const SETTINGS_NAMESPACE = "ya-subagent";
/** Read/write face the profile store consumes. */
export interface YaSubagentSettingsBridge {
    /** The current profile list, read from the entry's live volatile config. */
    source(): readonly SubagentProfile[];
    /** Commit a profile list to the profile entry config; no-op without a settings provider. */
    persist(profiles: readonly SubagentProfile[]): Promise<void>;
    /** Whether a settings provider is mounted (false in headless assemblies). */
    readonly writable: boolean;
}
/**
 * Declare the plugin's settings presentation policy and return the bridge.
 *
 * `auto: false` suppresses a schema-generated page: this plugin ships its own
 * editor through the `plugins.row.config` slot on the Plugins page.
 *
 * @param ctx - host context.
 * @param entry - the entry's volatile Cordis config.
 * @returns the bridge the profile store and RPC consume.
 */
export declare function installYaSubagentSettings(ctx: Context, entry: EntryConfig): YaSubagentSettingsBridge;
