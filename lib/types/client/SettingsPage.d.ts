/**
 * SettingsPage — the `ya-subagent` settings section: profile list CRUD.
 *
 * Visual language: matches ModelsSection / GeneralSection — outlined rowCard
 * per profile (border-l2, r12, p12/14), filled editor surface
 * (bg-module-platform, r12, p14/16), capsule controls (h36 r18 primary,
 * h28 r14 secondary), 32px fields with border-l2 / bg-layer-1, 12/18 caption
 * labels. Every color resolves through --dsw-alias-* tokens.
 *
 * Each profile card is collapsible (chevron in the row head); the editor
 * surface is hidden when collapsed. Builtin profiles (cordis.yml seed) carry
 * a `builtin`/`内置` badge next to the title. The "+ Add subagent" button at
 * the bottom reveals an inline draft card with all fields editable (including
 * id) and Create / Cancel actions.
 *
 * The persona field is a radio (inherit deployment persona vs custom text);
 * the textarea is shown only when custom. The tool filter is a select
 * (none / allow / deny); a multi-select dropdown is shown only when allow or
 * deny is picked, populated from `tools.list` (the host's current
 * `ctx.tools.schemas()`).
 *
 * Pulls the profile list once on mount via `connection.rpc.call('/ya-subagent',
 * 'profiles.list')`, dispatches add/update/remove through the
 * same RPC. The toolview slot is keyed by `subagent` and registered once at
 * plugin load, so profile mutations do not need to re-register slots.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/client/SettingsPage
 */
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client';
import type { SubagentProfile } from '../types.ts';
/** Inject face: RPC handle + locale translate. */
export interface YaSubagentSettingsInjected {
    readonly rpc: ClientConnectionRpc;
    /** Refetch the profile list from the host. */
    readonly fetchProfiles: () => Promise<readonly SubagentProfile[]>;
    /** Bound locale translator for the ya-subagent namespace. */
    readonly t: (key: string) => string;
}
/** Full props: settings.section runtime share + locale seat + inject. */
type SettingsPageProps = PropsRuntime<'settings.section'> & PropsLocale<'ya-subagent'> & YaSubagentSettingsInjected;
/**
 * Render the subagent profiles settings page.
 * @param props - settings.section runtime share + locale + inject.
 * @returns the page element.
 */
export declare function SettingsPage({ rpc, fetchProfiles, t }: SettingsPageProps): import("react").JSX.Element;
export {};
