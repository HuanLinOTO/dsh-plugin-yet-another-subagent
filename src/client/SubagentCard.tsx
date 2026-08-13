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

import { useEffect, useState } from 'react'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { YaSubagentProgressProjection, SubagentProfileProjection } from '../projection.ts'
import css from './SubagentCard.module.css'

/** Sessions service shape consumed by this card (narrow face of ISessions). */
export interface SubagentCardSessions {
  binding(id: string): {
    session: {
      projections: {
        faceOf(key: string): { getSnapshot(): unknown; subscribe(fn: () => void): () => void } | undefined
      }
    }
  } | undefined
  openSubagent(address: { parentSessionId: string; childSessionId: string; mode: 'continuable' | 'one-shot' }): void
  subagentAddress(id: string): { parentSessionId: string; childSessionId: string; mode: 'continuable' | 'one-shot' } | undefined
  refreshSubagents(parentSessionId: string): Promise<void>
}
/** Inject face: the sessions service handle + profile label lookup. */
export type SubagentCardInjected = {
  sessions: SubagentCardSessions
  /** Resolve a profile id to its display label; undefined if unknown. */
  profileLabelOf: (id: string) => string | undefined
}

/** Full props: toolview runtime share + this package's locale seat + inject. */
type SubagentCardProps = ToolCallViewProps & PropsLocale<'ya-subagent'> & InjectFace<SubagentCardInjected>

/** Parsed view of the durable result content. */
interface ResultView {
  readonly profileLabel?: string
  readonly subagentId?: string
  /** Whether the subagentId is a continuable child or a one-shot foreground run. */
  readonly continuable?: boolean
  /** Foreground output text (when the result is not a continuable start marker). */
  readonly output?: string
}

/** Parse `block.content` for:
 *   - background:  `started background subagent task <taskId>`
 *   - continuable: `started <profileLabel> subagent <subagentId>`
 *   - foreground:  `completed <profileLabel> subagent <runId>\n<output>`
 *   - foreground (legacy): plain output text (no embedded id, not clickable)
 */
function parseResult(block: ToolCallViewProps['block']): ResultView {
  if (!('kind' in block)) return {} // running; no result yet
  const texts: string[] = []
  for (const item of block.content) {
    if (item.type !== 'text') continue
    // Background (one-shot task): `started background subagent task <taskId>`
    // The taskId is not the child session id; the child id comes from the
    // ya-subagent/started projection event. Return empty so the card relies
    // on the projection for childId resolution.
    if (item.text.match(/^started background subagent task \S+$/) !== null) {
      return {}
    }
    // Continuable: `started <label> subagent <id>`
    const continuableMatch = item.text.match(/^started (\S+) subagent (\S+)$/)
    if (continuableMatch !== null && continuableMatch[1] !== undefined && continuableMatch[2] !== undefined) {
      return { profileLabel: continuableMatch[1], subagentId: continuableMatch[2], continuable: true }
    }
    // Foreground: `completed <label> subagent <runId>\n<output>`
    const foregroundMatch = item.text.match(/^completed (\S+) subagent (\S+)\n([\s\S]*)$/)
    if (foregroundMatch !== null && foregroundMatch[1] !== undefined && foregroundMatch[2] !== undefined && foregroundMatch[3] !== undefined) {
      return { profileLabel: foregroundMatch[1], subagentId: foregroundMatch[2], continuable: false, output: foregroundMatch[3] }
    }
    texts.push(item.text)
  }
  // Legacy foreground result: the text IS the child's output, no embedded id.
  const output = texts.join('').trim()
  return output !== '' ? { output } : {}
}

/** Extract the `profile` parameter from a running or settled block's raw arguments. */
function readProfileArg(block: ToolCallViewProps['block']): string | undefined {
  const argsRaw = 'argsRaw' in block ? block.argsRaw : block.call?.argsRaw
  if (argsRaw === undefined) return undefined
  try {
    const parsed = JSON.parse(argsRaw) as { readonly profile?: unknown }
    return typeof parsed.profile === 'string' ? parsed.profile : undefined
  } catch {
    return undefined
  }
}

/** Truncate a foreground output preview to a reasonable card line. */
function truncate(text: string, max: number): string {
  const single = text.replace(/\s+/g, ' ').trim()
  return single.length > max ? single.slice(0, max) + '…' : single
}

/** Format token totals compactly: >=1000 uses "k", <1000 uses plain count. */
function formatTokens(tokens: YaSubagentProgressProjection['tokens'] | undefined, t: SubagentCardProps['t']): string {
  if (tokens === undefined) return `0 ${t('card.tokens')}`
  const total = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite + tokens.reasoning
  const display = total >= 1000 ? `${(total / 1000).toFixed(1)}k` : String(total)
  return `${display} ${t('card.tokens')}`
}

/**
 * Subscribe to a child session's `yaSubagentProgress` projection through the
 * sessions binding face. Returns `undefined` while the binding is absent or
 * the projection has not pushed yet.
 */
function useChildProgress(
  sessions: SubagentCardSessions,
  childId: string | undefined,
): YaSubagentProgressProjection | undefined {
  const [progress, setProgress] = useState<YaSubagentProgressProjection | undefined>(undefined)
  useEffect(() => {
    if (childId === undefined) return
    const binding = sessions.binding(childId)
    if (binding === undefined) return
    const face = binding.session.projections.faceOf('yaSubagentProgress')
    if (face === undefined) return
    const snapshot = face.getSnapshot() as YaSubagentProgressProjection | undefined
    setProgress(snapshot ?? undefined)
    return face.subscribe(() => {
      const next = face.getSnapshot() as YaSubagentProgressProjection | undefined
      setProgress(next ?? undefined)
    })
  }, [sessions, childId])
  return progress
}

/**
 * Subscribe to the parent session's `subagentProfile` projection to resolve
 * a running call's childId (before the result text embeds it). Returns the
 * childId for this callId, or undefined.
 */
function useChildIdFromProjection(
  sessions: SubagentCardSessions,
  sessionId: string,
  callId: string,
): string | undefined {
  const [childId, setChildId] = useState<string | undefined>(undefined)
  useEffect(() => {
    const binding = sessions.binding(sessionId)
    if (binding === undefined) return
    const face = binding.session.projections.faceOf('subagentProfile')
    if (face === undefined) return
    const read = (): string | undefined => {
      const snap = face.getSnapshot() as SubagentProfileProjection | undefined
      return snap?.calls?.[callId]
    }
    setChildId(read())
    return face.subscribe(() => setChildId(read()))
  }, [sessions, sessionId, callId])
  return childId
}

type CardState = 'running' | 'completed' | 'child-running' | 'child-idle'

/**
 * Render one `subagent` tool call as a compact live card.
 * @param props - keyed toolview payload + locale seat + sessions inject.
 * @returns the dedicated subagent card.
 */
export function SubagentCard({ block, callId, toolName, sessionId, sessions, profileLabelOf, t }: SubagentCardProps) {
  const result = parseResult(block)
  const projectedChildId = useChildIdFromProjection(sessions, sessionId, callId)
  const childId = result.subagentId ?? projectedChildId
  const profileId = readProfileArg(block)
  const profileLabel = result.profileLabel
    ?? (profileId !== undefined ? profileLabelOf(profileId) : undefined)
    ?? toolName
  const progress = useChildProgress(sessions, childId)

  // Derive display state.
  const isRunning = !('kind' in block)
  const isContinuable = childId !== undefined
  const liveState = progress?.state

  const cardState: CardState = isRunning
    ? 'running'
    : isContinuable
      ? liveState === 'running' ? 'child-running' : 'child-idle'
      : 'completed'

  const toolCallCount = progress?.toolCallCount ?? 0
  const clickable = childId !== undefined

  const openChild = (): void => {
    if (childId === undefined) return
    const parentId = sessionId
    // Try the retained address first (mode discovered at catalog time).
    const retained = sessions.subagentAddress?.(childId)
    if (retained !== undefined) {
      try { sessions.openSubagent(retained); return } catch { /* fall through */ }
    }
    // Try both modes — the catalog entry's mode is authoritative, but we
    // don't know it without inspecting the catalog. Try continuable first
    // (the common case), then one-shot (foreground calls).
    for (const mode of ['continuable', 'one-shot'] as const) {
      try {
        sessions.openSubagent({ parentSessionId: parentId, childSessionId: childId, mode })
        return
      } catch {
        // try next mode
      }
    }
    // Both modes failed; refresh the catalog and try once more.
    void sessions.refreshSubagents(parentId).then(() => {
      const r = sessions.subagentAddress?.(childId)
      if (r !== undefined) {
        try { sessions.openSubagent(r) }
        catch (e) { console.error('[ya-subagent] openSubagent failed after refresh:', e) }
      } else {
        console.error('[ya-subagent] child not found in catalog after refresh:', childId)
      }
    }).catch((e: unknown) => {
      console.error('[ya-subagent] refreshSubagents failed:', e)
    })
  }

  const stateLabel = t(`card.${cardState}`)
  // For foreground completed calls, the result text starts with the session
  // header line (`subagent <label> session <id>`); show the output body only.
  const showOutput = cardState === 'completed' && result.output !== undefined

  // Derive the latest activity line from the unified `activity` field.
  const activity = progress?.activity
  const activityText = activity === undefined
    ? undefined
    : activity.kind === 'tool'
      ? activity.args !== undefined
        ? `${activity.name} ${activity.args}`
        : `${t('card.calling')} ${activity.name}`
      : activity.text

  return (
    <div
      className={css.card}
      data-tool={toolName}
      data-state={cardState}
      data-clickable={clickable || undefined}
      onClick={clickable ? openChild : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className={css.header}>
        <span className={css.stateDot} aria-hidden />
        <span className={css.title}>{profileLabel}</span>
        <span className={css.stateBadge}>{stateLabel}</span>
      </div>
      <div className={css.body}>
        {showOutput ? (
          <span className={css.output}>{truncate(result.output!, 200)}</span>
        ) : (
          <>
            <div className={css.stats}>
              <span className={css.stat}>{toolCallCount} {t('card.toolcalls')}</span>
              <span className={css.stat}>{formatTokens(progress?.tokens, t)}</span>
            </div>
            {activityText !== undefined && (
              <div className={css.activity} title={activityText}>{activityText}</div>
            )}
          </>
        )}
      </div>
      {clickable && (
        <div className={css.footer}>{t('card.open')}</div>
      )}
    </div>
  )
}
