<p align="center">
  <a href="https://dshfind.com/zh/plugins/huanlinoto/dsh-plugin-yet-another-subagent"><img src="https://dshfind.com/api/card/huanlinoto/dsh-plugin-yet-another-subagent?lang=zh" alt="dsh-plugin-yet-another-subagent card"></a>
</p>

# yet-another-subagent

[![npm version](https://img.shields.io/npm/v/@huanlin/dsh-plugin-yet-another-subagent)](https://www.npmjs.com/package/@huanlin/dsh-plugin-yet-another-subagent)

可配置的子代理（subagent）profile 系统，提供单一 `subagent` 工具 + `profile` 参数选择，支持 Web UI 设置、实时进度展示（工具调用/token/活动）、子代理树标签页、点击跳转子会话。

## 架构

单 bundle，三入口（host `.` + invariant `./invariant` + client `./client`）。

- **Host 半**（`src/index.ts`）：
  - 单一 `subagent` 工具，通过 `profile` 枚举参数选择 profile（非每 profile 一个工具）
  - 复用官方 `spawn` provider，支持前台（foreground）和后台（continuable / one-shot）两种模式
  - Profile 状态通过 settings seam 持久化到 `$DSH_HOME/settings.yaml`
  - RPC CRUD：`profiles.list` / `.add` / `.update` / `.remove`（专用 `/ya-subagent` 通道，不共享 `/api`）
  - 两个 session projection：`subagentProfile`（父会话 childId→profileId 映射 + callId→childId）+ `yaSubagentProgress`（子会话实时 toolcall/token/活动状态）
- **Client 半**（`src/client/index.ts`）：
  - `settings.section` — Profile 编辑页
  - `tool.call.toolview`（key `subagent`）— `SubagentCard` 工具调用卡片
  - `conversation.view`（id `subagent-tree`）— `SubagentTreeView` 子代理树标签页

`cordis.patch.yml` 只禁用官方 `tool-subagent`（spawn 路径），保留 `tool-subagent-fork`（无名称冲突）。

## 配置

```yaml
# cordis.patch.yml
- id: tool-subagent
  disabled: true

- insert:
    - id: yet-another-subagent
      name: '@huanlin/dsh-plugin-yet-another-subagent'
      config:
        profiles:
          - id: general
            label: General
            model: { kind: 'auto' }
            persona: { kind: 'inherit' }
            toolFilter: { kind: 'none' }
            maxDepth: 3
            backgroundMode: continuable
            builtin: true
        generalFixed: true
```

### Profile 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `string`（小写字母/数字/连字符，1-32 字符） | — | Profile 唯一标识 |
| `label` | `string` | — | 显示名 |
| `model.kind` | `'auto'` \| `'manual'` | — | `auto` 继承父代理模型；`manual` 指定 |
| `model.provider` | `string` | `''` | Provider（仅 `manual` 时使用） |
| `model.model` | `string` | `''` | 模型 ID（仅 `manual` 时使用） |
| `persona.kind` | `'inherit'` \| `'custom'` | `'inherit'` | `inherit` 跟随部署人设；`custom` 自定义 |
| `persona.text` | `string` | `''` | 自定义人设文本（仅 `custom` 时使用） |
| `toolFilter.kind` | `'none'` \| `'allow'` \| `'deny'` | `'none'` | 工具过滤策略 |
| `toolFilter.tools` | `string[]` | `[]` | 过滤工具列表 |
| `maxDepth` | `number` | `3` | 最大递归深度 |
| `backgroundMode` | `'continuable'` \| `'one-shot'` | `'continuable'` | `run_in_background: true` 时的后台策略 |
| `builtin` | `boolean` | `false` | 是否为内置 profile（仅展示用） |

## 开发

```sh
pnpm install          # 安装开发依赖 + zod（唯一运行时 npm 依赖）
pnpm run typecheck    # tsc --noEmit（通过 ../dsh 解析 DSH 源码）
pnpm test             # vitest run
pnpm run build        # tsc + tsdown → lib/index.js, lib/invariant.js, lib/client.js
```

### 类型检查

`tsconfig.json` 继承 `../dsh/tsconfig.base.client.json`，通过 `pnpm-workspace.yaml` 的 `packages/*/*` glob 解析 DSH checkout 的源码。需在 `../dsh` 存在 DSH checkout 的同级目录下运行。

## 运行

```sh
# 从 npm 安装（推荐）：
dsh plugin --profile web add @huanlin/dsh-plugin-yet-another-subagent

# 本地引用（开发热更新）
dsh plugin --profile web add "link:D:/Projects/deepseek-harness/yet-another-subagent"
```

安装后重启 `dsh web` 进程，浏览器硬刷新（`Ctrl+Shift+R`）。

## 检查

```sh
pnpm run typecheck    # 0 errors
pnpm test             # 55 tests passing
pnpm run build        # lib/index.js + lib/invariant.js + lib/client.js
```

### 产物验证

- `lib/index.js` — Host bundle
- `lib/invariant.js` — Invariant companion
- `lib/client.js` — Client bundle（CSS-modules inline，`d` 前缀 hash 防 CSS 类名数字开头）
- `cordis.patch.yml` — Bundle patch layer

## 持久化

Profile 状态通过 DSH settings seam 持久化到 `$DSH_HOME/settings.yaml` 的 `ya-subagent` 命名空间。cordis.yml 的 `profiles` 字段是组合 `base`（首次启动种子），运行时变更通过 `scope.replace()` 写入用户层。外部 yaml 编辑通过 `scope.watch` 热重载。

无 settings provider 的无头组装回退到内存状态（仅 cordis.yml 种子，不持久化）。

## RPC API

Profile CRUD 走 host 的专用 `/ya-subagent` 通道（不共享 `/api`，避免与 Typert gateway 的单拦截器冲突）：

| endpoint | payload | result (ok) |
|----------|---------|-------------|
| `profiles.list` | `{}` | `{ profiles: SubagentProfile[] }` |
| `profiles.add` | `{ profile: SubagentProfile }` | `{ profiles: SubagentProfile[] }` |
| `profiles.update` | `{ profile: SubagentProfile }` | `{ profiles: SubagentProfile[] }` |
| `profiles.remove` | `{ id: string }` | `{ profiles: SubagentProfile[] }` |
| `tools.list` | `{}` | `{ tools: { name, description }[] }` |

URL 形如 `POST /ya-subagent/profiles.list`。业务错误返回 `{ ok: false, error: { code: 'internal', message } }`。

## 已知限制

- **旧会话不兼容**：`completed <label> subagent <id>` render 格式变更后，旧会话的结果文本无法被 `parseResult` 匹配，卡片不可点击。仅新会话（host 重启后）正常。
- **`yaSubagentProgress` stateVersion 2**：projection schema 变更（`activity` 字段 + `assistant/chunk` fold）需要 host 重启才能生效。

## 设计参考

- 官方 continuable subagent 设计：`.agents/notes/implemented/feature/2026-07-28-continuable-subagent-conversations.md`
- 插件开发指南：`plugin-development-guide.md`
