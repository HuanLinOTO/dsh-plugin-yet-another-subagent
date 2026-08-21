/**
 * In-memory profile store with CRUD. Backed by `ctx.settings` when a settings
 * service is mounted (persists to `$DSH_HOME/settings.yaml` under the
 * `ya-subagent` namespace); falls back to a plain Map in headless assemblies
 * where no settings provider is available (cordis.yml seed only, no
 * persistence).
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/profile-store
 */
import type { SettingsScope } from '@deepseek-ai/dsh-settings';
import type { SubagentProfile, YaSubagentConfig } from './types.ts';
/** CRUD result for RPC: the success branch carries the latest list. */
export type ProfileMutationResult = {
    readonly ok: true;
    readonly profiles: readonly SubagentProfile[];
} | {
    readonly ok: false;
    readonly error: string;
};
/** Shape stored under the `ya-subagent` settings namespace. */
export interface YaSubagentSettings {
    readonly profiles: readonly SubagentProfile[];
    readonly generalFixed: boolean;
}
/**
 * Mutable profile store. Owns the canonical list; tool registration and RPC
 * handlers share one instance per plugin fiber. When `scope` is set, every
 * mutation persists through `scope.update`; otherwise the store is in-memory
 * only (cordis.yml seed, lost on unload).
 */
export declare class ProfileStore {
    private readonly profiles;
    /** Whether `general` is locked (cannot be removed). */
    readonly generalFixed: boolean;
    /** Optional settings scope for persistence; absent in headless mode. */
    private scope;
    constructor(seed: YaSubagentConfig);
    /**
     * Attach a settings scope. Subsequent mutations persist through it; the
     * initial in-memory state is replaced with the scope's resolved value
     * (which layers schema defaults, the composition `base`, and the user
     * document).
     */
    attachScope(scope: SettingsScope<YaSubagentSettings>): void;
    /** Reload the in-memory map from the settings scope's current resolved value. */
    reloadFromScope(): void;
    /** Snapshot of all profiles, in insertion order. */
    list(): readonly SubagentProfile[];
    /** Look up one profile by id. */
    get(id: string): SubagentProfile | undefined;
    /** Add a new profile. Returns failure for duplicate id or invalid shape. */
    add(profile: SubagentProfile): ProfileMutationResult;
    /** Update an existing profile. Returns failure if the id is unknown. */
    update(profile: SubagentProfile): ProfileMutationResult;
    /** Remove a profile. Returns failure for unknown id or protected `general`. */
    remove(id: string): ProfileMutationResult;
    /** Persist the current list through the attached settings scope (fire-and-forget; errors logged). */
    private persist;
}
