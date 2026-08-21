/**
 * Profile data model for yet-another-subagent.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/types
 */
import type { AgentOptions } from '@deepseek-ai/dsh-agent';
/** A model-facing tool name is `subagent_<id>`. */
export interface SubagentProfile {
    /** Unique id; lowercase letters, digits, hyphens; 1–32 chars. Used as `subagent_<id>`. */
    readonly id: string;
    /** Display name (nav label / card title). */
    readonly label: string;
    /**
     * Model selection. `kind: 'auto'` inherits the parent model (provider/model
     * are ignored); `kind: 'manual'` pins a specific provider/model.
     */
    readonly model: {
        readonly kind: 'auto' | 'manual';
        readonly provider: string;
        readonly model: string;
    };
    /**
     * Persona selection. `kind: 'inherit'` omits the per-child persona so the
     * child uses the deployment `system-prompt` persona (same as the official
     * `tool-subagent` default when no `persona` is configured). `kind: 'custom'`
     * shadows the deployment persona with the provided text.
     */
    readonly persona: {
        readonly kind: 'inherit';
    } | {
        readonly kind: 'custom';
        readonly text: string;
    };
    /**
     * Tool filter selection. `kind: 'none'` applies no filter (child sees every
     * visible global tool). `kind: 'allow'` keeps only the named tools;
     * `kind: 'deny'` removes the named tools. The chosen tools are only sent to
     * the provider when `kind` is not `'none'`.
     */
    readonly toolFilter: {
        readonly kind: 'none';
    } | {
        readonly kind: 'allow';
        readonly tools: readonly string[];
    } | {
        readonly kind: 'deny';
        readonly tools: readonly string[];
    };
    /** Maximum delegation depth (non-negative safe integer); default 3. */
    readonly maxDepth: number;
    /**
     * Background policy when `run_in_background: true` is set. `'continuable'`
     * (default, matches the base bundle) starts a background subagent that keeps
     * its conversation — the caller receives only its subagent id and sends more
     * work via `send_message`. `'one-shot'` starts a background task that returns
     * a job id — the caller collects the result with `job_output` and stops it
     * with `job_kill`.
     */
    readonly backgroundMode: 'continuable' | 'one-shot';
    /**
     * Whether this profile is part of the bundle seed (cordis.patch.yml) and
     * therefore labelled `builtin` in the UI. User-added profiles are `false`.
     * Builtin profiles can still be edited or removed (unless `generalFixed`
     * protects them); the flag is purely a presentation hint.
     */
    readonly builtin: boolean;
}
/** Top-level config. */
export interface YaSubagentConfig {
    /** Initial profile list (cordis.yml layer). Runtime mutations live in memory only. */
    readonly profiles: readonly SubagentProfile[];
    /** When true, the `general` profile cannot be removed. */
    readonly generalFixed: boolean;
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
export declare function migrateProfile(input: unknown): SubagentProfile;
/** Derive agentOptions from a profile's model selection. */
export declare function agentOptionsFor(profile: SubagentProfile): {
    readonly agentOptions?: AgentOptions;
};
/**
 * Project the persona field onto the request shape: `undefined` for `inherit`
 * (omit the field so the child uses the deployment persona) and the text for
 * `custom`.
 */
export declare function personaForRequest(profile: SubagentProfile): {
    readonly persona?: string;
};
/**
 * Project the toolFilter field onto the request shape: `undefined` for `none`
 * (omit the field so the child sees every visible tool) and the allow/deny
 * pair for `allow`/`deny`.
 */
export declare function toolFilterForRequest(profile: SubagentProfile): {
    readonly toolFilter?: {
        readonly allow?: readonly string[];
        readonly deny?: readonly string[];
    };
};
/** Validate a profile id: lowercase letters, digits, hyphens; 1–32 chars. */
export declare function isValidProfileId(id: string): boolean;
