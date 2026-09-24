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

import { useEffect } from 'react'
import type { ToolCallViewProps, StartedToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { YaSubagentProgressProjection, SubagentProfileProjection } from '../projection.ts'
import css from './SubagentCard.module.css'

/** Inject face: profile label lookup plus session navigation/invalidation actions. */
export type SubagentCardInjected = {
  /** Resolve a profile id to its display label; undefined if unknown. */
  profileLabelOf: (id: string) => string | undefined
  /** Open a child session's conversation. */
  openChild: (childId: SessionId) => void
  /** Re-read a session's projections from the host. */
  refreshProjection: (sessionId: SessionId) => void
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

/** The settled result node's content, without a phase discriminant. */
type SettledBlock = StartedToolCallViewProps['block']

/**
 * Parse a settled block's content for:
 *   - background:  `started background subagent task <taskId>`
 *   - continuable: `started <profileLabel> subagent <subagentId>`
 *   - foreground:  `completed <profileLabel> subagent <runId>\n<output>`
 *   - foreground (legacy): plain output text (no embedded id, not clickable)
 */
function parseResult(block: SettledBlock): ResultView {
  if (!('kind' in block)) return {} // start phase; no result yet
  const texts: string[] = []
  for (const item of block.content) {
    if (item.type !== 'text') continue
    // Background (one-shot task): `started background subagent task <taskId>`
    // The taskId is not the child session id; the child id comes from the
    // subagentProfile projection. Return empty so the card relies on it.
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

/** Extract the `profile` parameter from a settled block's raw arguments. */
function readProfileArg(block: SettledBlock): string | undefined {
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

type CardState = 'preparing' | 'running' | 'completed' | 'child-running' | 'child-idle'

/**
 * Render one `subagent` tool call as a compact live card.
 * @param props - keyed toolview payload + locale seat + navigation inject.
 * @returns the dedicated subagent card.
 */
export function SubagentCard(props: SubagentCardProps) {
  if (props.phase === 'preparing') return <PreparingRow toolName={props.toolName} t={props.t} />
  return <SettledCard {...props} />
}

/** Argument-free row shown while the call's arguments are still streaming. */
function PreparingRow({ toolName, t }: { readonly toolName: string; readonly t: SubagentCardProps['t'] }) {
  return (
    <div className={css.card} data-tool={toolName} data-state="preparing">
      <div className={css.header}>
        <span className={css.stateDot} aria-hidden />
        <span className={css.title}>{toolName}</span>
        <span className={css.stateBadge}>{t('card.starting')}</span>
      </div>
    </div>
  )
}

/**
 * Start/result stages of one `subagent` call.
 * @param props - start/result toolview payload + locale seat + navigation inject.
 * @returns the live card.
 */
function SettledCard({ block, callId, toolName, profileLabelOf, openChild, refreshProjection, useSessions, useProjection, t }: StartedToolCallViewProps & PropsLocale<'ya-subagent'> & InjectFace<SubagentCardInjected>) {
  const result = parseResult(block)
  // Parent-session projection: resolves a running call's childId before the
  // result text embeds it.
  const profileProjection = useProjection('subagentProfile') as SubagentProfileProjection | undefined
  const projectedChildId = profileProjection?.calls?.[callId]
  const childId = (result.subagentId ?? projectedChildId) as SessionId | undefined
  const profileId = readProfileArg(block)
  const profileLabel = result.profileLabel
    ?? (profileId !== undefined ? profileLabelOf(profileId) : undefined)
    ?? toolName

  // Child progress is read from the session list's per-session projection
  // store (push frames land there whether or not the child is instantiated).
  const progress = useSessions(
    (state) => childId === undefined
      ? undefined
      : state.projectionsBySession[childId]?.values.yaSubagentProgress as YaSubagentProgressProjection | undefined,
  )

  // Load the child's projections once the child id is known.
  useEffect(() => {
    if (childId !== undefined) refreshProjection(childId)
  }, [childId, refreshProjection])

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

  const stateLabel = t(`card.${cardState}`)
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
      onClick={clickable ? () => { if (childId !== undefined) openChild(childId) } : undefined}
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
