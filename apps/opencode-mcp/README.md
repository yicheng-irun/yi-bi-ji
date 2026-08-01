# @bi-ji/opencode-mcp

opencode 的 MCP 桥接子应用：把常驻的 `opencode serve`（HTTP API）封装成标准 MCP 服务器，供 bi-ji 的笔记 agent 通过 MCP 调用，实现「在笔记对话里让 agent 驱动 opencode 做开发、查会话、续接对话」。

> **当前状态：仅设计文档，未实现。** 开工时先通读本文档，按「实现清单」逐项落地。

## 背景与目标

用户场景：在 bi-ji 笔记系统的 agent 对话中，希望 agent 能：

1. 调用 opencode 执行**开发类任务**（改代码、跑命令等）
2. **查询** opencode 已有会话（历史、消息）
3. **基于某会话继续对话**（续接上下文，不是每次冷启动新会话）

关键约束（决定了架构）：

- **会话是有状态的**：opencode 的会话存在它自己的 `~/.local/share/opencode/opencode.db`，每次冷启动会丢失会话连续性。因此 **opencode serve 必须常驻**，不能每次「拉起 → 调用 → 返回 → 退出」。
- 消费者是 bi-ji 内置的 `ToolLoopAgent`（AI SDK v7），bi-ji 已具备 MCP 客户端能力（`apps/server/src/agent/mcp.ts` + 设置页 MCP 配置），通过标准 MCP http transport 即可接入，bi-ji 侧几乎零改动。

## 架构

```
┌─────────────┐   MCP (http)   ┌──────────────────┐   http   ┌──────────────┐
│ bi-ji server│ ─────────────► │ apps/opencode-mcp│ ───────► │ opencode serve│
│ (agent+MCP) │                │  (bridge, pm2)   │          │  (:4096)     │
└─────────────┘                └──────────────────┘          └──────────────┘
```

- `apps/opencode-mcp` 是 pnpm workspace 的第三个包（根 `pnpm-workspace.yaml` 用 `apps/*` glob，新目录自动纳入）。
- bi-ji 设置页 → MCP 服务器 → 新增一行：
  ```json
  { "name": "opencode", "type": "http", "url": "http://127.0.0.1:9410/mcp", "enabled": true }
  ```
- 用 pm2 独立部署并守护本子应用（`ecosystem.config.cjs`）。

## 已定的决策

| 决策点 | 结论 |
|---|---|
| MCP 形态 | **标准 MCP server（http transport）**，独立子应用，pm2 守护 |
| 会话机制 | opencode serve 常驻；session id 由 opencode 持久化；bridge 无状态转发 |
| opencode serve 托管 | **方案 A：由本子应用进程 spawn + 守护 opencode serve**（pm2 只管 mcp 这一个进程），OPENCODE_URL 指向内置地址，端口可配 |
| 会话续接 | `opencode_prompt` 返回 session id → agent 用 `opencode_continue(sessionId, ...)` 续接；**可选增强**：bi-ji 侧把 session id 存进 `chat_threads.metadata`（`opencodeSessionId`），让「接着上次任务」更顺滑 |
| 依赖 | `@modelcontextprotocol/sdk`（MCP server）+ zod；运行时用 tsx；pm2 进程管理 |

## 目录结构（预期）

```
apps/opencode-mcp/
  package.json              # @bi-ji/opencode-mcp，scripts: dev/start/build/typecheck
  tsconfig.json
  ecosystem.config.cjs      # pm2 配置
  .env.example
  src/
    index.ts                # 入口：spawn opencode serve + 启动 MCP server（StreamableHTTP transport）
    opencode-client.ts      # fetch opencode HTTP API 的薄封装
    tools.ts                # MCP 工具定义（见「工具集」）
    serve-manager.ts        # opencode serve 子进程的 spawn / 健康检查 / 崩溃重启 / 退出清理
  tests/                    # （可选，与 @bi-ji/server 同风格：tests/index.mts + helpers）
```

## 工具集（围绕会话生命周期建模）

| 工具 | 作用 | 对应 opencode HTTP API |
|---|---|---|
| `opencode_status` | 健康检查 / 版本 / 是否连上 | `GET /global/health` |
| `opencode_list_sessions` | 列出已有会话 | `GET /session` |
| `opencode_get_session` | 会话详情 + 消息历史 | `GET /session/:id`、`GET /session/:id/message` |
| `opencode_prompt` | 创建会话并发消息，返回结果 + session id | `POST /session`、`POST /session/:id/message` |
| `opencode_continue` | 在指定 session 上继续对话 | `POST /session/:id/message` |
| `opencode_abort` | 中止运行中的会话 | `POST /session/:id/abort` |
| `opencode_search` | 跨文件搜索（开发时定位代码） | `GET /find?pattern=` |
| `opencode_run_shell` | 让 opencode 执行 shell 命令 | `POST /session/:id/shell` |

工具描述需明确说明「会改动代码/执行命令」，便于 agent 判断使用时机与向用户说明。

## 实现要点

### 1. opencode serve 托管（serve-manager.ts）
- 通过 `child_process.spawn` 启动 `opencode serve --port <port> --hostname 127.0.0.1`，`OPENCODE_URL` 可覆盖（兼容用户已手动跑的 serve，此时不 spawn）。
- 启动后轮询 `GET /global/health` 直到就绪；进程退出码非 0 时自动重启（带退避）。
- 进程退出时（SIGTERM/SIGINT）先 kill 子进程再退出。

### 2. MCP server（index.ts）
- 用 `@modelcontextprotocol/sdk` 的 `StreamableHTTPTransport`（对应 opencode 侧的 http transport）。
- 注册上面 7~8 个工具；`opencode_client` 实例注入工具闭包。
- 端口默认 `9410`（避免与 bi-ji 15201 / opencode 4096 冲突），路径 `/mcp`。

### 3. opencode-client.ts
- 封装 fetch，统一处理 `OPENCODE_SERVER_PASSWORD`（HTTP Basic auth，用户名默认 `opencode`）。
- 提供 `health / listSessions / getSession / getMessages / createSession / sendMessage / abort / find / shell` 方法，返回类型参考 opencode 的 OpenAPI（`/doc` 或 `@opencode-ai/sdk` 的 types）。

### 4. 会话续接（可选增强，涉及 bi-ji）
- `apps/server/src/services/chat.ts` 的 `threadToJson` 与 `ChatThread.metadata` 已支持任意字段，只需在创建/续接时写入 `opencodeSessionId`。
- 在 `apps/server/src/agent/` 的 opencode 工具说明或注入逻辑里提示：优先用当前 thread 已绑定的 session id。

### 5. bi-ji 集成验证
- bi-ji 设置页 MCP tab 配置 http 型服务器后，「工具预览」应列出 `opencode_*` 工具。
- 在侧边栏对话里让 agent 调用 `opencode_status` / `opencode_prompt` 验证全链路。

## pm2 部署（生态文件示意）

```js
// ecosystem.config.cjs（预期）
module.exports = {
  apps: [{
    name: 'opencode-mcp',
    script: 'pnpm',
    args: '--filter @bi-ji/opencode-mcp dev',
    cwd: '<repo 根路径>',
    autorestart: true,
    max_restarts: 10,
    restart_delay: 3000,
    env: { OPENCODE_PORT: '4096', MCP_PORT: '9410' },
  }],
}
```

## 实现清单（TODO，按序开工）

- [ ] `pnpm init` 目录 + `package.json`（`@bi-ji/opencode-mcp`，dep: `@modelcontextprotocol/sdk`、`zod`；devDep: `tsx`、`typescript`、`@types/node`）
- [ ] `tsconfig.json`（参考 `apps/server`：ES2022 / moduleResolution bundler / strict / noEmit + allowImportingTsExtensions）
- [ ] `src/opencode-client.ts`：HTTP 封装 + 类型
- [ ] `src/serve-manager.ts`：spawn/健康检查/重启/清理
- [ ] `src/tools.ts`：注册全部工具
- [ ] `src/index.ts`：入口接线（serve 托管 → MCP server 启动）
- [ ] `.env.example`：`OPENCODE_URL` / `OPENCODE_PORT` / `OPENCODE_USERNAME` / `OPENCODE_PASSWORD` / `MCP_PORT`
- [ ] `ecosystem.config.cjs`
- [ ] 冒烟验证：`opencode serve` 起后被 mcp 连上；用 MCP 客户端（或 bi-ji 设置页工具预览）列出工具
- [ ] 端到端：bi-ji 侧配置后 agent 调 `opencode_status` → `opencode_prompt` 完整走通
- [ ] （可选增强）bi-ji 侧 `chat_threads.metadata.opencodeSessionId` 续接
- [ ] 更新根 `FEATURES.md`：新增「OpenCode 集成」说明

## 参考链接

- opencode MCP（作为客户端）文档：https://opencode.ai/docs/mcp-servers/
- opencode Server HTTP API（本子应用桥接的目标）：https://opencode.ai/docs/server/
- opencode CLI（`opencode run` / `opencode serve` 用法）：https://opencode.ai/docs/cli/
- bi-ji 现有 MCP 客户端：`apps/server/src/agent/mcp.ts`、`apps/server/src/routes/mcp.ts`
