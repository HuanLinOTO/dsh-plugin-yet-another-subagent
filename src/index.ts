/**
 * yet-another-subagent — host plugin entry.
 *
 * Single bundle, dual entry: this is the host half (exports `.`). The browser
 * half ships via `./client` (see `src/client/index.ts`).
 *
 * Architecture (design doc §1):
 *   - A single `subagent` tool is exposed to the model. The desired profile
 *     is selected via the `profile` parameter (enum of profile ids). Profile
 *     add/remove updates the enum without changing the tool name set.
 *   - The tool reuses the official `spawn` provider via `ctx.subagents.startContinuable`.
 *   - Profiles live in an in-memory `ProfileStore` mutated through RPC.
 *   - Two projections (`subagentProfile` on parent, `yaSubagentProgress` on
 *     child) bridge the single-stage client runtime so SubagentCard can
 *     subscribe to live child progress.
 *
 * @module @dsh-external/yet-another-subagent
 */

import type { Context } from 'cordis'
import z from 'schemastery'
// Type import also triggers `declare module 'cordis'` merge for `ctx.agents`
// and the typed `agent/created` event (via dsh-agent's declaration).
import type { Agent } from '@deepseek-ai/dsh-agent'
// Value import triggers `declare module 'cordis'` merge for `ctx.subagents`.
import { assertSubagentMaxDepth } from '@deepseek-ai/dsh-subagent'
import type { SubagentProvider } from '@deepseek-ai/dsh-subagent'
// Value import triggers `declare module 'cordis'` merge for `ctx.settings`.
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { ProfileStore } from './profile-store.ts'
import { buildTool } from './tool-factory.ts'
import { registerRpc } from './rpc.ts'
import {
  subagentProfileProjection,
  yaSubagentProgressProjection,
} from './projection.ts'
import type { YaSubagentConfig } from './types.ts'

export const name = 'yet-another-subagent'
export const inject = ['tools', 'subagents', 'agents', 'sessionProjections', 'connection']

export type { SubagentProfile, YaSubagentConfig } from './types.ts'

/** Settings namespace under which profile state persists (`$DSH_HOME/settings.yaml`). */
export const SETTINGS_NAMESPACE = settingsNamespace('ya-subagent')

/** Schemastery schema for one profile (config layer). */
const SubagentProfileSchema = z.object({
  id: z.string().required().description('Unique profile id (lowercase letters, digits, hyphens; 1-32 chars).'),
  label: z.string().required().description('Display name (nav label / card title).'),
  model: z.object({
    kind: z.union(['auto', 'manual']).required(),
    provider: z.string().default('').description('Provider route (only used when kind is "manual").'),
    model: z.string().default('').description('Model id (only used when kind is "manual").'),
  }).required().description('Model selection: auto inherits the parent model; manual pins a provider/model.'),
  persona: z.object({
    kind: z.union(['inherit', 'custom']).default('inherit'),
    text: z.string().default(''),
  }).default({ kind: 'inherit', text: '' }).description('Persona selection: inherit uses the deployment persona; custom shadows it with the provided text.'),
  toolFilter: z.object({
    kind: z.union(['none', 'allow', 'deny']).default('none'),
    tools: z.array(z.string()).default([]),
  }).default({ kind: 'none', tools: [] }).description('Tool filter: none applies no filter; allow keeps only the named tools; deny removes them.'),
  maxDepth: z.natural().max(Number.MAX_SAFE_INTEGER).default(3).description('Maximum delegation depth (default 3).'),
  backgroundMode: z.union(['continuable', 'one-shot']).default('continuable').description('Background policy: continuable keeps the child conversation (send_message); one-shot returns a task id (task_output/task_kill).'),
  builtin: z.boolean().default(false).description('Whether this profile is part of the bundle seed (presentation hint only).'),
})

export interface Config extends YaSubagentConfig {}

// Schemastery's inferred schema output type carries `| null | undefined` on
// optional fields that the Config interface does not; the runtime shape is
// identical, so we bridge with `as unknown as` casts (same pattern as
// `tool-subagent/src/index.ts:86,92` for `agentOptions` / `toolFilter`).
const DEFAULT_PROFILES = [
  {
    id: 'general',
    label: 'General',
    model: { kind: 'auto', provider: '', model: '' },
    persona: { kind: 'inherit', text: '' },
    toolFilter: { kind: 'none', tools: [] },
    maxDepth: 3,
    backgroundMode: 'continuable',
    builtin: true,
  },
]

export const Config = z.object({
  profiles: z.array(SubagentProfileSchema).default(DEFAULT_PROFILES as any),
  generalFixed: z.boolean().default(true),
}) as unknown as z<Config>

/**
 * Settings schema for the `ya-subagent` namespace. Identical shape to
 * {@link Config}: cordis.yml seed becomes the composition `base`, and the
 * user layer (settings.yaml) overrides it. The cordis.yml `profiles` field
 * is the first-boot seed; once the user edits profiles in the settings UI,
 * the user layer owns the canonical list.
 */
const SettingsSchema = Config as z<YaSubagentConfig>

/**
 * Plugin body: register profile tools, RPC, and projections.
 *
 * Persistence: when a settings service is mounted, the profile list lives
 * under the `ya-subagent` namespace in `$DSH_HOME/settings.yaml`. The
 * cordis.yml `profiles` field is the composition `base` (first-boot seed);
 * runtime mutations persist through `scope.replace()`. Headless assemblies
 * without a settings provider fall back to in-memory state (cordis.yml seed
 * only, no persistence).
 * @param ctx - host context carrying `tools`, `subagents`, `sessionProjections`.
 * @param config - resolved config (seed profiles + generalFixed).
 */
export function apply(ctx: Context, config: Config): void {
  // Validate the seed profiles' maxDepth synchronously at load (mirrors the
  // official tool-subagent load-time gate).
  for (const profile of config.profiles) assertSubagentMaxDepth(profile.maxDepth)

  const store = new ProfileStore(config)

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
  ctx.on('agent/created', ({ agent }: { agent: Agent }) => {
    registerForAgent(agent)
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

  // 2. Settings-backed persistence. The `ya-subagent` namespace lives under
  //    $DSH_HOME/settings.yaml when a settings provider is mounted; the
  //    cordis.yml config is the composition `base`. External edits (a hand-
  //    edited yaml) reload the in-memory map and re-register tools.
  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(SETTINGS_NAMESPACE, SettingsSchema, { base: config })
    store.attachScope(scope)
    // A hand-edited settings.yaml or a concurrent tab changes the resolved
    // value: reload the in-memory map and re-register tools.
    scope.watch(() => {
      store.reloadFromScope()
      syncTools()
    })
    // The initial scope value may differ from the cordis.yml seed (the user
    // layer wins); re-register tools against the canonical list.
    syncTools()
  })

  // 3. RPC: profile list CRUD (mutations auto-persist through the scope).
  //    `connection` is in the plugin's inject list, so `ctx.connection` is
  //    directly available — no need for ctx.inject(['connection'], …).
  ctx.logger.info('ya-subagent: registering RPC interceptor on /api channel')
  registerRpc(ctx, store)

  // 4. Projections: parent-side `subagentProfile` + child-side `yaSubagentProgress`.
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register(subagentProfileProjection)
    projectionCtx.sessionProjections.register(yaSubagentProgressProjection)
  })
}
