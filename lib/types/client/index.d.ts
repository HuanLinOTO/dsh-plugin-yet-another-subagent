/**
 * yet-another-subagent — browser half.
 *
 * Single bundle, dual entry: this is the client half (exports `./client`).
 * Host half ships via `.` (see `src/index.ts`).
 *
 * Three registrations:
 *   1. `plugins.row.config` keyed slot — the profile editor page on the
 *      Plugins page, keyed `@huanlin/dsh-plugin-yet-another-subagent#ya-subagent`.
 *   2. `tool.call.toolview` keyed slot, key `subagent` — the live toolcall
 *      card (SubagentCard). A single key covers all profiles because the
 *      tool name is always `subagent`; the profile is a call parameter.
 *   3. `conversation.view` list slot — the session's subagent tree tab.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type YaSubagentKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The subagent settings page + tool card copy. */
        'ya-subagent': YaSubagentKey;
    }
}
/** Required services: settings/tool slots, locale, sessions, connection, workspace navigation. */
export declare const inject: string[];
/**
 * Client plugin body: register the profile editor + the `subagent` toolview.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
