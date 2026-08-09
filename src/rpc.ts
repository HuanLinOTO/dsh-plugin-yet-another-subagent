/**
 * RPC handler: profile list CRUD + tool list over `ctx.connection.rpc.intercept('/api', ...)`.
 *
 * Endpoints (all POST, payload shape noted):
 *   - `ya-subagent/profiles.list`   payload: {}                          → { profiles: SubagentProfile[] }
 *   - `ya-subagent/profiles.add`    payload: { profile: SubagentProfile } → { profiles: ... } | error
 *   - `ya-subagent/profiles.update` payload: { profile: SubagentProfile } → { profiles: ... } | error
 *   - `ya-subagent/profiles.remove` payload: { id: string }              → { profiles: ... } | error
 *   - `ya-subagent/tools.list`      payload: {}                          → { tools: { name, description }[] }
 *
 * Returns the existing RpcResult shape; business errors use the `internal`
 * code with a descriptive message (the RpcError code union is closed; we do
 * not extend it for plugin-specific failures — see design doc §3.5).
 *
 * @module @dsh-external/yet-another-subagent/rpc
 */

import type { Context } from 'cordis'
// Value import triggers `declare module 'cordis'` merge for `ctx.connection`.
import type {} from '@deepseek-ai/dsh-client-connection'
import type { RpcResult } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { SubagentProfile } from './types.ts'
import type { ProfileStore } from './profile-store.ts'

/** Wire shape for `ya-subagent/profiles.list` responses. */
export interface ProfileListResponse {
  readonly profiles: readonly SubagentProfile[]
}

/** Wire shape for `ya-subagent/tools.list` responses. */
export interface ToolListResponse {
  readonly tools: readonly { readonly name: string; readonly description: string }[]
}

/** Wire shape for `ya-subagent/profiles.add` request payload. */
export interface ProfileAddPayload {
  readonly profile: SubagentProfile
}

/** Wire shape for `ya-subagent/profiles.update` request payload. */
export interface ProfileUpdatePayload {
  readonly profile: SubagentProfile
}

/** Wire shape for `ya-subagent/profiles.remove` request payload. */
export interface ProfileRemovePayload {
  readonly id: string
}

/** All ya-subagent RPC endpoint result values. */
export type YaSubagentValue = ProfileListResponse | ToolListResponse

const ENDPOINT_PREFIX = 'ya-subagent/'

/** Test whether one endpoint belongs to this plugin. */
export function ownsEndpoint(endpoint: string): boolean {
  return endpoint.startsWith(ENDPOINT_PREFIX)
}

/** Build an RPC ok branch. */
function ok(value: YaSubagentValue): RpcResult<YaSubagentValue> {
  return { ok: true, value }
}

/** Build an RPC error branch using the closed `internal` code (no plugin-specific code). */
function fail(message: string): RpcResult<YaSubagentValue> {
  return { ok: false, error: { code: 'internal', message, details: {} } }
}

/**
 * Register the ya-subagent RPC interceptor on the host's `/api` channel.
 * Uses `ctx.inject(['connection'], ...)` so the interceptor installs when
 * the connection service is ready and rolls back automatically on fiber
 * disposal (the inner `owner.effect` owns cleanup).
 * @param ctx - host context.
 * @param store - profile store.
 */
export function registerRpc(ctx: Context, store: ProfileStore): void {
  ctx.logger.info('ya-subagent: connection service available, registering RPC interceptor')
  const connection = ctx.connection as {
      readonly rpc: {
        readonly intercept: (
          channel: '/api',
          matches: (endpoint: string) => boolean,
          handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<RpcResult<unknown>>,
          options: { readonly authority: 'trusted-host' | 'loopback' },
        ) => unknown
      }
    }
    connection.rpc.intercept(
      '/api',
      ownsEndpoint,
      async (endpoint, payload) => {
        switch (endpoint) {
          case 'ya-subagent/profiles.list':
            return ok({ profiles: store.list() })
          case 'ya-subagent/profiles.add': {
            const p = payload as ProfileAddPayload | undefined
            if (p === undefined || typeof p !== 'object' || p === null) return fail('payload must be { profile: SubagentProfile }')
            const result = store.add(p.profile)
            return result.ok ? ok({ profiles: result.profiles }) : fail(result.error)
          }
          case 'ya-subagent/profiles.update': {
            const p = payload as ProfileUpdatePayload | undefined
            if (p === undefined || typeof p !== 'object' || p === null) return fail('payload must be { profile: SubagentProfile }')
            const result = store.update(p.profile)
            return result.ok ? ok({ profiles: result.profiles }) : fail(result.error)
          }
          case 'ya-subagent/profiles.remove': {
            const p = payload as ProfileRemovePayload | undefined
            if (p === undefined || typeof p !== 'object' || p === null) return fail('payload must be { id: string }')
            const result = store.remove(p.id)
            return result.ok ? ok({ profiles: result.profiles }) : fail(result.error)
          }
          case 'ya-subagent/tools.list': {
            // ctx.tools is injected; schemas() returns one deep-cloned schema
            // per visible tool. We project to { name, description } only — the
            // client's multi-select dropdown needs just the name, but
            // description is included for hover/preview affordances.
            const tools = ctx.tools.schemas().map(s => ({ name: s.name, description: s.description }))
            return ok({ tools })
          }
          default:
            return fail(`unknown endpoint: ${endpoint}`)
        }
      },
      { authority: 'trusted-host' },
    )
}
