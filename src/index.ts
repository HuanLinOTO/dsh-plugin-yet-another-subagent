/**
 * yet-another-subagent — host plugin entry.
 *
 * Single bundle, dual entry: this is the host half (exports `.`). The browser
 * half ships via `./client` (see `src/client/index.ts`).
 *
 * Architecture:
 *   - A single `subagent` tool is exposed to the model. The desired profile
 *     is selected via the `profile` parameter (enum of profile ids). Profile
 *     add/remove updates the enum without changing the tool name set.
 *   - The tool reuses the official `spawn` provider via `ctx.subagents.startContinuable`.
 *   - Profiles live in a `ProfileStore` whose list is the entry's volatile
 *     Cordis `Config` (`profiles`); runtime mutations commit through the
 *     settings service and persist to the active profile's `cordis.patch.yml`
 *     (dsh 0.1.7-rc.1, DSH-0.1.7-RC1-04).
 *   - Two projections (`subagentProfile` on parent, `yaSubagentProgress` on
 *     child) bridge the client runtime so SubagentCard can subscribe to live
 *     child progress.
 *
 * @module @huanlin/dsh-plugin-yet-another-subagent
 */

import type { Context } from '@deepseek-ai/cordis'
// Type import also triggers `declare module '@deepseek-ai/cordis'` merge for
// `ctx.agents` and the typed `agent/created` event (via dsh-agent's declaration).
import type { Agent } from '@deepseek-ai/dsh-agent'
// Value import triggers `declare module '@deepseek-ai/cordis'` merge for `ctx.subagents`.
import { assertSubagentMaxDepth } from '@deepseek-ai/dsh-subagent'
import type { SubagentProvider } from '@deepseek-ai/dsh-subagent'
import { Config, resolveProfiles, type EntryConfig } from './config.ts'
import { ProfileStore } from './profile-store.ts'
import { buildTool } from './tool-factory.ts'
import { registerRpc } from './rpc.ts'
import {
  subagentProfileProjection,
  yaSubagentProgressProjection,
} from './projection.ts'
import { installYaSubagentSettings } from './settings.ts'

export const name = 'yet-another-subagent'
export const inject = ['tools', 'subagents', 'agents', 'sessionProjections', 'connection']

export { Config }
export { SETTINGS_NAMESPACE } from './settings.ts'
export type { SubagentProfile, YaSubagentConfig } from './types.ts'

/**
 * Plugin body: register profile tools, RPC, and projections.
 *
 * Persistence: when a settings service is mounted, the profile list lives in
 * the entry's Config (`profiles`) and runtime mutations commit through
 * `settings.update` into the active profile's `cordis.patch.yml`. The
 * composition `config.profiles` is the first-boot seed. Headless assemblies
 * without a settings provider fall back to in-memory state (seed only).
 * @param ctx - host context carrying `tools`, `subagents`, `sessionProjections`.
 * @param config - the entry's volatile Cordis config.
 */
export function apply(ctx: Context, config: EntryConfig = {} as EntryConfig): void {
  const seedProfiles = resolveProfiles(config.profiles?.get())
  // Validate the seed profiles' maxDepth synchronously at load (mirrors the
  // official tool-subagent load-time gate).
  for (const profile of seedProfiles) assertSubagentMaxDepth(profile.maxDepth)

  const store = new ProfileStore({
    profiles: seedProfiles,
    generalFixed: config.generalFixed !== false,
  })

  // The settings bridge reads the entry's live volatile reference and commits
  // mutations back through the settings service. Without a settings provider
  // (headless), `persist` is a no-op and the store stays in-memory.
  const settingsBridge = installYaSubagentSettings(ctx, config)
  store.attachPersistence({
    source: () => settingsBridge.source(),
    persist: profiles => settingsBridge.persist(profiles),
  })

  // 1. Profile list → single `subagent` tool registration. The tool's
  //    `profile` parameter enum is rebuilt from the live profile list on
  //    every sync. We mirror the official tool-subagent provider-lifecycle
  //    pattern: wait for `spawn` to appear, register when ready, dispose
  //    on removal.
  //
  //    Registration targets TWO planes because the web-app `standard` preset
  //    mounts the official `tool-subagent` at the AGENT scope, and the tools
  //    registry lets a scope's own registration shadow inherited (preset /
  //    global) ones — a global-only `subagent` would lose to the preset's
  //    official tool (observed: the model saw the official tool). So the tool
  //    is ALSO registered per agent (into `agent.ctx`, the agent's own layer)
  //    where it shadows the preset's. The global registration stays as the
  //    global-view surface (`ctx.tools.schemas()` feeds the `tools.list` RPC)
  //    and as a fallback for agents composed without a preset.
  let globalToolDisposer: (() => void) | undefined
  const perAgentTools = new Map<Agent, () => void>()
  let spawnAvailable = false

  const registerGlobal = (): void => {
    if (globalToolDisposer !== undefined) {
      globalToolDisposer()
      globalToolDisposer = undefined
    }
    globalToolDisposer = ctx.tools.register(buildTool(store.list(), ctx))
  }

  const registerForAgent = (agent: Agent): void => {
    if (perAgentTools.has(agent) || !spawnAvailable) return
    // `agent.ctx.effect` owns the tool for the agent's lifetime: it unwinds
    // with the agent and re-runs the cleanup on disposal.
    const disposer = agent.ctx.effect(() => {
      const disposeTool = agent.ctx.tools.register(buildTool(store.list(), ctx))
      return () => {
        disposeTool()
        perAgentTools.delete(agent)
      }
    }, 'ya-subagent.subagent-tool()')
    perAgentTools.set(agent, disposer)
  }

  const disposeAllTools = (): void => {
    if (globalToolDisposer !== undefined) {
      globalToolDisposer()
      globalToolDisposer = undefined
    }
    for (const [agent, disposer] of [...perAgentTools]) {
      perAgentTools.delete(agent)
      disposer()
    }
  }

  const syncTools = (): void => {
    disposeAllTools()
    if (!spawnAvailable) return
    registerGlobal()
    for (const agent of ctx.agents.list()) registerForAgent(agent)
  }
  // Register listeners before checking presence so no synchronous change is missed.
  // rc.1: `agent/created` payload is `{ agent, source, signal? }` and the
  // listener must return `undefined | Promise<undefined>`; dispatch is serial,
  // so this listener stays synchronous and non-re-entrant.
  ctx.on('agent/created', (payload) => {
    registerForAgent(payload.agent)
    return undefined
  })
  ctx.on('subagent/provider-added', (provider: SubagentProvider) => {
    if (provider.name !== 'spawn') return
    spawnAvailable = true
    syncTools()
  })
  ctx.on('subagent/provider-removed', (providerName: string) => {
    if (providerName !== 'spawn') return
    spawnAvailable = false
    disposeAllTools()
  })
  const present = ctx.subagents.getProvider('spawn')
  if (present !== undefined) {
    spawnAvailable = true
    syncTools()
  } else {
    ctx.logger.info('subagent spawn provider not registered yet; profile tools will register when it appears')
  }

  // 2. RPC: profile list CRUD. Mutations commit through the store's attached
  //    persistence face and then re-register the tool so the model-visible
  //    profile enum tracks the change immediately. Exact Fetch routes below
  //    `/api` via `connection.fetch.register` — the host's dedicated-channel
  //    registry (`rpc.handle`) cannot mount routes in the web profile (the
  //    webserver service is a sibling loader row, not an ancestor of the
  //    connection fiber), so dedicated channels never appear.
  ctx.logger.info('ya-subagent: registering RPC routes /api/ya-subagent.*')
  registerRpc(ctx, store, () => syncTools())

  // 3. Projections: parent-side `subagentProfile` + child-side `yaSubagentProgress`.
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register(subagentProfileProjection)
    projectionCtx.sessionProjections.register(yaSubagentProgressProjection)
  })
}
