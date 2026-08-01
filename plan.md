我想实现一个基于 mastra 的 具有agent功能笔记系统
功能是在网页中打开和编辑，
markdown的编辑器，纯文本编辑，笔记的侧边可以和AI对话。
pnpm 管理大仓
前端 react ts styled-components  vite  vite动态收集页面路由
后端 ts  honojs  sequelize  sequelize自动sync和alter数据库，sequelize的索引记得要具名。自己本地使用，不会大变更，所以允许 sync alter。
本地可以先sqlite
ai能读当前的，以及所有库里的笔记，也能修改笔记的内容，
AI 读库时，不是全量塞给模型，是AI可以自己搜索，和读取，或读取指定的行的范围，提供相应的工具。

RAG 向量搜索 本次先不做，晚点再做。

需要有笔记修改和确认提交的概念，包括人修改的部分，类似git的管理。
能找到所有有更改的笔记，能查看变更，还原一部分diff出来的区块变更，或者还原某一篇笔记的变更。
不做git那种全历史记录存储，只基于库里的存储版本，做类似git的管理，以避免AI或者人改错，导致db中的全面覆盖。
所以没过一段时间，就会手动确定修改，并真实落库存储(真实落库就是覆盖模式的)，下一次的修改判断，就是基于前一次的真实落库db后的版本，进行对比的。

变更粒度是整篇笔记，如果AI或者人同时改了3篇笔记，可以一次性提交单篇的changeSet,或者一次性提交全部。
AI 和 用户只能改 draft，不能直接 commit，用户确认后才真实落库。

Hono 作为 HTTP 网关处理 RESTful/WebSocket 请求，Mastra 作为业务逻辑层。
在 Hono 的路由 handler 中，实例化或调用 Mastra 的 Agent/Workflow。

侧边栏与 AI 对话，必须使用 SSE (Server-Sent Events)。
Hono 对 SSE 支持很好，Mastra 也支持流式输出，需要确保前后端流式对接顺畅。

AI的会话，需要进行持久化，方便继续对话，审计AI行为，排查错误。

笔记的生命周期
创建 -> 编辑草稿 -> 查看 diff -> 提交 -> 归档/删除

笔记的存储中，有正式内容，以及草稿内容，草稿内容是当前的编辑内容，正式内容是提交后的内容。
笔记有草稿编辑版本号计数(1,2,3,4...)。
笔记有标题和草稿版本的标题，也有对应的标题版本号。

冲突策略：
1. 人改和AI改冲突怎么办？
Ans： 每一篇笔记，应该有一个版本号，人改的时候，如果保存时，发现和前面获取的内容的版本号不符合，就toast提示冲突，
SSE 可以同步最新草稿，本地没有未保存的变更时，持续把网页中的内容，更新到db中的最新的草稿内容。
但用户正在编辑，产生了改动，未Ctrl + S提交保存时不能直接覆盖本地输入，而是有alert条来提示，有未同步的变更，可以选择放弃本地输入并同步内容，也可以选择用本地覆盖远端。

AI可以创建一篇新的笔记(create_note)。
AI编辑的时候，应该有多种编辑方式，一种是全量写，一种是字符串替换，一种是锚点插入(insert_block，标题后追加，文末追加，特定文本后追加，等等)。
字符串替换如果替换成功，就忽略掉时间戳的问题，替换失败就tools调用报错，返回给相应没替换掉等的原因信息，然后AI应该会重新读内容。
全量写的话，短期就全局替换吧，无所谓版本号了，由AI来覆盖草稿，并更新版本号，记录变更的时候，把原草稿和新草稿记录进去就行。

AI的所有变更，增加一个变更日志表，来专门存，后面可以进行审计。


初版，你觉得够了不？
我有没有什么严重的描述不到位，会理解偏差的地方？你有什么建议？



使用 Mastra 提供的 LibSQLStore 作为会话消息存储逻辑，它可以完美运行在本地 SQLite 文件中。
不自己用 Sequelize 去手写一套复杂的会话消息存储逻辑。

初版基于行级 Diff（使用 diff 库），前端渲染成类似 GitHub PR 的 Hunk（代码块）视图，每个 Hunk 旁边有 "Accept" / "Reject" 按钮。这比基于 Markdown AST 的区块还原更容易实现且符合直觉。


# 语音对话（定稿，待实现）

## 目标
- 语音输入：推按说话（按住录音、松开即发送），转文字后走现有 useChat 链路
- AI 回复朗读：MessageList 每条 AI 消息加「朗读」按钮 + 自动朗读开关
- 语音对话模式系统提示词：转写可能不准，指令含糊/关键词可疑（数字、专有名词、笔记名）时先追问澄清再行动；回复短句、口语化、易朗读

## 技术选型（云优先，本地兜底）
- ASR 首选：**阿里云 DashScope（百炼）**，模型 `qwen3-asr-flash` / `qwen-audio-3.0-asr-flash`（流式）；长录音用 `-filetrans` 异步版本；OpenAI 兼容调用（`compatible-mode/v1/chat/completions`，OpenAI SDK 官方示例），与现有技术栈契合
- TTS 首选：DashScope **CosyVoice / Qwen3-TTS**，中文音质天花板，走 DashScope 原生 API；只需一个 `DASHSCOPE_API_KEY`
- 备选经典阿里云智能语音（NLS）：一句话识别 + 语音合成，自家 SDK，需适配层
- 本地兜底（可选，后补）：Qwen3-ASR（0.6B/1.7B）社区 GGUF + llama.cpp，i7 8 核跑 1.7B Q4（约 1GB）短句约 1~3s；模型下载走 ModelScope（HF 被墙），models/ 目录 .gitignore
- 注意：Qwen3-ASR 只做识别不含 TTS（TTS 是 Qwen3-TTS）；本地朗读也可用 piper（离线）/ edge-tts（在线）

## 架构（语音后端可切换）
- bi-ji server：新增 `/api/voice/transcribe`、`/api/voice/speech` 代理，背后接「语音后端」抽象，支持切换：
  1. **aliyun**（DashScope，默认首选）— 直接调 compatible-mode / 原生语音 API
  2. **local**（apps/voice 本地 GGUF 服务，可选）
  3. **custom**（任意 OpenAI 兼容 audio 端点）
- apps/voice/（仅本地兜底需要）：独立 Python 服务（FastAPI），绑 0.0.0.0，OpenAI 兼容接口（POST /v1/audio/transcriptions、POST /v1/audio/speech、GET /health）；薄 package.json 包装 pnpm 脚本（download-model / start / dev），模式同 apps/opencode-mcp
- 设置页：新增「语音」分类，app_settings 存 voice* 键（voiceProvider=aliyun/local/custom、voiceAsrUrl、voiceTtsUrl、voiceApiKey、语言、自动朗读开关、推按松开发送 vs 先填入编辑、可选 Bearer token）；未配置则前端隐藏麦克风按钮
- 前端：
  - ChatInput 加麦克风按钮：onPointerDown 开始录音（MediaRecorder）、onPointerUp 停止并发送
  - MessageList 加朗读按钮 + 自动朗读
  - 语音消息带 inputMethod:'voice'，服务端据此注入语音模式系统提示词段落

## 待办
- [ ] bi-ji /api/voice/transcribe、/api/voice/speech 代理 + aliyun（DashScope）后端实现
- [ ] 设置页「语音」分类（voice* 键 + voiceProvider 切换）
- [ ] ChatInput 推按说话 + MessageList 朗读按钮
- [ ] agent 系统提示词注入语音对话模式
- [ ] （可选）apps/voice 本地 GGUF 后端 + ModelScope 下载脚本 + models/ 进 .gitignore