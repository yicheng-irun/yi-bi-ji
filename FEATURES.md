# 功能特性

## 笔记管理

- 笔记列表：浏览、新建笔记（回车建）
- markdown 纯文本编辑器（等宽字体），Ctrl+S 保存草稿
- 编辑器三种视图模式（顶部导航栏插槽中，位于「隐藏 AI / 删除」按钮左侧的分段控件切换）：`编辑`（默认，纯 markdown 文本编辑）、`双列`（左编辑 + 右实时预览并排）、`预览`（纯 markdown 渲染预览，不含编辑器）；预览由 `marked` 渲染（`apps/web/src/components/MarkdownPreview.tsx`）
- 浏览器标签页标题（`document.title`）随页面变化：笔记编辑页显示笔记标题（随输入实时更新），变更详情页显示「变更：xxx」，列表/变更/会话页显示对应页面名，格式为 `xxx - bi-ji`
- 站点 favicon 为手绘 SVG（`apps/web/public/favicon.svg`）：靛蓝渐变圆角底 + 折角便签纸 + 铅笔，与应用主色一致
- 删除笔记为两阶段：删除操作仅标记 `deletedAt`（待确认删除），需到变更页（`/changes`）「确认删除」后才真正落库删除；也可「撤销删除」恢复
- 待删除笔记在列表页显示「待确认删除」红色徽标，且禁止编辑草稿（用户与 AI 均被拦截）
- 笔记标签：独立 `TagInput` 组件（antd 风格标签输入），输入文字回车（或逗号）即成一标签，悬停标签显示删除按钮可移除，输入框为空时按退格键从后往前删除最后一个标签；支持全站已有标签作为候选下拉，整体替换持久化（空数组即清空）

## 草稿与提交

- 笔记同时存储 committed（正式）与 draft（草稿）两套标题、正文
- 草稿内容/标题各自维护版本号（`draftContentVersion` / `draftTitleVersion`），每次修改递增
- 保存草稿时携带 `baseVersion`，服务端校验如果和库中不一致返回 409 → 前端 toast 提示冲突
- 全局 SSE（`/api/events`）实时广播草稿变更，编辑器在无本地未保存内容时自动同步远端变更；有本地修改时显示冲突条（「放弃本地并同步」/「用本地覆盖远端」）
- 防自回环：前端每个页面实例持有随机 `CLIENT_ID`，保存草稿时随请求上送，`note-updated` 事件回带 `clientId`，编辑器忽略自己产生的回声事件（避免 SSE 先于 HTTP 响应到达时误报冲突）；保存请求进行中忽略重复触发（避免旧 base 版本造成假 409）
- 提交（commit）将草稿写入正式：可提交整篇笔记（所有 hunk），也可在 diff 视图中仅接受部分 hunk 后提交重组后的内容
- 支持单篇提交、全部提交、放弃全部变更（恢复为正式版）

## 行级 Diff 与 Hunk 视图

- 变更列表页（`/changes`）展示所有 `draft ≠ committed` 的笔记，以及被标记待删除（`deletedAt`）的笔记
- 待删除笔记在变更详情页展示删除确认视图：「确认删除」（提交 = 永久删除）/「撤销删除」（恢复笔记）；全部提交时会一并执行待删除笔记的永久删除（确认框中提示删除数量）
- 点击某篇进入 Diff 视图：行级 diff（`diff` 库 `structuredPatch`，context=3），渲染为类 GitHub PR Hunk 区块
- 每个 Hunk 有 Accept / Reject 按钮；前端根据接受/拒绝状态实时重组最终内容
- 默认接受所有区块，可自由组合选择

## AI 助手

- 右侧侧边栏，与当前正在编辑的笔记联动（告知 AI 当前笔记 id）
- 对话支持多线程，在 `/conversations` 页面可审计历史会话
- AI SDK v7 `ToolLoopAgent`（OpenAI 兼容端点），提供以下工具：
  - `list_notes` — 列出所有笔记
  - `search_notes` — 关键词模糊搜索（标题 + 正文，分页）
  - `read_note` — 读取笔记草稿，支持行范围（`startLine` / `endLine`）按需读取，避免全量塞入上下文
  - `create_note` — 新建笔记
  - `write_note` — 全量覆盖草稿版本
  - `replace_in_note` — 字符串替换（要求唯一匹配，失败返回原因以便 AI 重试）
  - `insert_block` — 锚点插入区块：文末追加 / 指定标题后 / 指定文本后
  - `delete_note` — 标记笔记待删除（软删除，需变更页确认）
  - `set_note_tags` — 设置笔记标签
  - `web_search` — 联网搜索（Bing/百度，Playwright 真实浏览器）
  - `web_fetch` — 打开网页提取正文；动态页面就绪策略为 networkidle 短等 + DOM 稳定性（MutationObserver）+ 内容不足时滚动到底触发懒加载；HTML 页面默认返回 Markdown（保留链接/图片地址并转绝对 URL，可选 `format: 'text'` 纯文本），JSON/纯文本/XML 等文本类接口响应直接返回原始内容（JSON 自动格式化），长内容用 `start`/`maxChars` 翻页
  - `deep_research` — 联网深度调研子代理（`ToolLoopAgent` 嵌套）：主代理把任务委托给独立的研究子代理（独立上下文，仅 web_search/web_fetch 工具，步骤上限 20），子代理进度通过 streaming tool results（preliminary）实时流给前端，前端在工具卡片内渲染子代理的每一步与累积文本；主代理模型侧通过 `toModelOutput` 只看到子代理最终的结构化报告（含来源链接），避免上下文膨胀
- AI 的所有修改只改 draft，不落正式库，同时写入 `ai_change_logs` 审计表
- 流式输出使用 AI SDK UI Message Stream 协议（`createAgentUIStreamResponse`），前端 `@ai-sdk/react` 的 `useChat` 实时渲染文本增量与工具调用卡片
- 支持展示 AI 的推理/思考过程：reasoning 内容以可折叠的「💭 思考过程」卡片呈现（带字数统计），流式过程中高亮并标注「思考过程…」，默认展开，点击标题可折叠/展开
- AI 回复正文按 markdown 渲染（`apps/web/src/components/chat/ChatMarkdown.tsx`，`marked`），针对窄侧边栏做紧凑化：标题缩到与正文接近（h1≈1.1em、h2≈1.05em、h3+≈1em）、去除标题下划线，代码块/表格横向滚动（`overflow-x: auto`）并限制最大宽度，`overflow-wrap/word-break` 防止长内容撑破气泡
- 工具调用卡片可点击展开/收起（`MessageList.tsx` 的 `ToolCard`）：默认收起为工具名小条，展开后展示入参 JSON、执行结果（文本/JSON/子代理过程）与错误信息；子代理运行中自动展开以实时展示进度，普通工具保持收起

## 会话持久化

- 会话与消息持久化在业务库（`data/notes.db`）的 `chat_threads` / `chat_messages` 表中，消息以 UIMessage JSON（parts）存储
- 发给模型的上下文截取最近 40 条消息
- 支持多线程对话管理、重新进入历史对话继续沟通
- 打开笔记时自动选中该笔记最近的一条会话（而非新会话），可手动切换或点「+」开始新对话；切换笔记/本笔记·全部范围时同样自动定位到对应最近会话
- 便于审计 AI 行为和排查错误

## 实时同步

- 服务端 EventEmitter 事件总线 + `/api/events` SSE 端点
- 事件类型：`note-updated` / `note-created` / `note-committed` / `note-deleted`
- 前端笔记列表、编辑器、变更列表均通过 EventSource 实时响应变更
