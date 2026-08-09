/**
 * yet-another-subagent — browser half.
 *
 * Single bundle, dual entry: this is the client half (exports `./client`).
 * Host half ships via `.` (see `src/index.ts`).
 *
 * Two registrations:
 *   1. `settings.section` slot — the profile editor page (SettingsPage).
 *   2. `tool.call.toolview` keyed slot, key `subagent` — the live toolcall
 *      card (SubagentCard). A single key covers all profiles because the
 *      tool name is always `subagent`; the profile is a call parameter.
 *
 * @module @dsh-external/yet-another-subagent/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle, RpcResult } from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the client connection Context merge (ctx.connection).
import type {} from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the shell's SlotMap merges (settings.section, tool.call.toolview).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
// Type-only: pulls the 'conversation.view' SlotMap row for the tree tab registration.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SubagentProfile } from '../types.ts'
import type { ProfileListResponse } from '../rpc.ts'
import { SubagentCard, type SubagentCardInjected } from './SubagentCard.tsx'
import { SubagentTreeView, type SubagentTreeViewInjected } from './SubagentTreeView.tsx'
import { SettingsPage, type YaSubagentSettingsInjected } from './SettingsPage.tsx'
import { en, NS, zh, type YaSubagentKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The subagent settings page + tool card copy. */
    'ya-subagent': YaSubagentKey
  }
}

/** Required services: settings/tool slots, locale, sessions, connection. */
export const inject = ['slots', 'locale', 'sessions', 'connection']

/** Profile list wire shape (mirror of host `ProfileListResponse`). */
type ProfileListResult = RpcResult<ProfileListResponse>

/**
 * Client plugin body: register settings page + single `subagent` toolview slot.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ya-subagent: dictionaries')

  // `ctx.connection` is typed as HostConnectionHandle (host-side merge) when
  // the host connection package is also in the type graph; in a real client
  // build only the client merge is present and the cast is a no-op.
  const connection = ctx.connection as unknown as ConnectionHandle
  const t = ctx.locale.bind(NS) as (key: string) => string

  // ---- Profile label lookup for SubagentCard ---------------------------
  // The card needs to resolve a profile id (from the tool call arguments)
  // to its display label. We keep a local id→label map, refreshed whenever
  // the profile list changes (settings mutation, connection reset).
  const profileLabels = new Map<string, string>()
  const refreshProfileLabels = (profiles: readonly SubagentProfile[]): void => {
    profileLabels.clear()
    for (const p of profiles) profileLabels.set(p.id, p.label)
  }
  const fetchProfilesInternal = async (): Promise<readonly SubagentProfile[]> => {
    const result = await connection.rpc.call('/api', 'ya-subagent/profiles.list', {}) as ProfileListResult
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

  // ---- Single toolview slot (key: 'subagent') ---------------------------
  // The tool name is always `subagent`; the profile is a call parameter.
  // SubagentCard reads profileLabel from the result content (continuable
  // branch) or falls back to the id→label map (foreground branch).
  const cardInjected = (): SubagentCardInjected => ({
    sessions: ctx.sessions as unknown as SubagentCardInjected['sessions'],
    profileLabelOf: (id: string) => profileLabels.get(id),
  })
  ctx.effect(() => ctx.slots.register({
    name: 'tool.call.toolview',
    key: 'subagent',
    locale: NS,
    inject: cardInjected,
  }, SubagentCard), 'ya-subagent: subagent toolview')

  // ---- Profile list fetch for SettingsPage ------------------------------
  const fetchProfiles = fetchProfilesInternal

  // ---- Settings page registration ---------------------------------------
  const settingsInjected = (): YaSubagentSettingsInjected => ({
    rpc: connection.rpc,
    fetchProfiles,
    t,
  })
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'ya-subagent',
    order: 30,
    label: () => t('nav'),
    inject: settingsInjected,
  }, SettingsPage))

  // ---- Subagent tree view tab (conversation.view) ----------------------
  // A session-scope view listing the current session's subagent children
  // with live progress. order: 20 places it after Trajectory (10).
  const treeInjected = (): SubagentTreeViewInjected => ({
    sessions: ctx.sessions as unknown as SubagentTreeViewInjected['sessions'],
    profileLabelOf: (id: string) => profileLabels.get(id),
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
