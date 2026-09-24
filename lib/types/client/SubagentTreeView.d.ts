/**
 * SubagentTreeView — a `conversation.view` entry showing the root session's
 * full subagent tree (all depths) with live progress.
 *
 * dsh 0.1.7-rc.1 replaced the client-side `subagentsByParent` catalog with the
 * host-computed `subagentCatalog` projection (one direct-children list per
 * session) and moved Session navigation to the ui-workspace navigation
 * service. This view reads the projection store through the standard
 * `useSessions` hook and recurses through each discovered child's own catalog,
 * refreshing a session's projections on first sight.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/client/SubagentTreeView
 */
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SubagentAddress } from '@deepseek-ai/dsh-subagent/client';
export type SubagentTreeViewInjected = {
    /** Resolve a profile id to its display label; undefined if unknown. */
    profileLabelOf: (id: string) => string | undefined;
    /** Open a child session's conversation. */
    openChild: (childId: SessionId) => void;
    /** Re-read a session's projections from the host. */
    refreshProjection: (sessionId: SessionId) => void;
    /** Resolve a durable direct-parent address for an already discovered child. */
    subagentAddress: (id: SessionId) => SubagentAddress | undefined;
};
/** Full props: conversation-view runtime share + locale seat + navigation inject. */
type SubagentTreeViewProps = ConvViewProps & PropsLocale<'ya-subagent'> & InjectFace<SubagentTreeViewInjected>;
/**
 * Render the subagent tree view. Always shows the ROOT session's full tree;
 * highlights the current session if it is a subagent.
 * @param props - conversation-view runtime share + locale seat + navigation inject.
 * @returns the tree tab body.
 */
export declare function SubagentTreeView({ sessionId, useSessions, subagentAddress, profileLabelOf, openChild, refreshProjection, t }: SubagentTreeViewProps): import("react").JSX.Element;
export {};
