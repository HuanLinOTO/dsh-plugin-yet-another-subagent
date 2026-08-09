/**
 * Profile data model for yet-another-subagent.
 *
 * @module @dsh-external/yet-another-subagent/types
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
   * Persona selection. `kind: 'inherit'` omits the per-child persona so the
   * child uses the deployment `system-prompt` persona (same as the official
   * `tool-subagent` default when no `persona` is configured). `kind: 'custom'`
   * shadows the deployment persona with the provided text.
   */
  readonly persona: { readonly kind: 'inherit' } | { readonly kind: 'custom'; readonly text: string }
  /**
   * Tool filter selection. `kind: 'none'` applies no filter (child sees every
   * visible global tool). `kind: 'allow'` keeps only the named tools;
   * `kind: 'deny'` removes the named tools. The chosen tools are only sent to
   * the provider when `kind` is not `'none'`.
   */
  readonly toolFilter:
    | { readonly kind: 'none' }
    | { readonly kind: 'allow'; readonly tools: readonly string[] }
    | { readonly kind: 'deny'; readonly tools: readonly string[] }
  /** Maximum delegation depth (non-negative safe integer); default 3. */
  readonly maxDepth: number
  /**
   * Background policy when `run_in_background: true` is set. `'continuable'`
   * (default, matches the base bundle) starts a background subagent that keeps
   * its conversation — the caller receives only its subagent id and sends more
   * work via `send_message`. `'one-shot'` starts a background task that returns
   * a task id — the caller collects the result with `task_output` and stops it
   * with `task_kill`.
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
 * Coerce a possibly-stale profile shape (from an older `settings.yaml` or a
 * caller that still uses the legacy `persona?: string` / `toolFilter?: { allow?, deny? }`
 * form) into the current {@link SubagentProfile} shape. Idempotent on already-
 * current shapes.
 *
 * Rules:
 *   - `persona: undefined | '' | null` → `{ kind: 'inherit' }`
 *   - `persona: string` (non-empty) → `{ kind: 'custom', text }`
 *   - `persona: { kind: 'inherit' }` → as-is
 *   - `persona: { kind: 'custom', text }` → as-is (text trimmed; empty → inherit)
 *   - `toolFilter: undefined | null` → `{ kind: 'none' }`
 *   - `toolFilter: { allow: [...], deny: [...] }` → allow wins if non-empty, else deny, else none
 *   - `toolFilter: { kind: 'none' | 'allow' | 'deny', tools? }` → as-is (tools defaulted to [])
 *   - `builtin: undefined | null` → `false`
 */
export function migrateProfile(input: unknown): SubagentProfile {
  const p = input as Partial<SubagentProfile> & {
    persona?: unknown
    toolFilter?: unknown
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
    persona: migratePersona(p.persona),
    toolFilter: migrateToolFilter(p.toolFilter),
    maxDepth: p.maxDepth,
    backgroundMode: p.backgroundMode === 'one-shot' ? 'one-shot' : 'continuable',
    builtin: p.builtin === true,
  }
}

function migratePersona(raw: unknown): SubagentProfile['persona'] {
  if (raw === undefined || raw === null) return { kind: 'inherit' }
  if (typeof raw === 'string') {
    return raw.trim() === '' ? { kind: 'inherit' } : { kind: 'custom', text: raw }
  }
  if (typeof raw === 'object' && raw !== null && typeof (raw as { kind?: unknown }).kind === 'string') {
    const k = (raw as { kind: string }).kind
    if (k === 'inherit') return { kind: 'inherit' }
    if (k === 'custom') {
      const text = typeof (raw as { text?: unknown }).text === 'string'
        ? (raw as { text: string }).text
        : ''
      return text.trim() === '' ? { kind: 'inherit' } : { kind: 'custom', text }
    }
  }
  return { kind: 'inherit' }
}

function migrateToolFilter(raw: unknown): SubagentProfile['toolFilter'] {
  if (raw === undefined || raw === null) return { kind: 'none' }
  if (typeof raw !== 'object') return { kind: 'none' }
  const obj = raw as { kind?: unknown; allow?: unknown; deny?: unknown; tools?: unknown }
  if (typeof obj.kind === 'string') {
    if (obj.kind === 'none') return { kind: 'none' }
    if (obj.kind === 'allow' || obj.kind === 'deny') {
      const tools = Array.isArray(obj.tools)
        ? obj.tools.filter((t): t is string => typeof t === 'string')
        : []
      return { kind: obj.kind, tools }
    }
  }
  // Legacy { allow?, deny? } form.
  const allow = Array.isArray(obj.allow) ? obj.allow.filter((t): t is string => typeof t === 'string') : []
  const deny = Array.isArray(obj.deny) ? obj.deny.filter((t): t is string => typeof t === 'string') : []
  if (allow.length > 0) return { kind: 'allow', tools: allow }
  if (deny.length > 0) return { kind: 'deny', tools: deny }
  return { kind: 'none' }
}

/** Derive agentOptions from a profile's model selection. */
export function agentOptionsFor(profile: SubagentProfile): { readonly agentOptions?: AgentOptions } {
  if (profile.model.kind === 'auto') return {}
  return { agentOptions: { provider: profile.model.provider, model: profile.model.model } }
}

/**
 * Project the persona field onto the request shape: `undefined` for `inherit`
 * (omit the field so the child uses the deployment persona) and the text for
 * `custom`.
 */
export function personaForRequest(profile: SubagentProfile): { readonly persona?: string } {
  return profile.persona.kind === 'custom' ? { persona: profile.persona.text } : {}
}

/**
 * Project the toolFilter field onto the request shape: `undefined` for `none`
 * (omit the field so the child sees every visible tool) and the allow/deny
 * pair for `allow`/`deny`.
 */
export function toolFilterForRequest(profile: SubagentProfile): { readonly toolFilter?: { readonly allow?: readonly string[]; readonly deny?: readonly string[] } } {
  switch (profile.toolFilter.kind) {
    case 'none':
      return {}
    case 'allow':
      return { toolFilter: { allow: profile.toolFilter.tools } }
    case 'deny':
      return { toolFilter: { deny: profile.toolFilter.tools } }
  }
}

/** Validate a profile id: lowercase letters, digits, hyphens; 1–32 chars. */
export function isValidProfileId(id: string): boolean {
  return /^[a-z0-9-]{1,32}$/.test(id)
}
