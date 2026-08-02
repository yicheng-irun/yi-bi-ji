import { ToolLoopAgent, isStepCount } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { Op } from 'sequelize'
import { ChatThread, Note } from '../db/models.js'
import { parseThreadMetadata } from '../services/chat.js'
import { getSettings } from '../services/settings.js'
import { createNoteTools, parseEnabledTools } from './tools.js'
import { loadMcpToolsCached, parseMcpServers } from './mcp.js'

/** 名为 AGENTS.md 的笔记作为固定指令注入系统提示词；重名取 id 最小的 */
async function loadAgentsNote(): Promise<string | null> {
  const note = await Note.findOne({
    where: {
      deletedAt: null,
      [Op.or]: [{ draftTitle: 'AGENTS.md' }, { committedTitle: 'AGENTS.md' }],
    },
    order: [['id', 'ASC']],
  })
  const content = (note?.draftContent ?? note?.committedContent ?? '').trim()
  return content || null
}

export async function createNoteAgent(threadId: string, opts: { voiceMode?: boolean } = {}) {
  const s = getSettings()
  const enabledMcp = parseMcpServers(s.mcpServers).filter((sv) => sv.enabled !== false)
  const mcp = await loadMcpToolsCached(enabledMcp)
  const thread = await ChatThread.findByPk(threadId)
  const originNoteId = thread ? parseThreadMetadata(thread).originNoteId : undefined
  const noteContext =
    typeof originNoteId === 'number'
      ? `当前对话与笔记 id=${originNoteId} 关联（用户是在这篇笔记的上下文里开启的对话），优先基于它工作。`
      : '当前是全局对话，没有固定关联的笔记，按用户提问自行查找相关笔记。'
  const agentsNote = await loadAgentsNote()
  const provider = createOpenAICompatible({
    name: 'custom',
    baseURL: s.aiBaseURL,
    apiKey: s.aiApiKey,
  })
  const providerOptions = s.reasoningEffort
    ? { custom: { reasoningEffort: s.reasoningEffort } }
    : undefined
  return new ToolLoopAgent({
    id: 'note-agent',
    model: provider(s.aiModel),
    providerOptions,
    instructions: `你是一个笔记系统的 AI 助手。用户通过网页编辑器管理 markdown 笔记，你可以在侧边栏与用户对话。
${agentsNote ? `\n以下是用户的固定指令（来自笔记《AGENTS.md》，始终遵循）：\n\n${agentsNote}\n` : ''}

你可以使用的工具（function 定义里已有各工具的功能与参数，此处只列使用策略）：
- 笔记工具：先 list/search 定位，再按需 read，别把整个库塞进上下文；修改前先重读最新内容
- 标签：创建/整理笔记时主动打标签归类（如每日资讯、随想、稿子、计划、方法论、提示词等），先复用已有标签名，保持命名简洁一致
- 网页工具：web_fetch 返回 Markdown（含链接和图片地址），需要引用时把链接原样保留进笔记；长文用 start 翻页；触发真人验证或超时，如实告知用户
- 浏览器工具（用户本机已打开的真实浏览器，需用户先用 scripts/start-browser-cdp.bat 启动）：
  - 用户常会自己先打开网页、已登录或已通过验证，再说「看这个网页」——优先 browser_tabs 确认标签页 → browser_read 读正文 → 需存档再 browser_screenshot，比 web_fetch 可靠得多
  - browser_eval 执行任意 JS（滚动页面/读写 DOM），其他工具做不到时用它
  - browser_navigate / browser_click / browser_type / browser_eval 会真实改变浏览器状态，必须在用户明确示意时才用
- deep_research：复杂调研派给联网研究子代理，避免占用主上下文；不用等它的每一步，返回报告后再据此回复
- mcp__*：通过 MCP 服务器挂载的外部工具，按需使用，用法与其他工具一致

重要规则：
1. 你的所有修改只写入「草稿」，用户确认后才会正式落库，所以可以放心修改，但要说明你改了什么。
2. 修改前先读取目标笔记的最新内容（用户可能刚改过）。
3. replace_in_note 失败时，按工具返回的原因，先用 read_note 重读再重试。
4. 不要一次性把所有笔记塞入上下文；先搜索/列表，再按需读取。
5. ${noteContext}
6. 用中文回复，保持简洁。
7. 回复中适合朗读给用户听的内容，包在 \`\`\`朗读 代码块里标出（可多个，记得闭合代码块）；块内只用口语短句，不要 markdown 语法、链接、代码、表格。系统只朗读标记的部分，未标记的内容不会被自动朗读。语音对话时必须标注。
${opts.voiceMode
  ? `8. 本条消息来自语音输入，语音转写可能不准确。若指令含糊、或涉及数字/专有名词/笔记标题等疑似听错的内容，先简短追问澄清再执行，不要猜测。回复尽量用短句、口语化表达，便于朗读。`
  : ''}`,
    tools: createNoteTools(
      threadId,
      parseEnabledTools(s.aiTools),
      parseEnabledTools(s.aiSubagentTools),
      mcp.tools,
    ),
    stopWhen: isStepCount(50),
  })
}
