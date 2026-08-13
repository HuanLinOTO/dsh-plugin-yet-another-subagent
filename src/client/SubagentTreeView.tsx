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

import { useEffect, useState, useMemo } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { YaSubagentProgressProjection, SubagentProfileProjection } from '../projection.ts'
import css from './SubagentTreeView.module.css'

/** Catalog entry shape (narrow face of SubagentListEntry). */
interface CatalogEntry {
  readonly kind: string
  readonly id: string
  readonly mode?: string
  readonly activity?: string
  readonly hasChildren?: boolean
  readonly label?: string
}

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
  setSubagentCatalogOpen(parentSessionId: string, open: boolean): void
  subagentsByParent: Readonly<Record<string, { entries: readonly CatalogEntry[]; parentAvailable: boolean }>>
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

/** Subscribe to a child session's `yaSubagentProgress` projection (if binding exists). */
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

/**
 * Recursively refresh catalogs for a session and all its descendants.
 * Returns immediately — `subagentsByParent` updates reactively.
 */
function refreshTree(sessions: TreeSessions, parentId: string): void {
  void sessions.refreshSubagents(parentId).then(() => {
    const catalog = sessions.subagentsByParent?.[parentId]
    if (catalog === undefined) return
    for (const entry of catalog.entries) {
      if (entry.kind === 'child' && entry.hasChildren === true) {
        refreshTree(sessions, entry.id)
      }
    }
  }).catch(() => { /* catalog refresh best-effort */ })
}

/** Format token totals: >=1000 uses "k", <1000 uses plain count. */
function formatTokens(tokens: YaSubagentProgressProjection['tokens'] | undefined, t: SubagentTreeViewProps['t']): string {
  if (tokens === undefined) return `0 ${t('tree.tokens')}`
  const total = tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite + tokens.reasoning
  const display = total >= 1000 ? `${(total / 1000).toFixed(1)}k` : String(total)
  return `${display} ${t('tree.tokens')}`
}

/** Build the full tree from catalogs + projection children. */
interface TreeNode {
  readonly id: string
  readonly label: string
  readonly mode?: string
  readonly catalogActivity?: string
  readonly hasChildren: boolean
  readonly children: readonly TreeNode[]
}

function buildTree(
  sessions: TreeSessions,
  parentId: string,
  projectionChildren: Record<string, string>,
  profileLabelOf: (id: string) => string | undefined,
  visited: Set<string>,
): TreeNode[] {
  const catalog = sessions.subagentsByParent?.[parentId]
  if (catalog === undefined) return []

  const nodes: TreeNode[] = []
  for (const entry of catalog.entries) {
    if (entry.kind !== 'child') continue
    if (visited.has(entry.id)) continue
    visited.add(entry.id)

    const profileId = projectionChildren[entry.id]
    const label = (profileId !== undefined ? profileLabelOf(profileId) : undefined)
      ?? entry.label
      ?? entry.id

    // Recursively build children from this child's catalog.
    const childProjectionChildren: Record<string, string> = {}
    // Try to read the child's projection children if binding exists.
    const binding = sessions.binding(entry.id)
    if (binding !== undefined) {
      const face = binding.session.projections.faceOf('subagentProfile')
      if (face !== undefined) {
        const snap = face.getSnapshot() as SubagentProfileProjection | undefined
        if (snap?.children !== undefined) {
          for (const [k, v] of Object.entries(snap.children)) {
            childProjectionChildren[k] = v
          }
        }
      }
    }

    const children = entry.hasChildren === true
      ? buildTree(sessions, entry.id, childProjectionChildren, profileLabelOf, visited)
      : []

    nodes.push({
      id: entry.id,
      label,
      mode: entry.mode,
      catalogActivity: entry.activity,
      hasChildren: children.length > 0,
      children,
    })
  }
  return nodes
}

/**
 * Render the subagent tree view. Always shows the ROOT session's full tree;
 * highlights the current session if it is a subagent.
 */
export function SubagentTreeView({ sessionId, sessions, profileLabelOf, t }: SubagentTreeViewProps) {
  const rootId = findRootSession(sessions, sessionId)
  const isSubagent = rootId !== sessionId

  // Keep the root catalog open (auto-refresh) while this tab is mounted.
  useEffect(() => {
    sessions.setSubagentCatalogOpen(rootId, true)
    refreshTree(sessions, rootId)
    return () => { sessions.setSubagentCatalogOpen(rootId, false) }
  }, [sessions, rootId])

  // Also subscribe to the root's projection for profileId mapping.
  const projectionChildren = useChildren(sessions, rootId)

  // Rebuild the tree whenever catalogs or projections change. We poll on a
  // timer because `subagentsByParent` is a plain object without subscribe.
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 2000)
    return () => clearInterval(interval)
  }, [])

  const tree = useMemo(
    () => buildTree(sessions, rootId, projectionChildren, profileLabelOf, new Set()),
    // Rebuild on every tick (poll) + when projection children change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, rootId, projectionChildren, profileLabelOf, sessions.subagentsByParent],
  )

  return (
    <div className={css.tree}>
      {isSubagent && (
        <div className={css.rootHint}>{t('tree.rootHint')}</div>
      )}
      {tree.length === 0 ? (
        <div className={css.empty}>{t('tree.empty')}</div>
      ) : (
        <TreeNodes
          nodes={tree}
          currentSessionId={sessionId}
          sessions={sessions}
          t={t}
          depth={0}
        />
      )}
    </div>
  )
}

/** Render a list of tree nodes. */
function TreeNodes({
  nodes,
  currentSessionId,
  sessions,
  t,
  depth,
}: {
  nodes: readonly TreeNode[]
  currentSessionId: string
  sessions: TreeSessions
  t: SubagentTreeViewProps['t']
  depth: number
}) {
  return (
    <div className={css.childList}>
      {nodes.map(node => (
        <TreeNodeView
          key={node.id}
          node={node}
          currentSessionId={currentSessionId}
          sessions={sessions}
          t={t}
          depth={depth}
        />
      ))}
    </div>
  )
}

/** One tree node row + its children (recursively). */
function TreeNodeView({
  node,
  currentSessionId,
  sessions,
  t,
  depth,
}: {
  node: TreeNode
  currentSessionId: string
  sessions: TreeSessions
  t: SubagentTreeViewProps['t']
  depth: number
}) {
  const progress = useChildProgress(sessions, node.id)
  const isCurrent = node.id === currentSessionId

  // Derive state: projection state if available, else catalog activity.
  const state = progress?.state
    ?? (node.catalogActivity === 'running' ? 'running' : 'idle')
  const stateLabel = t(`tree.state.${state}`)
  const toolCallCount = progress?.toolCallCount ?? 0
  const tokens = formatTokens(progress?.tokens, t)
  const activity = progress?.activity
  const activityText = activity === undefined
    ? undefined
    : activity.kind === 'tool'
      ? activity.args !== undefined
        ? `${activity.name} ${activity.args}`
        : `${t('tree.calling')} ${activity.name}`
      : activity.text

  const openChild = (): void => {
    const retained = sessions.subagentAddress?.(node.id)
    if (retained !== undefined) {
      try { sessions.openSubagent(retained); return } catch { /* fall through */ }
    }
    // Try to find the parent from the tree structure.
    const addr = sessions.subagentAddress?.(node.id)
    if (addr !== undefined) {
      try { sessions.openSubagent(addr); return } catch { /* fall through */ }
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
          <span className={css.label}>{node.label}</span>
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
      {node.children.length > 0 && (
        <TreeNodes
          nodes={node.children}
          currentSessionId={currentSessionId}
          sessions={sessions}
          t={t}
          depth={depth + 1}
        />
      )}
    </div>
  )
}
