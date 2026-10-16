# yet-another-subagent — Agent Guide

## Plugin overview

Bundle-style DSH plugin exposing configurable subagent profiles as model-facing `subagent_<id>` tools. Web UI settings, real-time toolcall/token display, click-to-navigate child sessions. Disables official `tool-subagent` and `tool-subagent-fork`.

Target host: **dsh 0.2.1-alpha.5** (`@deepseek-ai/cordis@4.0.5-alpha.2`, `@deepseek-ai/schemastery@3.18.5-alpha.2`).

## Key conventions

- **Bundle form**: `cordis.patch.yml` disables two official rows + inserts one plugin row; `package.json` has `dsh.bundle.patch`. No source patches to DSH staging.
- **Peer deps**: `@deepseek-ai/cordis` (scoped; the bare `cordis` name is not the 0.1.7 module closure) + `@deepseek-ai/schemastery` + `@deepseek-ai/dsh-*` (provided by host). `zod` is bundled at build time (tsdown `NODE_EXTERNALS` does not list it) and pinned `^4.6.5` so its `ZodType` carries the `validate`/`validateAsync` members the host `dsh-session-projection` declaration requires.
- **Single bundle, dual entry**: `.` (host), `./client` (browser). No `./invariant` entry: since dsh 0.1.2-rc.1 the invariant rule forbids empty installers, and this plugin's registrations (tools/RPC/projections) have no independent divergent runtime observation.
- **Persistence is the profile-owned Cordis `Config`** (dsh 0.1.7-rc.1 `DSH-0.1.7-RC1-04`): `ctx.settings.register` is gone. `src/config.ts` declares the entry `Config` with `profiles` marked `.volatile()`; `apply` receives a live `Volatile<SubagentProfile[]>` reference. `src/settings.ts` installs the presentation policy (`settings.configure({ auto: false })`) and returns a bridge (`source()` reads the live reference, `persist(list)` calls `settings.update('ya-subagent', { profiles })`). Values persist per profile in `cordis.patch.yml` under the entry id. Headless assemblies without a settings provider keep the composition seed in memory only.
- **Entry row id = `ya-subagent`**: the row id doubles as the settings/profile entry id. It deliberately matches the legacy `$DSH_HOME/settings.yaml` namespace so the host's one-time import maps the existing profile section onto this entry instead of stranding it.
- **Profile = tool instance**: each user-configured profile maps to a `subagent_<profile_id>` tool registered via `ctx.tools.register(defineTool(...))`. Reuses official `spawn` provider via `ctx.subagents.startActivation` (`delivery: 'caller'` foreground/job, `delivery: 'parent'` continuable; dsh 0.2.1-alpha.5 DSH-0.2.1-J1-05).
- **`maxDepth` defaults to 1** (matches the host/`tool-subagent` default since 0.1.7-rc.1; profiles can opt into deeper nesting).
- **ProfileLabel in result content**: tool execute embeds `profileLabel` in the continuable result content (`started <label> subagent <id>`), so SubagentCard reads it with zero RPC (SkillRow paradigm).
- **Profile CRUD via exact Fetch routes on `/api`**: `ya-subagent.profiles.*`/`tools.list`/`sessions.repair` registered through `ctx.connection.fetch.register` (the host's dedicated `rpc.handle` channels cannot mount in the web profile — the webserver service is a sibling loader row, never an ancestor of the connection fiber). Business errors reuse the closed `internal` RpcError code with descriptive messages. A successful mutation calls back into `apply` to re-register the model-facing tool against the new list.
- **Two projections**:
  - `subagentProfile` (parent session): fold `tool/call.name` + `tool/result` content → `childId → profileId` map.
  - `yaSubagentProgress` (child session): fold `tool/call`, `assistant/message.usage`, `turn/start`, `turn/end` → live toolcall count + token totals + state.
  - Both `wire.view`s are wrapped in `memoizeView` (the projection drive publishes only on raw-view `Object.is` change, so an object-valued view must reuse its reference).
- **Client reads projections through the standard hooks**: `useProjection('subagentProfile')` for the current session and `useSessions(state => state.projectionsBySession[id]?.values.<key>)` for arbitrary child sessions. The old client-side `subagentsByParent` catalog is gone; the host-computed `subagentCatalog` projection (`SubagentCatalogEntry[]`) is the tree source.
- **Session navigation belongs to the view owner**: `ctx.uiWorkspace.openSession(sessionId | SubagentAddress)` (was `sessions.openSubagent`), and projection invalidation is `sessions.refreshProjections(sessionId)` (was `sessions.refreshSubagents`).
- **ESM-only**: `"type": "module"`, relative imports use `.ts` extensions (allowImportingTsExtensions + rewriteRelativeImportExtensions).

## File responsibilities

| File | Role |
|------|------|
| `src/config.ts` | Schemastery `Config` (volatile `profiles`), `EntryConfig`, `DEFAULT_MAX_DEPTH`, `resolveProfiles` |
| `src/settings.ts` | Settings bridge: `installYaSubagentSettings`, `SETTINGS_NAMESPACE`, `source`/`persist` |
| `src/index.ts` | Host entry: `name`, `inject`, `Config` re-export, `apply` (bridge + tool registration + RPC + projections) |
| `src/types.ts` | `SubagentProfile`, `YaSubagentConfig`, `agentOptionsFor`, `isValidProfileId`, `migrateProfile` |
| `src/profile-store.ts` | `ProfileStore` CRUD (`add`/`update`/`remove`/`list`/`get`) + `attachPersistence`/`reloadFromPersistence` |
| `src/tool-factory.ts` | `buildTool(profile, ctx)` → `defineTool` options (continuable default + foreground fallback). No plugin-defined session events. |
| `src/repair.ts` | One-shot session-log repair: physically REMOVES legacy `ya-subagent/started` rows and renumbers later rows. Handles `.jsonl` and `.jsonl.zst`. Idempotent, backs up to `.bak`. |
| `src/rpc.ts` | `registerRpc(ctx, store, onProfilesChanged)` via `ctx.inject(['connection'], …)` + `connection.fetch.register` exact routes on `/api`. |
| `src/projection.ts` | `subagentProfileProjection` + `yaSubagentProgressProjection` + `SessionProjectionMap` merge |
| `src/client/index.ts` | Client entry: `inject = ['slots','locale','sessions','connection','uiWorkspace']`, registers `plugins.row.config` + per-`conversation.view` tree + `tool.call.toolview` |
| `src/client/SubagentCard.tsx` | Keyed toolview component; branches on `phase` (`preparing`/`start`/`result`), subscribes child `yaSubagentProgress` via `useSessions`, click-to-open |
| `src/client/SubagentTreeView.tsx` | `conversation.view` tab: recurses `subagentCatalog` per session, live progress |
| `src/client/SettingsPage.tsx` | `plugins.row.config` component (RPC CRUD + re-sync toolviews) |
| `src/client/locales.ts` | English + Chinese dictionaries for the `ya-subagent` namespace |
| `src/client/dictionaries.ts` | better-locale override dictionaries (19 languages) |
| `tests/profile-store.spec.ts` | Unit tests for `ProfileStore` CRUD + validation |
| `tests/profile-store-persistence.spec.ts` | Unit tests for the persistence face (attach/reload/commit/headless fallback) |
| `tests/projection.spec.ts` | Unit tests for both projection folds |
| `tests/rpc-routes.spec.ts` | Unit tests for the exact Fetch routes |
| `tests/repair.spec.ts` | Unit tests for the session-log repair |

## Commands

```sh
pnpm test             # vitest run (against the local dev tree)
pnpm run build        # prebuild (relink) + tsdown → lib/index.js, lib/client.js + tsc → lib/types
```

> **Dev-tree caveat**: `node_modules/{@deepseek-ai/*,cordis}` are junctions built by
> `scripts/relink-deps.mjs` from `$DSH_HOME/source/current`. When that tree is older
> than the plugin's target host, `pnpm run typecheck` / the `tsc` leg of
> `pnpm run build` reports the missing rc.1 APIs. Validate the rc.1 surface with a
> temporary tsconfig whose `paths` point at a registry-unpacked rc.1 cohort
> (`tsc --noEmit -p <probe>.json`), and emit `lib/types` from that same probe.

## Adding a new profile

1. Add an entry to `config.profiles` in `cordis.patch.yml` (the composition seed), or edit profiles through the plugin's configuration page on the Plugins page (persists to `cordis.patch.yml`).
2. The host half auto-registers the `subagent` tool with a `profile` enum rebuilt from the live list.
3. The client half needs no re-registration: the single `subagent` toolview key covers every profile.

## Adding a new RPC endpoint

1. Add the endpoint string to the `switch` in `src/rpc.ts`.
2. Add the payload/response types to `src/rpc.ts`.
3. Add a client caller in `src/client/index.ts` (or wherever consumed).
4. The endpoint lives on the `/api` channel as an exact Fetch route: add the name to `ENDPOINTS` in `src/rpc.ts` (wire endpoint = `ya-subagent.<name>`, route = `/api/ya-subagent.<name>`); the client caller passes the bare name through `callRpc`.

## Gotchas

- Profile state persists under the entry id `ya-subagent` in the active profile's `cordis.patch.yml`. `config.profiles` is the composition seed; runtime mutations go through `settings.update('ya-subagent', { profiles })`, which updates the live volatile reference in place. `generalFixed` is a non-volatile seed flag.
- **`@deepseek-ai/cordis`, never bare `cordis`**: dsh 0.1.7's module closure serves the scoped name. `scripts/relink-deps.mjs` links both so the local dev tree keeps resolving.
- **`agent/created` is serial and must return `undefined | Promise<undefined>`**; the payload is `{ agent, source, signal? }` (`agent/session-start` no longer exists). A throwing listener rejects agent creation.
- **`JobSpec.owner` is a `SessionId`**, not an `Agent` (`jobs.start({ owner: parent.id, … })`).
- The DSH `RpcError` code union is closed (`'bad-request'`/`'internal'`/`'session-not-found'`/…). Plugin-specific business errors reuse `'internal'` with a descriptive `message`; do NOT attempt to extend the union.
- The DSH `ContinuableSubagentDescriptorData` schema is closed (`parseSubagentDescriptor` rejects unknown keys). Do NOT try to add `profileId` to the descriptor; the parent-session `subagentProfile` projection is the durable `childId → profileId` map.
- **`ctx.sessions` is ambiguous in a single-face tsconfig**: `@deepseek-ai/dsh-session` (Host) declares `sessions: SessionStore` and `@deepseek-ai/dsh-api-session-controller/client` declares `sessions: ISessions`. The client half runs only with the client augmentation, so `src/client/index.ts` narrows the face (`ctx.sessions as unknown as ISessions`) — same pattern as `ctx.connection`.
- **`tool.call.toolview` owner props are a `phase` union** (`'preparing'` has no `argsRaw`; `'start'` has `block.argsRaw`; `'result'` has `block.call?.argsRaw`). Branch on `phase === 'preparing'` first; `StartedToolCallViewProps` excludes that arm.
- **Icons use weight names** since rc.1: `Icon<Name>OutlineRegular`/`OutlineMedium`/`FillRegular`/`FillMedium` (the pixel-suffixed names are gone).
- **Child projections are push-only for the current session**: use `useSessions(state => state.projectionsBySession[id]?.values.<key>)` for non-current sessions and call `sessions.refreshProjections(id)` once to load them.
- `profileLabel` is embedded in the continuable result content (`started <label> subagent <id>`); SubagentCard parses it with zero RPC.
- **Never append plugin-defined event types via `session.append`**: `KNOWN_SESSION_EVENT_TYPES` is code-generated with no plugin registration surface, and any unknown event type makes the harness refuse the whole log on load. The `ya-subagent/started` writes were removed in v0.1.3; the `sessions.repair` RPC + Plugins-page button strips those rows from legacy logs and renumbers the survivors.
