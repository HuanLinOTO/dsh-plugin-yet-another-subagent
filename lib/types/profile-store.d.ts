/**
 * In-memory profile store with CRUD, backed by the entry's profile-owned
 * Cordis Config when a settings provider is mounted (the list persists in
 * `cordis.patch.yml` under the `yet-another-subagent` entry id); falls back to
 * a plain Map in headless assemblies where no settings provider is available
 * (composition seed only, no persistence).
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/profile-store
 */
import type { SubagentProfile, YaSubagentConfig } from './types.ts';
/** CRUD result for RPC: the success branch carries the latest list. */
export type ProfileMutationResult = {
    readonly ok: true;
    readonly profiles: readonly SubagentProfile[];
} | {
    readonly ok: false;
    readonly error: string;
};
/** The durable profile list shape persisted under the entry config. */
export interface YaSubagentSettings {
    readonly profiles: readonly SubagentProfile[];
    readonly generalFixed: boolean;
}
/**
 * Persistence face attached to a {@link ProfileStore}.
 *
 * `source` reads the currently committed list (the entry's live volatile
 * config); `persist` commits a replacement. Both are provided by
 * `installYaSubagentSettings`.
 */
export interface ProfilePersistence {
    /** The currently committed profile list. */
    source(): readonly SubagentProfile[];
    /** Commit a replacement list. */
    persist(profiles: readonly SubagentProfile[]): Promise<void>;
}
/**
 * Mutable profile store. Owns the working list; tool registration and RPC
 * handlers share one instance per plugin fiber. When a persistence face is
 * attached, every mutation commits through it; otherwise the store is
 * in-memory only (composition seed, lost on unload).
 */
export declare class ProfileStore {
    private readonly profiles;
    /** Whether `general` is locked (cannot be removed). */
    readonly generalFixed: boolean;
    /** Optional persistence face; absent in headless mode. */
    private persistence;
    constructor(seed: YaSubagentConfig);
    /**
     * Attach a persistence face. Subsequent mutations commit through it, and the
     * in-memory working list is replaced with the face's current value (the
     * profile entry's committed config).
     */
    attachPersistence(persistence: ProfilePersistence): void;
    /** Reload the working list from the persistence face's current value. */
    reloadFromPersistence(): void;
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
    /** Commit the current list through the attached persistence face (fire-and-forget; errors logged). */
    private persist;
}
