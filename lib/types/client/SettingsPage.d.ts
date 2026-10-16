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
 * Persona and tool-filter editing were removed with dsh 0.2.1-alpha.5
 * (DSH-0.2.1-J1-05): the subagent start request no longer carries `persona`
 * (agent presets own it) or `toolFilter` (removed).
 *
 * Pulls the profile list once on mount via `connection.rpc.call('/api',
 * 'ya-subagent.profiles.list')`, dispatches add/update/remove through the
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
    /** Refetch the routable model catalog (provider groups); undefined on failure. */
    readonly fetchModelCatalog: () => Promise<ModelCatalogData | undefined>;
    /** Bound locale translator for the ya-subagent namespace. */
    readonly t: (key: string) => string;
}
/** Full props: plugins.row.config runtime share + locale seat + inject. */
type SettingsPageProps = PropsRuntime<'plugins.row.config'> & PropsLocale<'ya-subagent'> & YaSubagentSettingsInjected;
/** One model inside a provider group (mirrors `ModelCatalogModel`). */
interface ModelEntry {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
}
/** One provider group (mirrors `ModelProviderGroup`). */
interface ModelGroup {
    readonly id: string;
    readonly name: string;
    readonly models: readonly ModelEntry[];
}
/** Model catalog wire shape (mirror of the host `ModelCatalog` read face). */
interface ModelCatalogData {
    readonly groups: readonly ModelGroup[];
}
/**
 * Render the subagent profiles settings page.
 * @param props - plugins.row.config runtime share + locale + inject.
 * @returns the page element (summary one-liner for `view: 'summary'`).
 */
export declare function SettingsPage({ view, rpc, fetchProfiles, fetchModelCatalog, t }: SettingsPageProps): import("react").JSX.Element;
export {};
