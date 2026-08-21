/**
 * SubagentCard — the model-facing toolcall card for the `subagent` tool.
 *
 * Three display branches:
 *   1. **Running** (block is `RunningToolCall`): the tool call is in flight.
 *      Show "running" with a spinner dot; no child session to subscribe to.
 *   2. **Continuable settled** (result text matches `started <label>
 *      subagent <id>`): subscribe to the child's `yaSubagentProgress`
 *      projection for live toolcall/token counts; clickable to open.
 *   3. **Foreground settled** (result text is the child's output): the
 *      one-shot child has completed; show "completed" with an output
 *      preview. No child session survives.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/client/SubagentCard
 */
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
/** Sessions service shape consumed by this card (narrow face of ISessions). */
export interface SubagentCardSessions {
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
}
/** Inject face: the sessions service handle + profile label lookup. */
export type SubagentCardInjected = {
    sessions: SubagentCardSessions;
    /** Resolve a profile id to its display label; undefined if unknown. */
    profileLabelOf: (id: string) => string | undefined;
};
/** Full props: toolview runtime share + this package's locale seat + inject. */
type SubagentCardProps = ToolCallViewProps & PropsLocale<'ya-subagent'> & InjectFace<SubagentCardInjected>;
/**
 * Render one `subagent` tool call as a compact live card.
 * @param props - keyed toolview payload + locale seat + sessions inject.
 * @returns the dedicated subagent card.
 */
export declare function SubagentCard({ block, callId, toolName, sessionId, sessions, profileLabelOf, t }: SubagentCardProps): import("react").JSX.Element;
export {};
