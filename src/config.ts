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

import z from '@deepseek-ai/schemastery'
import type { Volatile } from '@deepseek-ai/cordis'
import type { SubagentProfile } from './types.ts'
import { migrateProfile } from './types.ts'

/**
 * Default maximum delegation depth. Since dsh 0.1.7-rc.1 the host's own
 * default (and the official `tool-subagent` default) is `1`; a profile that
 * omits `maxDepth` therefore inherits the same non-nesting policy.
 */
export const DEFAULT_MAX_DEPTH = 1

/** Schemastery schema for one profile (composition layer). */
const SubagentProfileSchema = z.object({
  id: z.string().required().description('Unique profile id (lowercase letters, digits, hyphens; 1-32 chars).'),
  label: z.string().required().description('Display name (nav label / card title).'),
  model: z.object({
    kind: z.union(['auto', 'manual']).required(),
    provider: z.string().default('').description('Provider route (only used when kind is "manual").'),
    model: z.string().default('').description('Model id (only used when kind is "manual").'),
  }).required().description('Model selection: auto inherits the parent model; manual pins a provider/model.'),
  persona: z.object({
    kind: z.union(['inherit', 'custom']).default('inherit'),
    text: z.string().default(''),
  }).default({ kind: 'inherit', text: '' }).description('Persona selection: inherit uses the deployment persona; custom shadows it with the provided text.'),
  toolFilter: z.object({
    kind: z.union(['none', 'allow', 'deny']).default('none'),
    tools: z.array(z.string()).default([]),
  }).default({ kind: 'none', tools: [] }).description('Tool filter: none applies no filter; allow keeps only the named tools; deny removes them.'),
  maxDepth: z.natural().max(Number.MAX_SAFE_INTEGER).default(DEFAULT_MAX_DEPTH).description('Maximum delegation depth (default 1).'),
  backgroundMode: z.union(['continuable', 'one-shot']).default('continuable').description('Background policy: continuable keeps the child conversation (send_message); one-shot returns a job id (job_output/job_kill).'),
  builtin: z.boolean().default(false).description('Whether this profile is part of the bundle seed (presentation hint only).'),
})

/**
 * The live Cordis config the Loader passes to `apply`.
 *
 * `profiles` is a stable reference read through `.get()`; a committed form
 * edit updates it in place without remounting the plugin.
 */
export interface EntryConfig {
  /** Live profile list; `.get()` returns the latest accepted value. */
  profiles: Volatile<SubagentProfile[]>
  /** When true, the `general` profile cannot be removed (composition seed only). */
  generalFixed: boolean
}

/**
 * Schemastery schema for the plugin's profile-owned Config.
 *
 * `profiles` is `.volatile()`: the settings service enumerates the entry's
 * volatile fields for the configuration form, and a committed edit updates
 * the running reference in place.
 */
export const Config = z.object({
  profiles: z.array(SubagentProfileSchema)
    .default([
      {
        id: 'general',
        label: 'General',
        model: { kind: 'auto', provider: '', model: '' },
        persona: { kind: 'inherit', text: '' },
        toolFilter: { kind: 'none', tools: [] },
        maxDepth: DEFAULT_MAX_DEPTH,
        backgroundMode: 'continuable',
        builtin: true,
      },
    ] as any)
    .volatile()
    .description('Subagent profiles exposed through the single `subagent` tool.'),
  generalFixed: z.boolean().default(true)
    .description('When true, the `general` profile cannot be removed.'),
}) as unknown as z<EntryConfig>

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
export function resolveProfiles(raw: unknown): SubagentProfile[] {
  if (!Array.isArray(raw)) return []
  const profiles: SubagentProfile[] = []
  for (const candidate of raw) {
    try {
      profiles.push(migrateProfile(candidate))
    } catch {
      // A malformed seed element is skipped; the remaining profiles stay usable.
    }
  }
  return profiles
}
