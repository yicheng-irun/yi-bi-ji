# 功能特性

## 笔记管理

- 笔记列表：浏览、新建笔记（回车建）
- markdown 纯文本编辑器（等宽字体），Ctrl+S 保存草稿
- 删除笔记（需确认）

## 草稿与提交

- 笔记同时存储 committed（正式）与 draft（草稿）两套标题、正文
- 草稿内容/标题各自维护版本号（`draftContentVersion` / `draftTitleVersion`），每次修改递增
- 保存草稿时携带 `baseVersion`，服务端校验如果和库中不一致返回 409 → 前端 toast 提示冲突
- 全局 SSE（`/api/events`）实时广播草稿变更，编辑器在无本地未保存内容时自动同步远端变更；有本地修改时显示冲突条（「放弃本地并同步」/「用本地覆盖远端」）
- 提交（commit）将草稿写入正式：可提交整篇笔记（所有 hunk），也可在 diff 视图中仅接受部分 hunk 后提交重组后的内容
- 支持单篇提交、全部提交、放弃全部变更（恢复为正式版）

## 行级 Diff 与 Hunk 视图

- 变更列表页（`/changes`）展示所有 `draft ≠ committed` 的笔记
- 点击某篇进入 Diff 视图：行级 diff（`diff` 库 `structuredPatch`，context=3），渲染为类 GitHub PR Hunk 区块
- 每个 Hunk 有 Accept / Reject 按钮；前端根据接受/拒绝状态实时重组最终内容
- 默认接受所有区块，可自由组合选择

## AI 助手

- 右侧侧边栏，与当前正在编辑的笔记联动（告知 AI 当前笔记 id）
- 对话支持多线程，在 `/conversations` 页面可审计历史会话
- Mastra Agent，提供以下工具：
  - `list_notes` — 列出所有笔记
  - `search_notes` — 关键词模糊搜索（标题 + 正文，分页）
  - `read_note` — 读取笔记草稿，支持行范围（`startLine` / `endLine`）按需读取，避免全量塞入上下文
  - `create_note` — 新建笔记
  - `write_note` — 全量覆盖草稿版本
  - `replace_in_note` — 字符串替换（要求唯一匹配，失败返回原因以便 AI 重试）
  - `insert_block` — 锚点插入区块：文末追加 / 指定标题后 / 指定文本后
- AI 的所有修改只改 draft，不落正式库，同时写入 `ai_change_logs` 审计表
- 流式 SSE 输出：前端实时渲染 text-delta，展示 tool-call / tool-result 卡片

## 会话持久化

- Mastra Memory + LibSQLStore（`data/mastra.db`）持久化对话消息
- 支持多线程对话管理、重新进入历史对话继续沟通
- 便于审计 AI 行为和排查错误

## 实时同步

- 服务端 EventEmitter 事件总线 + `/api/events` SSE 端点
- 事件类型：`note-updated` / `note-created` / `note-committed` / `note-deleted`
- 前端笔记列表、编辑器、变更列表均通过 EventSource 实时响应变更
