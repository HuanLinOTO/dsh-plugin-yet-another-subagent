/**
 * SubagentTreeView — a `conversation.view` entry showing the root session's
 * full subagent tree (all depths) with live progress.
 *
 * Uses `sessions.subagentsByParent` (the catalog) as the primary tree
 * structure source — this works for ALL depths without needing per-session
 * bindings. `setSubagentCatalogOpen` keeps catalogs auto-refreshing.
 * Projections (`yaSubagentProgress`) are used additionally when a session
 * binding is available (current session + opened children) for richer data.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/client/SubagentTreeView
 */
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
/** Catalog entry shape (narrow face of SubagentListEntry). */
interface CatalogEntry {
    readonly kind: string;
    readonly id: string;
    readonly mode?: string;
    readonly activity?: string;
    readonly hasChildren?: boolean;
    readonly label?: string;
}
/** Sessions service shape consumed by this view. */
interface TreeSessions {
    binding(id: string): {
        session: {
            projections: {
                faceOf(key: string): {
                    getSnapshot(): unknown;
                    subscribe(fn: () => void): () => void;
                } | undefined;
            };
        };
    } | undefined;
    openSubagent(address: {
        parentSessionId: string;
        childSessionId: string;
        mode: 'continuable' | 'one-shot';
    }): void;
    subagentAddress(id: string): {
        parentSessionId: string;
        childSessionId: string;
        mode: 'continuable' | 'one-shot';
    } | undefined;
    refreshSubagents(parentSessionId: string): Promise<void>;
    setSubagentCatalogOpen(parentSessionId: string, open: boolean): void;
    subagentsByParent: Readonly<Record<string, {
        entries: readonly CatalogEntry[];
        parentAvailable: boolean;
    }>>;
}
export type SubagentTreeViewInjected = {
    sessions: TreeSessions;
    profileLabelOf: (id: string) => string | undefined;
};
type SubagentTreeViewProps = ConvViewProps & PropsLocale<'ya-subagent'> & InjectFace<SubagentTreeViewInjected>;
/**
 * Render the subagent tree view. Always shows the ROOT session's full tree;
 * highlights the current session if it is a subagent.
 */
export declare function SubagentTreeView({ sessionId, sessions, profileLabelOf, t }: SubagentTreeViewProps): import("react").JSX.Element;
export {};
