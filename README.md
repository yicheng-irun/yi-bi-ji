# bi-ji

> 一个**纯 AI 编写**的 Agent 笔记工具。

## 这是什么 / 为什么做这个项目

本项目是一次「边学边做」的实践产物。

它的出发点很简单：**想学习 AI Agent 的工作原理，但光看文档和 demo 不够，需要有一个真实的项目作为产出，来验证自己到底学会了多少、能用 Agent 做出什么。**

于是我们让 AI 从零到一构建了一个完整的应用——一个围绕「笔记」展开的 Agent 笔记系统。整个仓库的设计、编码、联调都由 AI 完成，人类只负责提出需求与验收。它既是一个可用的工具，也是一份「AI 能否独立交付一个中等复杂度全栈应用」的实践答卷。

### 项目的作用

- **对于学习者**：它是理解 AI Agent（Vercel AI SDK v7）、工具调用（tool calling）、会话记忆、流式输出与多端实时同步的活样例。通过阅读代码，可以看到一个 Agent 如何被赋予读写笔记的能力，并通过工具与业务数据交互。
- **对于使用者**：它也是一个真正能用的笔记工具——支持 Markdown 编辑、草稿/正式双版本管理、行级 diff 提交、以及内置一个能帮你查资料、写笔记、改笔记的 AI 助手。

简单说：**用 AI 造一个带 AI 助手的笔记软件，既是学习 Agent 的练习场，也是验证学习成果的成品。**

---

## 项目概览

基于 [Vercel AI SDK v7](https://sdk.vercel.ai/)（ToolLoopAgent + useChat）的 Agent 笔记系统，采用 pnpm workspace 大仓结构。

- `apps/server` — Hono + Vercel AI SDK v7 + Sequelize(SQLite)，端口 `15201`
- `apps/web` — React + TypeScript + styled-components + Vite + vite-plugin-pages，端口 `15200`（`/api` 代理到 `15201`）

### 核心概念

- 笔记有 `committed`（正式）与 `draft`（草稿）两套内容 + 草稿版本号计数；AI 和用户都只能改 draft，commit 才落库。
- 行级 diff = 当前草稿 vs 上次提交版本（`diff` 库 `structuredPatch`）；前端支持 hunk 级 Accept/Reject 后重组内容提交。
- 保存草稿带 `baseVersion` 校验，冲突返回 `409`；`/api/events` 全局 SSE 实时同步草稿变更。
- AI 工具只改 draft，并写入 `ai_change_logs` 审计表，便于追溯 Agent 行为。

### 功能特性

完整的特性说明见 [`FEATURES.md`](./FEATURES.md)，要点包括：

- 笔记管理：Markdown 编辑、多视图模式、两阶段删除（待确认删除）。
- 草稿与提交：双版本管理、版本冲突检测、SSE 实时同步、单篇/全部提交、放弃变更。
- 行级 Diff 与 Hunk 视图：类 GitHub PR 的 hunk 区块，支持按块接受/拒绝。
- AI 助手：与当前笔记联动的右侧侧边栏，内置 `list_notes` / `search_notes` / `read_note` / `write_note` / `replace_in_note` / `insert_block` / `web_search` / `web_fetch` / `deep_research`（联网调研子代理，实时展示子代理进度）等工具，流式输出并展示工具调用卡片。
- 会话持久化：会话存 `chat_threads` / `chat_messages` 表（UIMessage JSON），支持多线程对话与审计。
- 实时同步：事件总线 + SSE，列表、编辑器、变更列表多端实时响应。

---

## 快速开始

### 前置要求

- Node.js（建议使用近期 LTS 版本）
- pnpm

### 安装与运行

```bash
pnpm install   # 安装依赖

pnpm dev       # 并行启动 server(15201) + web(15200)
```

启动后访问 http://localhost:15200 即可使用 Web 界面。

### 常用命令

```bash
pnpm install            # 安装依赖
pnpm dev                # 并行启动 server + web
pnpm -r run typecheck   # 类型检查（改完代码必须跑）
pnpm -r run build       # 构建
pnpm test               # 端到端测试（apps/server/tests/，自起服务+临时库，端口 15311；index.mts 汇总，各功能一个 .test.mts）
```

### 服务端配置

`apps/server/.env`（参考 `.env.example`）：

- `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` — OpenAI 兼容端点
- `PORT` — 默认 `15201`

### 数据存储

- `apps/server/data/notes.db` — 业务库（Sequelize，启动时 `sync({alter:true})`，索引需具名）；会话存 `chat_threads` / `chat_messages` 表（UIMessage JSON）

---

## 目录结构

```
.
├── apps/
│   ├── server/        # Hono + Vercel AI SDK v7 + Sequelize 后端服务
│   └── web/           # React + Vite 前端
├── FEATURES.md        # 功能特性详细说明
├── AGENTS.md          # 项目开发指引（给 AI 看）
└── package.json       # pnpm workspace 根配置
```

---

## 备注

这是一个用于学习与实践的项目，由 AI 端到端生成。如果你也在学习 AI Agent，欢迎通过阅读源码来理解一个 Agent 应用从架构到落地的完整形态。
