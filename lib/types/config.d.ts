/**
 * config.ts — profile-owned Cordis `Config` schema, entry reference type, and
 * resolvers for yet-another-subagent.
 *
 * Since dsh 0.1.7-rc.1 (`DSH-0.1.7-RC1-04`) there is no separate settings
 * namespace: the composition `Config` (declared in `cordis.patch.yml`) is both
 * the first-boot seed and the profile-owned store. The editable `profiles`
 * field is marked `.volatile()`, so the Loader hands `apply` a live
 * {@link Volatile} reference whose `.get()` always returns the latest accepted
 * value; committed edits persist per profile in `cordis.patch.yml` under the
 * entry id (`ya-subagent`).
 *
 * `generalFixed` is a composition-seed-only protection flag: it is not
 * volatile and therefore never appears in the profile form.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/config
 */
import z from '@deepseek-ai/schemastery';
import type { Volatile } from '@deepseek-ai/cordis';
import type { SubagentProfile } from './types.ts';
/**
 * Default maximum delegation depth. Since dsh 0.1.7-rc.1 the host's own
 * default (and the official `tool-subagent` default) is `1`; a profile that
 * omits `maxDepth` therefore inherits the same non-nesting policy.
 */
export declare const DEFAULT_MAX_DEPTH = 1;
/**
 * The live Cordis config the Loader passes to `apply`.
 *
 * `profiles` is a stable reference read through `.get()`; a committed form
 * edit updates it in place without remounting the plugin.
 */
export interface EntryConfig {
    /** Live profile list; `.get()` returns the latest accepted value. */
    profiles: Volatile<SubagentProfile[]>;
    /** When true, the `general` profile cannot be removed (composition seed only). */
    generalFixed: boolean;
}
/**
 * Schemastery schema for the plugin's profile-owned Config.
 *
 * `profiles` is `.volatile()`: the settings service enumerates the entry's
 * volatile fields for the configuration form, and a committed edit updates
 * the running reference in place.
 */
export declare const Config: z<EntryConfig>;
/**
 * Normalise a raw profile list into valid {@link SubagentProfile} values.
 *
 * Every element passes through {@link migrateProfile} (so a hand-edited
 * `cordis.patch.yml` carrying a legacy shape is coerced). An element that
 * cannot be migrated is dropped rather than failing the whole entry.
 *
 * @param raw - the live or seeded `profiles` value.
 * @returns the migrated profiles, in declaration order.
 */
export declare function resolveProfiles(raw: unknown): SubagentProfile[];
