/**
 * In-memory profile store with CRUD, backed by the entry's profile-owned
 * Cordis Config when a settings provider is mounted (the list persists in
 * `cordis.patch.yml` under the `yet-another-subagent` entry id); falls back to
 * a plain Map in headless assemblies where no settings provider is available
 * (composition seed only, no persistence).
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/profile-store
 */

import type { SubagentProfile, YaSubagentConfig } from './types.ts'
import { isValidProfileId, migrateProfile } from './types.ts'

/** CRUD result for RPC: the success branch carries the latest list. */
export type ProfileMutationResult =
  | { readonly ok: true; readonly profiles: readonly SubagentProfile[] }
  | { readonly ok: false; readonly error: string }

/** The durable profile list shape persisted under the entry config. */
export interface YaSubagentSettings {
  readonly profiles: readonly SubagentProfile[]
  readonly generalFixed: boolean
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
  source(): readonly SubagentProfile[]
  /** Commit a replacement list. */
  persist(profiles: readonly SubagentProfile[]): Promise<void>
}

/**
 * Mutable profile store. Owns the working list; tool registration and RPC
 * handlers share one instance per plugin fiber. When a persistence face is
 * attached, every mutation commits through it; otherwise the store is
 * in-memory only (composition seed, lost on unload).
 */
export class ProfileStore {
  private readonly profiles = new Map<string, SubagentProfile>()
  /** Whether `general` is locked (cannot be removed). */
  readonly generalFixed: boolean
  /** Optional persistence face; absent in headless mode. */
  private persistence: ProfilePersistence | undefined

  constructor(seed: YaSubagentConfig) {
    this.generalFixed = seed.generalFixed
    for (const profile of seed.profiles) {
      // Seed profiles may come from cordis.patch.yml with the new shape or
      // from an imported legacy document; coerce both through migrateProfile.
      const migrated = migrateProfile(profile)
      this.profiles.set(migrated.id, migrated)
    }
  }

  /**
   * Attach a persistence face. Subsequent mutations commit through it, and the
   * in-memory working list is replaced with the face's current value (the
   * profile entry's committed config).
   */
  attachPersistence(persistence: ProfilePersistence): void {
    this.persistence = persistence
    this.reloadFromPersistence()
  }

  /** Reload the working list from the persistence face's current value. */
  reloadFromPersistence(): void {
    if (this.persistence === undefined) return
    this.profiles.clear()
    for (const profile of this.persistence.source()) {
      const migrated = migrateProfile(profile)
      this.profiles.set(migrated.id, migrated)
    }
  }

  /** Snapshot of all profiles, in insertion order. */
  list(): readonly SubagentProfile[] {
    return [...this.profiles.values()]
  }

  /** Look up one profile by id. */
  get(id: string): SubagentProfile | undefined {
    return this.profiles.get(id)
  }

  /** Add a new profile. Returns failure for duplicate id or invalid shape. */
  add(profile: SubagentProfile): ProfileMutationResult {
    // Migrate first so legacy shapes from an imported document or callers
    // don't crash; the migrated shape is what we store and persist. Wrap in
    // try/catch so a malformed input returns { ok: false } instead of throwing
    // (the RPC handler's contract is non-throwing).
    let migrated: SubagentProfile
    try {
      migrated = migrateProfile(profile)
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
    // Normalize the id to lowercase before validation: the profile id doubles
    // as a settings key and as the tool enum value, so keep it canonical.
    // This lets the user type "Catgirl" in the UI and get "catgirl" stored.
    migrated = { ...migrated, id: migrated.id.toLowerCase() }
    if (!isValidProfileId(migrated.id)) {
      return { ok: false, error: `invalid profile id: ${JSON.stringify(migrated.id)}` }
    }
    if (this.profiles.has(migrated.id)) {
      return { ok: false, error: `profile id already exists: ${migrated.id}` }
    }
    // RPC-added profiles are never builtin: only the composition seed can mark
    // a profile as builtin. Strip any caller-supplied builtin=true.
    const stored: SubagentProfile = { ...migrated, builtin: false }
    this.profiles.set(stored.id, stored)
    void this.persist()
    return { ok: true, profiles: this.list() }
  }

  /** Update an existing profile. Returns failure if the id is unknown. */
  update(profile: SubagentProfile): ProfileMutationResult {
    let migrated: SubagentProfile
    try {
      migrated = migrateProfile(profile)
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
    if (!isValidProfileId(migrated.id)) {
      return { ok: false, error: `invalid profile id: ${JSON.stringify(migrated.id)}` }
    }
    const existing = this.profiles.get(migrated.id)
    if (existing === undefined) {
      return { ok: false, error: `profile id not found: ${migrated.id}` }
    }
    // The `builtin` flag is a presentation hint owned by the seed layer: an
    // update cannot flip it (a user cannot promote a custom profile to
    // builtin, nor demote a builtin one).
    const stored: SubagentProfile = { ...migrated, builtin: existing.builtin }
    this.profiles.set(stored.id, stored)
    void this.persist()
    return { ok: true, profiles: this.list() }
  }

  /** Remove a profile. Returns failure for unknown id or protected `general`. */
  remove(id: string): ProfileMutationResult {
    if (id === 'general' && this.generalFixed) {
      return { ok: false, error: 'profile "general" is fixed and cannot be removed' }
    }
    if (!this.profiles.delete(id)) {
      return { ok: false, error: `profile id not found: ${id}` }
    }
    void this.persist()
    return { ok: true, profiles: this.list() }
  }

  /** Commit the current list through the attached persistence face (fire-and-forget; errors logged). */
  private persist(): void {
    if (this.persistence === undefined) return
    void this.persistence.persist(this.list()).catch((error: unknown) => {
      // Persistence failure does not roll back the in-memory mutation: the
      // RPC caller already received the new list, and the host's tool
      // registration reflects it. A logged warning is the sanest signal here.
      console.error('[yet-another-subagent] settings persist failed:', error)
    })
  }
}
