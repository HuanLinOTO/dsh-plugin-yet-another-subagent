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

import { useEffect } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { UseSessions } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SubagentAddress, SubagentCatalogEntry } from '@deepseek-ai/dsh-subagent/client'
import type { YaSubagentProgressProjection, SubagentProfileProjection } from '../projection.ts'
import css from './SubagentTreeView.module.css'

export type SubagentTreeViewInjected = {
  /** Resolve a profile id to its display label; undefined if unknown. */
  profileLabelOf: (id: string) => string | undefined
  /** Open a child session's conversation. */
  openChild: (childId: SessionId) => void
  /** Re-read a session's projections from the host. */
  refreshProjection: (sessionId: SessionId) => void
  /** Resolve a durable direct-parent address for an already discovered child. */
  subagentAddress: (id: SessionId) => SubagentAddress | undefined
}

/** Full props: conversation-view runtime share + locale seat + navigation inject. */
type SubagentTreeViewProps = ConvViewProps & PropsLocale<'ya-subagent'> & InjectFace<SubagentTreeViewInjected>

/** Walk up `subagentAddress` to find the root session id. */
function findRootSession(subagentAddress: (id: SessionId) => SubagentAddress | undefined, sessionId: SessionId): SessionId {
  let current = sessionId
  for (let i = 0; i < 32; i++) {
    const addr = subagentAddress(current)
    if (addr === undefined) return current
    current = addr.parentSessionId
  }
  return sessionId
}

/** Format token totals: >=1000 uses "k", <1000 uses plain count. */
function formatTokens(tokens: YaSubagentProgressProjection['tokens'] | undefined, t: SubagentTreeViewProps['t']): string {
  if (tokens === undefined) return `0 ${t('tree.tokens')}`
  const total = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite + tokens.reasoning
  const display = total >= 1000 ? `${(total / 1000).toFixed(1)}k` : String(total)
  return `${display} ${t('tree.tokens')}`
}

/**
 * Render the subagent tree view. Always shows the ROOT session's full tree;
 * highlights the current session if it is a subagent.
 * @param props - conversation-view runtime share + locale seat + navigation inject.
 * @returns the tree tab body.
 */
export function SubagentTreeView({ sessionId, useSessions, subagentAddress, profileLabelOf, openChild, refreshProjection, t }: SubagentTreeViewProps) {
  const rootId = findRootSession(subagentAddress, sessionId)
  const isSubagent = rootId !== sessionId
  const injected: SubagentTreeViewInjected = { profileLabelOf, openChild, refreshProjection, subagentAddress }

  return (
    <div className={css.tree}>
      {isSubagent && (
        <div className={css.rootHint}>{t('tree.rootHint')}</div>
      )}
      <CatalogLevel
        parentSessionId={rootId}
        currentSessionId={sessionId}
        depth={0}
        injected={injected}
        useSessions={useSessions}
        t={t}
      />
    </div>
  )
}

/**
 * One catalog level: the direct children of `parentSessionId`. Recurses into
 * every discovered child (each child's own `subagentCatalog` projection is
 * loaded on first sight).
 */
function CatalogLevel({
  parentSessionId,
  currentSessionId,
  depth,
  injected,
  useSessions,
  t,
}: {
  readonly parentSessionId: SessionId
  readonly currentSessionId: SessionId
  readonly depth: number
  readonly injected: SubagentTreeViewInjected
  readonly useSessions: UseSessions
  readonly t: SubagentTreeViewProps['t']
}) {
  const entries = useSessions(
    (state) => state.projectionsBySession[parentSessionId]?.values.subagentCatalog as readonly SubagentCatalogEntry[] | undefined,
  )

  // Load this session's projections once (idempotent host read).
  useEffect(() => {
    injected.refreshProjection(parentSessionId)
  }, [parentSessionId, injected.refreshProjection])

  if (entries === undefined || entries.length === 0) {
    return depth === 0 ? <div className={css.empty}>{t('tree.empty')}</div> : null
  }
  return (
    <div className={css.childList}>
      {entries.map(entry => (
        <TreeNodeView
          key={entry.id}
          entry={entry}
          parentSessionId={parentSessionId}
          currentSessionId={currentSessionId}
          depth={depth}
          injected={injected}
          useSessions={useSessions}
          t={t}
        />
      ))}
    </div>
  )
}

/** One tree node row + its children (recursively). */
function TreeNodeView({
  entry,
  parentSessionId,
  currentSessionId,
  depth,
  injected,
  useSessions,
  t,
}: {
  readonly entry: SubagentCatalogEntry
  readonly parentSessionId: SessionId
  readonly currentSessionId: SessionId
  readonly depth: number
  readonly injected: SubagentTreeViewInjected
  readonly useSessions: UseSessions
  readonly t: SubagentTreeViewProps['t']
}) {
  const progress = useSessions(
    (state) => state.projectionsBySession[entry.id]?.values.yaSubagentProgress as YaSubagentProgressProjection | undefined,
  )
  const profileId = useSessions(
    (state) => (state.projectionsBySession[parentSessionId]?.values.subagentProfile as SubagentProfileProjection | undefined)?.children[entry.id],
  )

  const isCurrent = entry.id === currentSessionId
  const state = progress?.state ?? 'idle'
  const stateLabel = t(`tree.state.${state}`)
  const toolCallCount = progress?.toolCallCount ?? 0
  const tokens = formatTokens(progress?.tokens, t)
  const label = entry.label ?? (profileId !== undefined ? injected.profileLabelOf(profileId) : undefined) ?? entry.id
  const activity = progress?.activity
  const activityText = activity === undefined
    ? undefined
    : activity.kind === 'tool'
      ? activity.args !== undefined
        ? `${activity.name} ${activity.args}`
        : `${t('tree.calling')} ${activity.name}`
      : activity.text

  return (
    <div className={css.node}>
      <div
        className={css.row}
        data-state={state}
        data-current={isCurrent || undefined}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => injected.openChild(entry.id)}
        role="button"
        tabIndex={0}
      >
        <div className={css.rowHeader}>
          <span className={css.dot} aria-hidden />
          <span className={css.label}>{label}</span>
          <span className={css.badge}>{stateLabel}</span>
        </div>
        <div className={css.rowStats}>
          <span className={css.stat}>{toolCallCount} {t('tree.toolcalls')}</span>
          <span className={css.stat}>{tokens}</span>
        </div>
        {activityText !== undefined && (
          <div className={css.activity} title={activityText}>{activityText}</div>
        )}
      </div>
      <CatalogLevel
        parentSessionId={entry.id}
        currentSessionId={currentSessionId}
        depth={depth + 1}
        injected={injected}
        useSessions={useSessions}
        t={t}
      />
    </div>
  )
}
