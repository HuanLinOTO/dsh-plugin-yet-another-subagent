/**
 * SubagentTreeView — a `conversation.view` entry showing the root session's
 * full subagent tree (all depths) with live progress.
 *
 * Finds the root session by walking up `subagentAddress` from the current
 * session. Subscribes to each node's `subagentProfile` projection for its
 * children and `yaSubagentProgress` for live state/tokens/activity. The
 * current session (if it is a subagent) is highlighted in the tree.
 *
 * @module @dsh-external/yet-another-subagent/client/SubagentTreeView
 */

import { useEffect, useState } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { YaSubagentProgressProjection, SubagentProfileProjection } from '../projection.ts'
import css from './SubagentTreeView.module.css'

/** Sessions service shape consumed by this view. */
interface TreeSessions {
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

export type SubagentTreeViewInjected = {
  sessions: TreeSessions
  profileLabelOf: (id: string) => string | undefined
}

type SubagentTreeViewProps = ConvViewProps & PropsLocale<'ya-subagent'> & InjectFace<SubagentTreeViewInjected>

/** Walk up `subagentAddress` to find the root session id. */
function findRootSession(sessions: TreeSessions, sessionId: string): string {
  let current = sessionId
  for (let i = 0; i < 32; i++) {
    const addr = sessions.subagentAddress?.(current)
    if (addr === undefined) return current
    current = addr.parentSessionId
  }
  return sessionId
}

/** Subscribe to a session's `subagentProfile` projection → children map. */
function useChildren(sessions: TreeSessions, sessionId: string): Record<string, string> {
  const [children, setChildren] = useState<Record<string, string>>({})
  useEffect(() => {
    const binding = sessions.binding(sessionId)
    if (binding === undefined) return
    const face = binding.session.projections.faceOf('subagentProfile')
    if (face === undefined) return
    const read = (): void => {
      const snap = face.getSnapshot() as SubagentProfileProjection | undefined
      setChildren(snap?.children ?? {})
    }
    read()
    return face.subscribe(read)
  }, [sessions, sessionId])
  return children
}

/** Subscribe to a child session's `yaSubagentProgress` projection. */
function useChildProgress(
  sessions: TreeSessions,
  childId: string,
): YaSubagentProgressProjection | undefined {
  const [progress, setProgress] = useState<YaSubagentProgressProjection | undefined>(undefined)
  useEffect(() => {
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
 */
export function SubagentTreeView({ sessionId, sessions, profileLabelOf, t }: SubagentTreeViewProps) {
  const rootId = findRootSession(sessions, sessionId)
  const isSubagent = rootId !== sessionId

  return (
    <div className={css.tree}>
      {isSubagent && (
        <div className={css.rootHint}>{t('tree.rootHint')}</div>
      )}
      <ChildList
        parentId={rootId}
        currentSessionId={sessionId}
        sessions={sessions}
        profileLabelOf={profileLabelOf}
        t={t}
        depth={0}
      />
    </div>
  )
}

/** Recursively render a session's children. */
function ChildList({
  parentId,
  currentSessionId,
  sessions,
  profileLabelOf,
  t,
  depth,
}: {
  parentId: string
  currentSessionId: string
  sessions: TreeSessions
  profileLabelOf: (id: string) => string | undefined
  t: SubagentTreeViewProps['t']
  depth: number
}) {
  const children = useChildren(sessions, parentId)
  const childIds = Object.keys(children)

  if (depth === 0 && childIds.length === 0) {
    return <div className={css.empty}>{t('tree.empty')}</div>
  }

  return (
    <div className={css.childList} style={{ '--depth': depth } as React.CSSProperties}>
      {childIds.map(childId => (
        <ChildNode
          key={childId}
          childId={childId}
          profileId={children[childId] ?? ''}
          currentSessionId={currentSessionId}
          sessions={sessions}
          profileLabelOf={profileLabelOf}
          t={t}
          depth={depth}
        />
      ))}
    </div>
  )
}

/** One tree node: a child session row + its own children (recursively). */
function ChildNode({
  childId,
  profileId,
  currentSessionId,
  sessions,
  profileLabelOf,
  t,
  depth,
}: {
  childId: string
  profileId: string
  currentSessionId: string
  sessions: TreeSessions
  profileLabelOf: (id: string) => string | undefined
  t: SubagentTreeViewProps['t']
  depth: number
}) {
  const progress = useChildProgress(sessions, childId)
  const isCurrent = childId === currentSessionId
  const state = progress?.state ?? 'idle'
  const stateLabel = t(`tree.state.${state}`)
  const toolCallCount = progress?.toolCallCount ?? 0
  const tokens = formatTokens(progress?.tokens, t)
  const profileLabel = profileLabelOf(profileId) ?? profileId ?? childId
  const activity = progress?.activity
  const activityText = activity === undefined
    ? undefined
    : activity.kind === 'tool'
      ? activity.args !== undefined
        ? `${activity.name} ${activity.args}`
        : `${t('tree.calling')} ${activity.name}`
      : activity.text

  const openChild = (): void => {
    const retained = sessions.subagentAddress?.(childId)
    if (retained !== undefined) {
      try { sessions.openSubagent(retained); return } catch { /* fall through */ }
    }
    for (const mode of ['continuable', 'one-shot'] as const) {
      try {
        sessions.openSubagent({ parentSessionId: sessions.subagentAddress?.(childId)?.parentSessionId ?? currentSessionId, childSessionId: childId, mode })
        return
      } catch {
        // try next mode
      }
    }
  }

  return (
    <div className={css.node}>
      <div
        className={css.row}
        data-state={state}
        data-current={isCurrent || undefined}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={openChild}
        role="button"
        tabIndex={0}
      >
        <div className={css.rowHeader}>
          <span className={css.dot} aria-hidden />
          <span className={css.label}>{profileLabel}</span>
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
      <ChildList
        parentId={childId}
        currentSessionId={currentSessionId}
        sessions={sessions}
        profileLabelOf={profileLabelOf}
        t={t}
        depth={depth + 1}
      />
    </div>
  )
}
