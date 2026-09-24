/**
 * yet-another-subagent — browser half.
 *
 * Single bundle, dual entry: this is the client half (exports `./client`).
 * Host half ships via `.` (see `src/index.ts`).
 *
 * Three registrations:
 *   1. `plugins.row.config` keyed slot — the profile editor page on the
 *      Plugins page, keyed `@huanlin/dsh-plugin-yet-another-subagent#ya-subagent`.
 *   2. `tool.call.toolview` keyed slot, key `subagent` — the live toolcall
 *      card (SubagentCard). A single key covers all profiles because the
 *      tool name is always `subagent`; the profile is a call parameter.
 *   3. `conversation.view` list slot — the session's subagent tree tab.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ConnectionHandle, RpcResult } from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the client connection Context merge (ctx.connection).
import type {} from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the sessions object layer's Context merge (ctx.sessions).
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: pulls the renderer's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the shell's SlotMap merges (plugins.row.config, tool.call.toolview).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
// Type-only: pulls the 'conversation.view' SlotMap row for the tree tab.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the Plugins page's 'plugins.row.config' SlotMap row.
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
// Type-only: pulls the `ctx.uiWorkspace` Context merge (session navigation).
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
// Type-only: pulls the ui-session standard-props merge (sessionId/useSessions/useProjection).
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SubagentProfile } from '../types.ts'
import type { ProfileListResponse } from '../rpc.ts'
import { SubagentCard, type SubagentCardInjected } from './SubagentCard.tsx'
import { SubagentTreeView, type SubagentTreeViewInjected } from './SubagentTreeView.tsx'
import { SettingsPage, type YaSubagentSettingsInjected } from './SettingsPage.tsx'
import { dicts } from './dictionaries.ts'
import { en, NS, zh, type YaSubagentKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The subagent settings page + tool card copy. */
    'ya-subagent': YaSubagentKey
  }
}

/** Required services: settings/tool slots, locale, sessions, connection, workspace navigation. */
export const inject = ['slots', 'locale', 'sessions', 'connection', 'uiWorkspace']

/** Profile list wire shape (mirror of host `ProfileListResponse`). */
type ProfileListResult = RpcResult<ProfileListResponse>

/** Model catalog wire shape (mirror of the host `ModelCatalog` read face). */
interface ModelCatalogData {
  readonly groups: readonly { readonly id: string; readonly name: string; readonly models: readonly { readonly id: string; readonly name: string }[] }[]
}

type ModelCatalogResult = RpcResult<ModelCatalogData>

/**
 * Client plugin body: register the profile editor + the `subagent` toolview.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ya-subagent: dictionaries')

  // Opt-in third-language overrides through dsh-plugin-better-locale: an
  // optional service, absent plugin means a plain no-op.
  // Activation-order-safe: ctx.get('betterLocale') is a non-reactive read, so
  // if better-locale activates after us, the initial read returns undefined.
  // We subscribe to ctx.locale — better-locale bumps its revision on activation
  // (persisted override) and on every override switch — and re-check on each bump.
  ctx.effect(() => {
    let dispose: (() => void) | undefined
    const sync = (): void => {
      dispose?.()
      dispose = undefined
      const store = ctx.get('betterLocale') as
        | { register(ns: string, dicts: Record<string, Record<string, string>>): () => void }
        | undefined
      if (store !== undefined) {
        dispose = store.register(NS, dicts)
      }
    }
    sync()
    const unsubscribe = ctx.locale.subscribe(sync)
    return () => {
      unsubscribe()
      dispose?.()
    }
  }, 'ya-subagent: better-locale override dicts')

  // `ctx.connection` is typed as HostConnectionHandle (host-side merge) when
  // the host connection package is also in the type graph; in a real client
  // build only the client merge is present and the cast is a no-op.
  // Both `@deepseek-ai/dsh-session` (Host) and
  // `@deepseek-ai/dsh-api-session-controller/client` declare `ctx.sessions`; a
  // single-face tsconfig that compiles BOTH halves resolves the Host
  // `SessionStore` first. The client half only ever runs with the client
  // augmentation, so narrow the face here (same pattern as `ctx.connection`).
  const sessions = ctx.sessions as unknown as ISessions
  const connection = ctx.connection as unknown as ConnectionHandle
  const t = ctx.locale.bind(NS) as (key: string) => string

  // ---- Profile label lookup for the tool card / tree view ---------------
  // Both resolve a profile id (from the tool call arguments) to its display
  // label. We keep a local id→label map, refreshed whenever the profile list
  // changes (settings mutation, connection reset).
  const profileLabels = new Map<string, string>()
  const refreshProfileLabels = (profiles: readonly SubagentProfile[]): void => {
    profileLabels.clear()
    for (const p of profiles) profileLabels.set(p.id, p.label)
  }
  const fetchProfilesInternal = async (): Promise<readonly SubagentProfile[]> => {
    // Exact Fetch routes below `/api` (registered by the host half); the
    // shared channel carries the trust fence and browser authentication.
    const result = await connection.rpc.call('/api', 'ya-subagent.profiles.list', {}) as ProfileListResult
    return result.ok ? result.value.profiles : []
  }
  void fetchProfilesInternal().then(refreshProfileLabels).catch((error: unknown) => {
    ctx.logger.error('ya-subagent: initial profile label fetch failed', error)
  })
  ctx.on('connection/reset', () => {
    void fetchProfilesInternal().then(refreshProfileLabels).catch((error: unknown) => {
      ctx.logger.error('ya-subagent: post-reset profile label fetch failed', error)
    })
  })

  // ---- Model catalog fetch for the profile editor -----------------------
  // The generated session Remote serves `session/modelCatalog` on the shared
  // `/api` channel (endpoint = namespace/method); the plugin reads it through
  // the generic RPC caller instead of taking a dependency on the generated
  // Remote assembly. Gateway Remote wire convention: the payload must wrap the
  // call arguments as exactly one plain-object `args` field — a bare `{}` is
  // rejected by the host request parser ("Remote payload must contain exactly
  // one plain-object args field"), so even the no-argument method sends
  // `{ args: {} }`.
  const fetchModelCatalogInternal = async (): Promise<ModelCatalogData | undefined> => {
    const result = await connection.rpc.call('/api', 'session/modelCatalog', { args: {} }) as ModelCatalogResult
    if (!result.ok) {
      ctx.logger.warn('ya-subagent: model catalog fetch failed:', result.error.message)
      return undefined
    }
    return result.value
  }

  // ---- Shared navigation/invalidation actions ---------------------------
  // rc.1 moved Session navigation to the ui-workspace navigation service and
  // replaced the per-child catalog refresh with `refreshProjections`.
  const openChild = (childId: SessionId): void => {
    const address = sessions.subagentAddress(childId)
    try {
      ctx.uiWorkspace.openSession(address ?? childId)
    } catch (error) {
      ctx.logger.error('ya-subagent: openSession failed', error)
    }
  }
  const refreshProjection = (sessionId: SessionId): void => {
    void sessions.refreshProjections(sessionId)
  }
  const profileLabelOf = (id: string): string | undefined => profileLabels.get(id)

  // ---- Single toolview slot (key: 'subagent') ---------------------------
  // The tool name is always `subagent`; the profile is a call parameter.
  // SubagentCard reads profileLabel from the result content (continuable
  // branch) or falls back to the id→label map (foreground branch).
  const cardInjected = (): SubagentCardInjected => ({
    profileLabelOf,
    openChild,
    refreshProjection,
  })
  // Registered through slots.inject: the slot is declared by the ui-tool
  // `conversation.chat.node` entry's children table, so a bare register
  // races its declaration commit and fails boot when we apply first.
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'subagent',
    locale: NS,
    inject: cardInjected,
  }, SubagentCard))

  // ---- Profile editor (plugins.row.config) ------------------------------
  // rc.1: a plugin's configuration page lives on the Plugins page, keyed by
  // `<bundle package>#<row id>` (the bundle's patch declares row
  // `ya-subagent`); the rc.2 Settings-panel tab is deliberately not used.
  const settingsInjected = (): YaSubagentSettingsInjected => ({
    rpc: connection.rpc,
    fetchProfiles: fetchProfilesInternal,
    fetchModelCatalog: fetchModelCatalogInternal,
    t,
  })
  ctx.slots.inject('plugins.row.config', function* () {
    yield ctx.slots.register({
      name: 'plugins.row.config',
      key: '@huanlin/dsh-plugin-yet-another-subagent#ya-subagent',
      locale: NS,
      inject: settingsInjected,
    }, SettingsPage)
  })

  // ---- Subagent tree view tab (conversation.view) ----------------------
  // A session-scope view listing the current session's subagent tree with
  // live progress. order: 20 places it after Trajectory (10).
  const treeInjected = (): SubagentTreeViewInjected => ({
    profileLabelOf,
    openChild,
    refreshProjection,
    subagentAddress: (id: SessionId) => sessions.subagentAddress(id),
  })
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'subagent-tree',
    order: 20,
    label: () => ctx.locale.bind(NS)('tree.tab'),
    locale: NS,
    inject: treeInjected,
  }, SubagentTreeView))
}
