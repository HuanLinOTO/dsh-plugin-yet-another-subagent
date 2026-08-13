/**
 * RPC handler: profile list CRUD + tool list over a dedicated Connection RPC channel.
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
 * @module @huanlin/dsh-plugin-yet-another-subagent/rpc
 */

import type { Context } from '@deepseek-ai/cordis'
// Type import triggers `declare module '@deepseek-ai/cordis'` merge for `ctx.connection`.
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

/** Dedicated RPC channel owned by this plugin. */
export const YA_SUBAGENT_RPC_CHANNEL = '/ya-subagent'

/** Build an RPC ok branch. */
function ok(value: YaSubagentValue): RpcResult<YaSubagentValue> {
  return { ok: true, value }
}

/** Build an RPC error branch using the closed `internal` code (no plugin-specific code). */
function fail(message: string): RpcResult<YaSubagentValue> {
  return { ok: false, error: { code: 'internal', message, details: {} } }
}

/**
 * Register the ya-subagent RPC handler on its own channel.
 *
 * The shared `/api` channel already has exactly one interceptor: DSH's Typert
 * gateway, which serves built-in endpoints such as `commands/execute` and
 * `pluginInventory/list`. Connection rejects a second interceptor, so this
 * plugin must use `rpc.handle()` rather than competing for `/api`.
 * @param ctx - host context.
 * @param store - profile store.
 */
export function registerRpc(ctx: Context, store: ProfileStore): void {
  ctx.logger.info(`ya-subagent: registering RPC handler on ${YA_SUBAGENT_RPC_CHANNEL} channel`)
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
      YA_SUBAGENT_RPC_CHANNEL,
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
