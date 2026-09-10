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
import type { Context } from 'cordis';
import type { SubagentProfile } from './types.ts';
import type { ProfileStore } from './profile-store.ts';
import { type RepairStats } from './repair.ts';
/** Wire shape for `profiles.list` responses. */
export interface ProfileListResponse {
    readonly profiles: readonly SubagentProfile[];
}
/** Wire shape for `tools.list` responses. */
export interface ToolListResponse {
    readonly tools: readonly {
        readonly name: string;
        readonly description: string;
    }[];
}
/** Wire shape for `profiles.add` request payload. */
export interface ProfileAddPayload {
    readonly profile: SubagentProfile;
}
/** Wire shape for `profiles.update` request payload. */
export interface ProfileUpdatePayload {
    readonly profile: SubagentProfile;
}
/** Wire shape for `profiles.remove` request payload. */
export interface ProfileRemovePayload {
    readonly id: string;
}
/** All ya-subagent RPC endpoint result values. */
export type YaSubagentValue = ProfileListResponse | ToolListResponse | RepairStats;
/**
 * Register the ya-subagent RPC routes on the host's connection service.
 * `connection` is provided by the host; the routes roll back with the
 * plugin fiber (each `fetch.register` disposer is collected by an effect).
 * Trust and browser authentication live on the physical `/api` carrier, so
 * the routes carry no authority options of their own.
 * @param ctx - host context.
 * @param store - profile store.
 */
export declare function registerRpc(ctx: Context, store: ProfileStore): void;
