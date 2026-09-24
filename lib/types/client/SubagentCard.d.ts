/**
 * SubagentCard — the model-facing toolcall card for the `subagent` tool.
 *
 * dsh 0.1.7-rc.1 (`DSH-0.1.7-RC1-23`) split the toolview owner props into an
 * explicit `phase` union: `'preparing'` (no dispatched arguments),
 * `'start'` (arguments available), and `'result'` (settled). This card renders
 * a lightweight argument-free row while preparing, then branches on the
 * durable result content:
 *   1. **Running** (`phase: 'start'`): the call is dispatched and in flight.
 *   2. **Continuable settled** (text `started <label> subagent <id>`): live
 *      child progress from the `yaSubagentProgress` projection; clickable.
 *   3. **Foreground settled** (text is the child's output): completed with an
 *      output preview.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/client/SubagentCard
 */
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** Inject face: profile label lookup plus session navigation/invalidation actions. */
export type SubagentCardInjected = {
    /** Resolve a profile id to its display label; undefined if unknown. */
    profileLabelOf: (id: string) => string | undefined;
    /** Open a child session's conversation. */
    openChild: (childId: SessionId) => void;
    /** Re-read a session's projections from the host. */
    refreshProjection: (sessionId: SessionId) => void;
};
/** Full props: toolview runtime share + this package's locale seat + inject. */
type SubagentCardProps = ToolCallViewProps & PropsLocale<'ya-subagent'> & InjectFace<SubagentCardInjected>;
/**
 * Render one `subagent` tool call as a compact live card.
 * @param props - keyed toolview payload + locale seat + navigation inject.
 * @returns the dedicated subagent card.
 */
export declare function SubagentCard(props: SubagentCardProps): import("react").JSX.Element;
export {};
