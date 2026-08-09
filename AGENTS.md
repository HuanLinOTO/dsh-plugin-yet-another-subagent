# yet-another-subagent — Agent Guide

## Plugin overview

Bundle-style DSH plugin exposing configurable subagent profiles as model-facing `subagent_<id>` tools. Web UI settings, real-time toolcall/token display, click-to-navigate child sessions. Disables official `tool-subagent` and `tool-subagent-fork`.

## Key conventions

- **Bundle form**: `cordis.patch.yml` disables two official rows + inserts one plugin row; `package.json` has `dsh.bundle.patch`. No source patches to DSH staging.
- **Peer deps**: cordis + schemastery + `@deepseek-ai/dsh-*` (provided by host). `zod` is the only runtime npm dep.
- **Single bundle, dual entry**: `.` (host), `./client` (browser), `./invariant` (companion).
- **Persistence via settings seam**: profile state lives under the `ya-subagent` namespace in `$DSH_HOME/settings.yaml`. `ctx.inject(['settings'], …)` registers the namespace with cordis.yml config as composition `base`; `ProfileStore.attachScope(scope)` wires CRUD mutations to `scope.replace()`. External yaml edits hot-reload through `scope.watch` → `reloadFromScope` → `syncTools`. Headless assemblies (no settings provider) fall back to in-memory state.
- **Profile = tool instance**: each user-configured profile maps to a `subagent_<profile_id>` tool registered via `ctx.tools.register(defineTool(...))`. Reuses official `spawn` provider via `ctx.subagents.startContinuable`.
- **ProfileLabel in result content**: tool execute embeds `profileLabel` in the continuable result content (`started <label> subagent <id>`), so SubagentCard reads it with zero RPC (SkillRow paradigm).
- **Profile CRUD via rpc.intercept**: `ya-subagent/profiles.list`/`.add`/`.update`/`.remove` on the shared `/api` channel; business errors reuse the closed `internal` RpcError code with descriptive messages.
- **Two projections**:
  - `subagentProfile` (parent session): fold `tool/call.name` + `tool/result` content → `childId → profileId` map.
  - `yaSubagentProgress` (child session): fold `tool/call`, `assistant/message.usage`, `turn/start`, `turn/end` → live toolcall count + token totals + state.
- **ESM-only**: `"type": "module"`, relative imports use `.ts` extensions (allowImportingTsExtensions + rewriteRelativeImportExtensions).

## File responsibilities

| File | Role |
|------|------|
| `src/index.ts` | Host entry: `name`, `inject = ['tools', 'subagents', 'sessionProjections']`, `Config` (Schemastery), `apply` (settings namespace registration + scope.watch) |
| `src/invariant.ts` | `./invariant` companion (empty installer: registrations are HMR-proven) |
| `src/types.ts` | `SubagentProfile`, `YaSubagentConfig`, `agentOptionsFor`, `isValidProfileId` |
| `src/profile-store.ts` | `ProfileStore` class with CRUD (`add`/`update`/`remove`/`list`/`get`) + `attachScope`/`reloadFromScope` for settings persistence |
| `src/tool-factory.ts` | `buildTool(profile, ctx)` → `defineTool` options (continuable default + foreground fallback) |
| `src/rpc.ts` | `registerRpc(ctx, store)` via `ctx.inject(['connection'], …)` + `rpc.intercept('/api', …)` |
| `src/projection.ts` | `subagentProfileProjection` + `yaSubagentProgressProjection` + `SessionProjectionMap` merge |
| `src/client/index.ts` | Client entry: `inject = ['slots', 'locale', 'sessions', 'connection']`, registers `settings.section` + per-profile `tool.call.toolview` |
| `src/client/SubagentCard.tsx` | Keyed toolview component (parses `block.content`, subscribes child projection, click-to-open) |
| `src/client/SettingsPage.tsx` | `settings.section` component (RPC CRUD + re-sync toolviews) |
| `src/client/locales.ts` | English + Chinese dictionaries for the `ya-subagent` namespace |
| `tests/profile-store.spec.ts` | Unit tests for `ProfileStore` CRUD + validation |
| `tests/profile-store-persistence.spec.ts` | Unit tests for settings scope persistence (attach/reload/external-edit fallback) |
| `tests/projection.spec.ts` | Unit tests for both projection folds |

## Commands

```sh
pnpm run typecheck    # tsc --noEmit (resolves DSH src through ../dsh)
pnpm test             # vitest run
pnpm run build        # tsc + tsdown → lib/index.js, lib/invariant.js, lib/client.js
```

## Adding a new profile

1. Add an entry to `config.profiles` in `cordis.patch.yml` (or via the settings UI at runtime).
2. The host half auto-registers a `subagent_<id>` tool when the spawn provider appears.
3. The client half auto-registers a `subagent_<id>` keyed toolview when the profile list is fetched.

## Adding a new RPC endpoint

1. Add the endpoint string to the `switch` in `src/rpc.ts`.
2. Add the payload/response types to `src/rpc.ts`.
3. Add a client caller in `src/client/SettingsPage.tsx` (or wherever consumed).
4. Endpoints MUST start with `ya-subagent/` (the `ownsEndpoint` matcher).

## Gotchas

- Profile state persists under the `ya-subagent` settings namespace in `$DSH_HOME/settings.yaml`. The cordis.yml `profiles` field is the composition `base` (first-boot seed); runtime mutations go through `scope.replace()`. The `WEB_SETTINGS_NAMESPACES` allowlist only blocks the standard wire `settings.update`/`settings.describe` calls — it does NOT block in-process `scope.replace()` from the plugin's own RPC handler.
- The DSH `RpcError` code union is closed (`'bad-request'`/`'internal'`/`'session-not-found'`/…). Plugin-specific business errors reuse `'internal'` with a descriptive `message`; do NOT attempt to extend the union.
- The DSH `ContinuableSubagentDescriptorData` schema is closed (`parseSubagentDescriptor` rejects unknown keys). Do NOT try to add `profileId` to the descriptor; the parent-session `subagentProfile` projection is the durable `childId → profileId` map.
- Client runtime is single-stage: non-current `session/event` frames are dropped. Live child progress MUST go through a projection (the `yaSubagentProgress` projection frame reaches ALL sessions).
- `profileLabel` is embedded in the continuable result content (`started <label> subagent <id>`); SubagentCard parses it with zero RPC (SkillRow paradigm).
- The continuable child auto-enters the parent's catalog when `startContinuable` accepts the initial prompt; `sessions.openSubagent({ mode: 'continuable' })` validates `kind === 'child' && entry.mode === address.mode`. A best-effort `refreshSubagents(parentId)` before programmatic open avoids stale-catalog throws.
