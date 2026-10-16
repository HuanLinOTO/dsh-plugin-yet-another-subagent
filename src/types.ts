/**
 * Profile data model for yet-another-subagent.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/types
 */

import type { AgentOptions } from '@deepseek-ai/dsh-agent'

/** A model-facing tool name is `subagent_<id>`. */
export interface SubagentProfile {
  /** Unique id; lowercase letters, digits, hyphens; 1–32 chars. Used as `subagent_<id>`. */
  readonly id: string
  /** Display name (nav label / card title). */
  readonly label: string
  /**
   * Model selection. `kind: 'auto'` inherits the parent model (provider/model
   * are ignored); `kind: 'manual'` pins a specific provider/model.
   */
  readonly model: {
    readonly kind: 'auto' | 'manual'
    readonly provider: string
    readonly model: string
  }
  /**
   * Maximum delegation depth (non-negative safe integer); default 1.
   */
  readonly maxDepth: number
  /**
   * Background policy when `run_in_background: true` is set. `'continuable'`
   * (default, matches the base bundle) starts a background subagent that keeps
   * its conversation — the caller receives only its subagent id and sends more
   * work via `send_message`. `'one-shot'` starts a background task that returns
   * a job id — the caller collects the result with `job_output` and stops it
   * with `job_kill`.
   */
  readonly backgroundMode: 'continuable' | 'one-shot'
  /**
   * Whether this profile is part of the bundle seed (cordis.patch.yml) and
   * therefore labelled `builtin` in the UI. User-added profiles are `false`.
   * Builtin profiles can still be edited or removed (unless `generalFixed`
   * protects them); the flag is purely a presentation hint.
   */
  readonly builtin: boolean
}

/** Top-level config. */
export interface YaSubagentConfig {
  /** Initial profile list (cordis.yml layer). Runtime mutations live in memory only. */
  readonly profiles: readonly SubagentProfile[]
  /** When true, the `general` profile cannot be removed. */
  readonly generalFixed: boolean
}

/**
 * Coerce a possibly-stale profile shape into the current
 * {@link SubagentProfile} shape. Idempotent on already-current shapes.
 *
 * Since dsh 0.2.1-alpha.5 the subagent start request no longer carries
 * `persona` or `toolFilter` (DSH-0.2.1-J1-05), so those profile fields were
 * removed. A stored profile that still carries them migrates by dropping the
 * fields — personas now come from agent presets and tool filters are gone.
 *
 * Rules:
 *   - `builtin: undefined | null` → `false`
 */
export function migrateProfile(input: unknown): SubagentProfile {
  const p = input as Partial<SubagentProfile> & {
    builtin?: unknown
  }
  if (typeof p !== 'object' || p === null) {
    throw new Error('profile must be an object')
  }
  if (typeof p.id !== 'string' || typeof p.label !== 'string') {
    throw new Error('profile.id and profile.label must be strings')
  }
  if (typeof p.model !== 'object' || p.model === null) {
    throw new Error('profile.model must be an object')
  }
  if (typeof p.maxDepth !== 'number' || !Number.isSafeInteger(p.maxDepth) || p.maxDepth < 0) {
    throw new Error(`profile.maxDepth must be a non-negative safe integer, got ${String(p.maxDepth)}`)
  }

  return {
    id: p.id,
    label: p.label,
    model: {
      kind: p.model.kind === 'manual' ? 'manual' : 'auto',
      provider: typeof p.model.provider === 'string' ? p.model.provider : '',
      model: typeof p.model.model === 'string' ? p.model.model : '',
    },
    maxDepth: p.maxDepth,
    backgroundMode: p.backgroundMode === 'one-shot' ? 'one-shot' : 'continuable',
    builtin: p.builtin === true,
  }
}

/** Derive agentOptions from a profile's model selection. */
export function agentOptionsFor(profile: SubagentProfile): { readonly agentOptions?: AgentOptions } {
  if (profile.model.kind === 'auto') return {}
  return { agentOptions: { provider: profile.model.provider, model: profile.model.model } }
}

/** Validate a profile id: lowercase letters, digits, hyphens; 1–32 chars. */
export function isValidProfileId(id: string): boolean {
  return /^[a-z0-9-]{1,32}$/.test(id)
}
