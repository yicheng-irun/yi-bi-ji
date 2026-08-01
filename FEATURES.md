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
  - `deep_research` — 联网深度调研子代理（`ToolLoopAgent` 嵌套）：主代理把任务委托给独立的研究子代理（独立上下文，web_search/web_fetch + 读写笔记工具，步骤上限 50），子代理进度通过 streaming tool results（preliminary）实时流给前端，前端在工具卡片内渲染子代理的每一步与累积文本；主代理模型侧通过 `toModelOutput` 只看到子代理最终的结构化报告（含来源链接），避免上下文膨胀
- AI 的所有修改只改 draft，不落正式库，同时写入 `ai_change_logs` 审计表（含 `set_note_tags`）
- AI 修改记录页 `/ai-logs`（顶部导航「AI 记录」）：列出 `ai_change_logs`，按笔记/动作筛选、分页加载；每条记录展示动作徽标、笔记标题、摘要、前后字符数与时间，点击展开查看 before→after 的行级 diff（`GET /api/ai-logs`、`GET /api/ai-logs/:id`）；支持单条删除（展开后 🗑）与清空（`DELETE /api/ai-logs/:id`、`DELETE /api/ai-logs`，清空可限定当前筛选条件）
- 流式输出使用 AI SDK UI Message Stream 协议（`createAgentUIStreamResponse`），前端 `@ai-sdk/react` 的 `useChat` 实时渲染文本增量与工具调用卡片
- 支持展示 AI 的推理/思考过程：reasoning 内容以可折叠的「💭 思考过程」卡片呈现（带字数统计），流式过程中高亮并标注「思考过程…」，默认展开，点击标题可折叠/展开
- AI 回复正文按 markdown 渲染（`apps/web/src/components/chat/ChatMarkdown.tsx`，`marked`），针对窄侧边栏做紧凑化：标题缩到与正文接近（h1≈1.1em、h2≈1.05em、h3+≈1em）、去除标题下划线，代码块/表格横向滚动（`overflow-x: auto`）并限制最大宽度，`overflow-wrap/word-break` 防止长内容撑破气泡
- 工具调用卡片可点击展开/收起（`MessageList.tsx` 的 `ToolCard`）：默认收起为工具名小条，展开后展示入参 JSON、执行结果（文本/JSON/子代理过程）与错误信息；子代理运行中自动展开以实时展示进度，普通工具保持收起
- 自定义下拉选择组件 `Select`（`apps/web/src/ui/Select.tsx`）：替代原生 `<select>`，自绘 SVG 箭头图标，菜单为自绘浮层（点击外部/Esc 关闭、方向键 + Enter 选择、悬停高亮），用于 AI 侧边栏顶部的会话切换下拉

## 前端组件库（`apps/web/src/ui/`）

- 仓库无第三方组件库，沉淀自有 UI 组件库 `src/ui/`（barrel 导出 `index.ts`），通用原语统一放这里，业务/功能组件留在 `src/components/`（ChatPanel/ChatSidebar/MarkdownPreview/chat 等）
- `Button`：变体 `default/primary/success/danger/ghost` + 尺寸 `sm/md/lg`，forwardRef，替代全局 `button.btn-*` 类
- `Input`：`size` 取 `md`（高 36px）/`lg`（高 42px），forwardRef，替代全局原生 `input` 样式
- `Badge`：变体 `neutral/accent/success/warning/danger` + 形状 `pill/sm`，统一列表页/变更页/AI 记录页的徽标样式
- `Empty`：`icon + title + compact`（紧凑用于 diff 内空状态），统一各页空状态
- `Select` / `TagInput` / `Loading`：通用原语，已从 `components/` 迁入
- `Modal`：通用弹窗（`createPortal` 渲染到 body、点击遮罩/Esc 关闭、滚动锁），`title/children/footer`，设置页 MCP 服务器编辑用

## 会话持久化

- 会话与消息持久化在业务库（`data/notes.db`）的 `chat_threads` / `chat_messages` 表中，消息以 UIMessage JSON（parts）存储
- 发给模型的上下文截取最近 40 条消息
- 支持多线程对话管理、重新进入历史对话继续沟通
- 子代理（深度调研）每次执行会创建独立的子会话（`chat_threads`，metadata `kind='subagent'` + `parentThreadId` 关联父会话），子代理的完整消息流（含其工具调用与最终报告）持久化到该子会话；可在 `/conversations` 审计页查看（带「🔬 子代理」徽标、可跳回父会话），侧边栏会话下拉自动排除子会话，删除父会话级联删除其子会话
- 打开笔记时自动选中该笔记最近的一条会话（而非新会话），可手动切换或点「+」开始新对话；切换笔记/本笔记·全部范围时同样自动定位到对应最近会话
- 便于审计 AI 行为和排查错误

## 实时同步

- 服务端 EventEmitter 事件总线 + `/api/events` SSE 端点
- 事件类型：`note-updated` / `note-created` / `note-committed` / `note-deleted`
- 前端笔记列表、编辑器、变更列表均通过 EventSource 实时响应变更

## 数据安全（SQLite）

- `sync({alter:true})` 在 SQLite 上重建表时会先建 `{表名}_backup` 临时表；若进程被中断（如 tsx watch 重启竞态），数据可能留在临时表而真实表为空
- 启动 `initDb()` 时先处理遗留 `*_backup` 表：若真实表为空且临时表有数据，先把数据复制回真实表再删除临时表；并在 `sync` 前对 `notes.db` 做一次文件快照（`notes.db.pre-sync.bak`，每次启动覆盖），alter 出问题时可从快照找回

## 设置

- 设置页 `/settings`（顶部导航「设置」）：左侧按类别导航（当前为「大模型」「Agent 能力」「MCP 服务器」「数据备份」，可扩展，`?tab=` 可深链），右侧为当前类别表单
- 设置键按「作用域前缀」命名避免歧义：`ai*` 大模型/Agent、`mcp*` MCP 服务器、`backup*` 备份库、将来主库用 `db*`（`dbType`=sqlite/mysql、`dbPath`=sqlite 文件、`dbHost/dbPort/dbUser/dbPassword/dbDatabase`=mysql）
- 大模型配置：在线修改 Base URL / API Key / 模型名，覆盖 `.env` 默认值，存 `app_settings` 表（内存缓存，启动时加载），保存后对新对话立即生效
- 「思考强度」设置（reasoningEffort：不设置/低/中/高），默认「不设置」；通过 providerOptions `{ custom: { reasoningEffort } }` 下发给主代理与调研子代理，推理模型生效、普通模型自动忽略
- Agent 能力设置：主代理（`aiTools`）与调研子代理（`aiSubagentTools`）可分别勾选可用工具（web_search/web_fetch/deep_research/list_notes/search_notes/read_note/create_note/set_note_tags/write_note/replace_in_note/insert_block/delete_note，子代理不含 deep_research），默认全部勾选；保存为逗号分隔列表，`*` 表示全部，空串表示全部禁用；服务端按配置过滤实际挂载到 `ToolLoopAgent` 的工具，新对话生效
- MCP 服务器设置（`mcpServers`，JSON 数组）：通过 MCP 协议把外部服务器的工具挂载给主代理与调研子代理，用于扩展 Agent 能力；设置页以「列表 + 弹窗编辑」方式配置（不再手写 JSON），每行可开关启用（`enabled` 字段，未启用不挂载工具），下方「工具预览」连接各服务器列出其提供的工具；每项含 `name`（唯一标识，也是工具名前缀）、`type`（http/sse/stdio）、`url`（http/sse 用）、`headers`（http/sse 可选）、`command/args/env`（stdio 用）；加载的工具以 `mcp__{服务器名}__{工具名}` 命名避免与内置工具冲突，配置不变时结果按配置签名缓存复用（不重连），连接失败的服务器跳过并记录错误
- 「测试连接」按钮：`POST /api/settings/test` 用当前配置发一次最小请求验证连通性；`POST /api/mcp/test` 试连所有配置的 MCP 服务器并列出其可用工具

## OpenCode 集成（`apps/opencode-mcp`）

- 独立子应用（`@bi-ji/opencode-mcp`，pnpm workspace 第三个包）：把常驻的 `opencode serve`（HTTP API）封装成标准 MCP 服务器，供 bi-ji 笔记 agent 通过 MCP http transport 调用，实现「在笔记对话里让 agent 驱动 opencode 做开发、查会话、续接对话」
- 架构：`bi-ji server →(MCP http:29420)→ apps/opencode-mcp bridge →(http)→ opencode serve`；bridge 用 Hono + `@modelcontextprotocol/sdk` 的 `WebStandardStreamableHTTPServerTransport`（端点 `/mcp`），pm2 独立部署守护
- 会话机制：opencode serve 常驻（由 bridge spawn + 守护，崩溃自动退避重启），session id 由 opencode 持久化，bridge 无状态转发；bi-ji 侧在设置页 MCP tab 配置 `{ "name": "opencode", "type": "http", "url": "http://127.0.0.1:29420/mcp", "headers": { "Authorization": "Bearer <token>" } }` 即可，工具以 `mcp__opencode__opencode_*` 挂载
- 工具集（围绕会话生命周期）：`opencode_status`（健康/版本）、`opencode_list_sessions`、`opencode_get_session`（详情+消息历史）、`opencode_prompt`（创建会话并发消息，返回 session id）、`opencode_continue`（按 session id 续接）、`opencode_abort`、`opencode_search`（跨文件搜索）、`opencode_run_shell`（在会话上下文执行 shell 命令）
- 配置（`.env`，参考 `.env.example`）：`OPENCODE_URL`（外部 serve 地址，设置后不再 spawn）、`OPENCODE_PORT`/`OPENCODE_HOSTNAME`/`OPENCODE_PROJECT_DIR`（默认仓库根）、`OPENCODE_USERNAME`/`OPENCODE_PASSWORD`（HTTP Basic auth，spawn 时透传给 serve）、`MCP_PORT`（默认 29420）、`MCP_TOKEN`（MCP 端点 Bearer 令牌，局域网部署务必设置）
- 跨机器/局域网：bridge 默认监听 `0.0.0.0:29420`，本机 bi-ji 可连远程机器的 `/mcp` 驱动那台机器的 opencode；`/health` 不带鉴权仅做连通性探测
- 超时策略：普通请求默认 15s（健康检查 3s）避免握手挂起；执行类工具（`opencode_prompt`/`opencode_continue`/`opencode_run_shell`）走长超时默认 10 分钟，避免真实开发任务被误杀
- 测试：`tests/index.mts`（`pnpm --filter @bi-ji/opencode-mcp test`）起 bridge + spawn serve（带 `MCP_TOKEN`），用 `@ai-sdk/mcp` 客户端验证 401 鉴权、8 个工具注册与 `opencode_status` 全链路
- 数据库备份（`POST /api/backup/test`、`POST /api/backup/sync`）：支持两种备份类型，类型与连接信息存 `app_settings` 的 `backup*` 键
  - SQLite（`backupType=sqlite`）：只需填备份文件路径（`backupPath`，自动建目录/建库），校验拒绝指向业务库本身
  - MySQL（`backupType=mysql`）：填 Host/Port/User/Password/数据库名（需预先建库）
  - 「一键备份」在备份库自动建表（notes / chat_threads / chat_messages / ai_change_logs / app_settings，通用 schema 由 Sequelize 按 dialect 生成 DDL）并清空后全量同步数据（事务内执行，返回各表行数）
