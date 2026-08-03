# bi-ji

基于 Vercel AI SDK v7（ToolLoopAgent + useChat）的 agent 笔记系统。pnpm workspace 大仓。

> **功能开发或修改后，必须同步更新 [`FEATURES.md`](./FEATURES.md)**，保持特性说明与实际实现一致。

## 结构

- `apps/server` — Hono + AI SDK v7 + Sequelize(SQLite)，端口 15201
- `apps/web` — React + TS + styled-components + Vite + vite-plugin-pages，端口 15200（/api 代理到 15201）
- `apps/android` — 原生 Kotlin + Compose 客户端（独立 Gradle 工程，不纳入 pnpm workspace），GitHub Actions 编译 APK

## 常用命令

```bash
pnpm install            # 安装依赖
pnpm dev                # 并行启动 server + web
pnpm -r run typecheck   # 类型检查（改完代码必须跑）
pnpm -r run build       # 构建
pnpm test               # 端到端测试（apps/server/tests/，自起服务+临时库，端口 15311；index.mts 汇总，各功能一个 .test.mts）
```

## 配置

`apps/server/.env`（参考 `.env.example`）：

- `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` — OpenAI 兼容端点
- `PORT` — 默认 15201

## 数据

- `apps/server/data/notes.db` — 业务库（Sequelize，启动时 `sync({alter:true})`，索引需具名）；会话存 `chat_threads` / `chat_messages` 表（UIMessage JSON）

## 核心概念

- 笔记有 `committed*`（正式）与 `draft*`（草稿）两套内容 + 草稿版本号计数；AI 和用户只能改 draft，commit 才落库
- diff = 当前草稿 vs 上次提交版本（行级，`diff` 库 structuredPatch）；前端 hunk 级 Accept/Reject 后重组内容提交
- 保存草稿带 baseVersion 校验，冲突返回 409；`/api/events` 全局 SSE 同步草稿变更
- AI 工具只改 draft 并写 `ai_change_logs` 审计表
- AI 对话：`src/agent/` 定义 ToolLoopAgent + 工具（threadId 闭包注入）；`POST /api/chat/threads/:id/stream` 走 AI SDK UI Message Stream（`createAgentUIStreamResponse`），`onEnd` 落库新消息；前端 `useChat` + `DefaultChatTransport`（`prepareSendMessagesRequest` 懒建 thread 并注入 currentNoteId）；上下文窗口为最近 40 条消息
