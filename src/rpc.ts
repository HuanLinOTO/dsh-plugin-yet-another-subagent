/**
 * RPC handler: profile list CRUD + tool list on a dedicated `/ya-subagent`
 * channel registered via `ctx.connection.rpc.handle('/ya-subagent', ...)`.
 *
 * A dedicated channel avoids the single-interceptor limit on the shared `/api`
 * channel (the Typert gateway owns that slot; staking it here would shadow
 * `commands/execute` and every other `/api` endpoint).
 *
 * Endpoints (all POST, payload shape noted):
 *   - `profiles.list`   payload: {}                          → { profiles: SubagentProfile[] }
 *   - `profiles.add`    payload: { profile: SubagentProfile } → { profiles: ... } | error
 *   - `profiles.update` payload: { profile: SubagentProfile } → { profiles: ... } | error
 *   - `profiles.remove` payload: { id: string }              → { profiles: ... } | error
 *   - `tools.list`      payload: {}                          → { tools: { name, description }[] }
 *
 * Returns the existing RpcResult shape; business errors use the `internal`
 * code with a descriptive message (the RpcError code union is closed; we do
 * not extend it for plugin-specific failures — see design doc §3.5).
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/rpc
 */

import type { Context } from 'cordis'
// Value import triggers `declare module 'cordis'` merge for `ctx.connection`.
import type {} from '@deepseek-ai/dsh-client-connection'
import type { RpcResult } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { SubagentProfile } from './types.ts'
import type { ProfileStore } from './profile-store.ts'
import { repairSessions, type RepairStats } from './repair.ts'

/** Wire shape for `profiles.list` responses. */
export interface ProfileListResponse {
  readonly profiles: readonly SubagentProfile[]
}

/** Wire shape for `tools.list` responses. */
export interface ToolListResponse {
  readonly tools: readonly { readonly name: string; readonly description: string }[]
}

/** Wire shape for `profiles.add` request payload. */
export interface ProfileAddPayload {
  readonly profile: SubagentProfile
}

/** Wire shape for `profiles.update` request payload. */
export interface ProfileUpdatePayload {
  readonly profile: SubagentProfile
}

/** Wire shape for `profiles.remove` request payload. */
export interface ProfileRemovePayload {
  readonly id: string
}

/** All ya-subagent RPC endpoint result values. */
export type YaSubagentValue = ProfileListResponse | ToolListResponse | RepairStats

/** Build an RPC ok branch. */
function ok(value: YaSubagentValue): RpcResult<YaSubagentValue> {
  return { ok: true, value }
}

/** Build an RPC error branch using the closed `internal` code (no plugin-specific code). */
function fail(message: string): RpcResult<YaSubagentValue> {
  return { ok: false, error: { code: 'internal', message, details: {} } }
}

/**
 * Register the ya-subagent RPC channel on the host's connection service.
 * `connection` is in the plugin's inject list, so `ctx.connection` is
 * directly available; the channel route rolls back on fiber disposal
 * (the inner `owner.effect` owns cleanup).
 * @param ctx - host context.
 * @param store - profile store.
 */
export function registerRpc(ctx: Context, store: ProfileStore): void {
  ctx.logger.info('ya-subagent: connection service available, registering RPC channel /ya-subagent')
  const connection = ctx.connection as {
      readonly rpc: {
        readonly handle: (
          channel: string,
          handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<RpcResult<unknown>>,
          options: { readonly authority: 'trusted-host' | 'loopback' },
        ) => unknown
      }
    }
    connection.rpc.handle(
      '/ya-subagent',
      async (endpoint, payload) => {
        switch (endpoint) {
          case 'profiles.list':
            return ok({ profiles: store.list() })
          case 'profiles.add': {
            const p = payload as ProfileAddPayload | undefined
            if (p === undefined || typeof p !== 'object' || p === null) return fail('payload must be { profile: SubagentProfile }')
            const result = store.add(p.profile)
            return result.ok ? ok({ profiles: result.profiles }) : fail(result.error)
          }
          case 'profiles.update': {
            const p = payload as ProfileUpdatePayload | undefined
            if (p === undefined || typeof p !== 'object' || p === null) return fail('payload must be { profile: SubagentProfile }')
            const result = store.update(p.profile)
            return result.ok ? ok({ profiles: result.profiles }) : fail(result.error)
          }
          case 'profiles.remove': {
            const p = payload as ProfileRemovePayload | undefined
            if (p === undefined || typeof p !== 'object' || p === null) return fail('payload must be { id: string }')
            const result = store.remove(p.id)
            return result.ok ? ok({ profiles: result.profiles }) : fail(result.error)
          }
          case 'tools.list': {
            // ctx.tools is injected; schemas() returns one deep-cloned schema
            // per visible tool. We project to { name, description } only — the
            // client's multi-select dropdown needs just the name, but
            // description is included for hover/preview affordances.
            const tools = ctx.tools.schemas().map(s => ({ name: s.name, description: s.description }))
            return ok({ tools })
          }
          case 'sessions.repair': {
            // Resolve $DSH_HOME/sessions via the host-provided `dshHomePath`
            // (app-boot provides it). Fall back to the env-driven resolver if
            // the provider is absent (headless / test assemblies).
            const dshHomePath = ctx.get('dshHomePath') as ((...segs: string[]) => string) | undefined
            const sessionsRoot = dshHomePath !== undefined
              ? dshHomePath('sessions')
              : undefined
            if (sessionsRoot === undefined) {
              return fail('dshHomePath provider unavailable; cannot resolve sessions root')
            }
            try {
              const stats = await repairSessions(sessionsRoot)
              return ok(stats)
            } catch (err) {
              return fail(`session repair failed: ${err instanceof Error ? err.message : String(err)}`)
            }
          }
          default:
            return fail(`unknown endpoint: ${endpoint}`)
        }
      },
      { authority: 'trusted-host' },
    )
}
