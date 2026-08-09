/**
 * In-memory profile store with CRUD. Backed by `ctx.settings` when a settings
 * service is mounted (persists to `$DSH_HOME/settings.yaml` under the
 * `ya-subagent` namespace); falls back to a plain Map in headless assemblies
 * where no settings provider is available (cordis.yml seed only, no
 * persistence).
 *
 * @module @dsh-external/yet-another-subagent/profile-store
 */

import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import type { SubagentProfile, YaSubagentConfig } from './types.ts'
import { isValidProfileId, migrateProfile } from './types.ts'

/** CRUD result for RPC: the success branch carries the latest list. */
export type ProfileMutationResult =
  | { readonly ok: true; readonly profiles: readonly SubagentProfile[] }
  | { readonly ok: false; readonly error: string }

/** Shape stored under the `ya-subagent` settings namespace. */
export interface YaSubagentSettings {
  readonly profiles: readonly SubagentProfile[]
  readonly generalFixed: boolean
}

/**
 * Mutable profile store. Owns the canonical list; tool registration and RPC
 * handlers share one instance per plugin fiber. When `scope` is set, every
 * mutation persists through `scope.update`; otherwise the store is in-memory
 * only (cordis.yml seed, lost on unload).
 */
export class ProfileStore {
  private readonly profiles = new Map<string, SubagentProfile>()
  /** Whether `general` is locked (cannot be removed). */
  readonly generalFixed: boolean
  /** Optional settings scope for persistence; absent in headless mode. */
  private scope: SettingsScope<YaSubagentSettings> | undefined

  constructor(seed: YaSubagentConfig) {
    this.generalFixed = seed.generalFixed
    for (const profile of seed.profiles) {
      // Seed profiles may come from cordis.yml with the new shape or from an
      // older settings.yaml; coerce both through migrateProfile.
      const migrated = migrateProfile(profile)
      this.profiles.set(migrated.id, migrated)
    }
  }

  /**
   * Attach a settings scope. Subsequent mutations persist through it; the
   * initial in-memory state is replaced with the scope's resolved value
   * (which layers schema defaults, the composition `base`, and the user
   * document).
   */
  attachScope(scope: SettingsScope<YaSubagentSettings>): void {
    this.scope = scope
    this.reloadFromScope()
  }

  /** Reload the in-memory map from the settings scope's current resolved value. */
  reloadFromScope(): void {
    if (this.scope === undefined) return
    const value = this.scope.get()
    this.profiles.clear()
    for (const profile of value.profiles) {
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
    // Migrate first so legacy shapes from older settings.yaml or callers
    // don't crash; the migrated shape is what we store and persist. Wrap in
    // try/catch so a malformed input returns { ok: false } instead of throwing
    // (the RPC handler's contract is non-throwing).
    let migrated: SubagentProfile
    try {
      migrated = migrateProfile(profile)
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
    // Normalize the id to lowercase before validation: the tool name is
    // `subagent_<id>` and the id doubles as a settings key, so we keep the
    // canonical form lowercase. This lets the user type "Catgirl" in the UI
    // and get "catgirl" stored — no rejection, no surprise.
    migrated = { ...migrated, id: migrated.id.toLowerCase() }
    if (!isValidProfileId(migrated.id)) {
      return { ok: false, error: `invalid profile id: ${JSON.stringify(migrated.id)}` }
    }
    if (this.profiles.has(migrated.id)) {
      return { ok: false, error: `profile id already exists: ${migrated.id}` }
    }
    // RPC-added profiles are never builtin: only the cordis.yml seed can mark
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

  /** Persist the current list through the attached settings scope (fire-and-forget; errors logged). */
  private persist(): void {
    if (this.scope === undefined) return
    const next: YaSubagentSettings = {
      profiles: this.list(),
      generalFixed: this.generalFixed,
    }
    void this.scope.replace(next as unknown as object).catch((error: unknown) => {
      // Persistence failure does not roll back the in-memory mutation: the
      // RPC caller already received the new list, and the host's tool
      // registration reflects it. The next reload from settings will surface
      // the discrepancy; a logged warning is the sanest signal here.
      console.error('[yet-another-subagent] settings persist failed:', error)
    })
  }
}
