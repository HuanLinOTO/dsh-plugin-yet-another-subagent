/**
 * RPC surface: profile list CRUD + tool list + session repair, exposed as
 * exact Fetch routes on the shared `/api` channel via
 * `ctx.connection.fetch.register(...)`.
 *
 * Why not a dedicated `rpc.handle` channel: the host-side dedicated-channel
 * registry resolves `webServer` through the connection service's origin
 * context chain, and the web profile mounts the webserver as a sibling
 * loader row — never an ancestor of client-connection — so every dedicated
 * channel fails to register with `cannot get property "webServer" without
 * inject`. Exact Fetch routes dispatch inside the already-mounted `/api`
 * carrier instead (the dsh-client-file-upload pattern), inheriting its
 * Host/Origin trust fence and browser authentication for free, and the
 * shared `/api` interceptor slot stays owned by the Typert gateway.
 *
 * Wire endpoints (all POST; URL path `/api/ya-subagent.<endpoint>`, body and
 * response use the Connection client-request / server-response envelopes):
 *   - `ya-subagent.profiles.list`    payload: {}                            → { profiles: SubagentProfile[] }
 *   - `ya-subagent.profiles.add`     payload: { profile: SubagentProfile }  → { profiles: ... } | error
 *   - `ya-subagent.profiles.update`  payload: { profile: SubagentProfile }  → { profiles: ... } | error
 *   - `ya-subagent.profiles.remove`  payload: { id: string }                → { profiles: ... } | error
 *   - `ya-subagent.tools.list`       payload: {}                            → { tools: { name, description }[] }
 *   - `ya-subagent.sessions.repair`  payload: {}                            → RepairStats | error
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
import { API_PATH } from '@deepseek-ai/dsh-client-connection'
import type { ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection'
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

/** Endpoint names served below `/api`; the wire method is `ya-subagent.<name>`. */
const ENDPOINTS = [
  'profiles.list',
  'profiles.add',
  'profiles.update',
  'profiles.remove',
  'tools.list',
  'sessions.repair',
] as const

/** Build an RPC ok branch. */
function ok(value: YaSubagentValue): ConnectionRpcResult<YaSubagentValue> {
  return { ok: true, value }
}

/** Build an RPC error branch using the closed `internal` code (no plugin-specific code). */
function fail(message: string): ConnectionRpcResult<YaSubagentValue> {
  return { ok: false, error: { code: 'internal', message, details: {} } }
}

/** Response headers for one RPC server-response envelope. */
const ENVELOPE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
} as const

/**
 * Serialize one RPC result as a server-response envelope.
 * @param rpcId - correlation id echoed from the client request.
 * @param result - endpoint result (success value or RpcError branch).
 * @returns the JSON response.
 */
function envelopeResponse(rpcId: string, result: ConnectionRpcResult<unknown>): Response {
  return new Response(JSON.stringify({ type: 'server-response', rpcId, result }), {
    status: 200,
    headers: ENVELOPE_HEADERS,
  })
}

/** Connection client-request envelope (mirror of dsh-client-connection's wire contract). */
interface ClientRequestEnvelope {
  readonly type: 'client-request'
  readonly rpcId: string
  readonly method: string
  readonly payload: unknown
}

/**
 * Validate one request against the Connection RPC envelope and dispatch it.
 * Mirrors the host `rpcFetchHandler` semantics (method, content type, JSON
 * body, envelope fields, method-vs-path agreement) minus the trust and
 * authentication fence, which the physical `/api` carrier already applied.
 * @param endpoint - the endpoint this route owns (e.g. `ya-subagent.profiles.list`).
 * @param request - authenticated Fetch request.
 * @param dispatch - endpoint dispatcher shared by all routes.
 * @returns the response carrying the server-response envelope.
 */
async function handleEnvelopeRequest(
  endpoint: string,
  request: Request,
  dispatch: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<ConnectionRpcResult<unknown>>,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('not found', { status: 404 })
  }
  const mediaType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (mediaType !== 'application/json') {
    return new Response('content type must be application/json', { status: 415 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return new Response('body is not JSON', { status: 400 })
  }
  const envelope = body as Partial<ClientRequestEnvelope> | null
  if (envelope === null || typeof envelope !== 'object'
    || envelope.type !== 'client-request'
    || typeof envelope.rpcId !== 'string' || envelope.rpcId === ''
    || typeof envelope.method !== 'string') {
    return envelopeResponse('invalid-request', fail('invalid client-request message'))
  }
  if (envelope.method !== endpoint) {
    return envelopeResponse(envelope.rpcId, fail(
      `method ${JSON.stringify(envelope.method)} does not match endpoint ${JSON.stringify(endpoint)}`,
    ))
  }
  try {
    const result = await dispatch(endpoint, envelope.payload, request.signal)
    return envelopeResponse(envelope.rpcId, result)
  } catch (error) {
    return new Response(`handler failure: ${String(error)}`, { status: 500 })
  }
}

/**
 * Build the endpoint dispatcher over the profile store.
 * @param ctx - host context (`ctx.tools` for the tool list, `ctx.get('dshHomePath')` for repair).
 * @param store - profile store.
 * @returns the dispatcher mapping an endpoint name to its result.
 */
function createDispatcher(ctx: Context, store: ProfileStore) {
  return async (endpoint: string, payload: unknown): Promise<ConnectionRpcResult<YaSubagentValue>> => {
    switch (endpoint) {
      case 'ya-subagent.profiles.list':
        return ok({ profiles: store.list() })
      case 'ya-subagent.profiles.add': {
        const p = payload as ProfileAddPayload | undefined
        if (p === undefined || typeof p !== 'object' || p === null) return fail('payload must be { profile: SubagentProfile }')
        const result = store.add(p.profile)
        return result.ok ? ok({ profiles: result.profiles }) : fail(result.error)
      }
      case 'ya-subagent.profiles.update': {
        const p = payload as ProfileUpdatePayload | undefined
        if (p === undefined || typeof p !== 'object' || p === null) return fail('payload must be { profile: SubagentProfile }')
        const result = store.update(p.profile)
        return result.ok ? ok({ profiles: result.profiles }) : fail(result.error)
      }
      case 'ya-subagent.profiles.remove': {
        const p = payload as ProfileRemovePayload | undefined
        if (p === undefined || typeof p !== 'object' || p === null) return fail('payload must be { id: string }')
        const result = store.remove(p.id)
        return result.ok ? ok({ profiles: result.profiles }) : fail(result.error)
      }
      case 'ya-subagent.tools.list': {
        // ctx.tools is injected; schemas() returns one deep-cloned schema
        // per visible tool. We project to { name, description } only — the
        // client's multi-select dropdown needs just the name, but
        // description is included for hover/preview affordances.
        const tools = ctx.tools.schemas().map(s => ({ name: s.name, description: s.description }))
        return ok({ tools })
      }
      case 'ya-subagent.sessions.repair': {
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
  }
}

/**
 * Register the ya-subagent RPC routes on the host's connection service.
 * `connection` is provided by the host; the routes roll back with the
 * plugin fiber (each `fetch.register` disposer is collected by an effect).
 * Trust and browser authentication live on the physical `/api` carrier, so
 * the routes carry no authority options of their own.
 * @param ctx - host context.
 * @param store - profile store.
 */
export function registerRpc(ctx: Context, store: ProfileStore): void {
  ctx.logger.info('ya-subagent: connection service available, registering /api/ya-subagent.* Fetch routes')
  ctx.inject(['connection'], (rpcCtx) => {
    const connection = rpcCtx.connection as {
      readonly fetch: {
        readonly register: (route: {
          readonly path: string
          readonly methods: readonly ('GET' | 'HEAD' | 'POST')[]
          readonly requestBody: 'buffered' | 'streaming'
          readonly fetch: (request: Request) => Promise<Response>
        }) => () => Promise<void>
      }
    }
    const dispatch = createDispatcher(rpcCtx, store)
    for (const endpoint of ENDPOINTS) {
      const wireEndpoint = `ya-subagent.${endpoint}`
      const path = `${API_PATH}/${wireEndpoint}`
      rpcCtx.effect(
        () => connection.fetch.register({
          path,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: request => handleEnvelopeRequest(wireEndpoint, request, dispatch),
        }),
        `ya-subagent: ${path} Fetch route`,
      )
    }
  })
}
