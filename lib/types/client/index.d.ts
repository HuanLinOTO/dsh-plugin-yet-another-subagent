/**
 * yet-another-subagent — browser half.
 *
 * Single bundle, dual entry: this is the client half (exports `./client`).
 * Host half ships via `.` (see `src/index.ts`).
 *
 * Two registrations:
 *   1. `settings.section` slot — the profile editor page (SettingsPage).
 *   2. `tool.call.toolview` keyed slot, key `subagent` — the live toolcall
 *      card (SubagentCard). A single key covers all profiles because the
 *      tool name is always `subagent`; the profile is a call parameter.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type YaSubagentKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The subagent settings page + tool card copy. */
        'ya-subagent': YaSubagentKey;
    }
}
/** Required services: settings/tool slots, locale, sessions, connection. */
export declare const inject: string[];
/**
 * Client plugin body: register settings page + single `subagent` toolview slot.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
