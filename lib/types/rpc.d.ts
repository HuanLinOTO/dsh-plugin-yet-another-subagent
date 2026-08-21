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
 * Register the ya-subagent RPC channel on the host's connection service.
 * `connection` is in the plugin's inject list, so `ctx.connection` is
 * directly available; the channel route rolls back on fiber disposal
 * (the inner `owner.effect` owns cleanup).
 * @param ctx - host context.
 * @param store - profile store.
 */
export declare function registerRpc(ctx: Context, store: ProfileStore): void;
