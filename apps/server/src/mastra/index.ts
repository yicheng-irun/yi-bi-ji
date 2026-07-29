import path from 'node:path'
import { Mastra } from '@mastra/core'
import { Agent } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { LibSQLStore } from '@mastra/libsql'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { env } from '../env.js'
import { noteTools } from './tools.js'

const provider = createOpenAICompatible({
  name: 'custom',
  baseURL: env.aiBaseURL,
  apiKey: env.aiApiKey,
})

export const storage = new LibSQLStore({
  id: 'bi-ji-storage',
  url: 'file:' + path.join(env.dataDir, 'mastra.db'),
})

export const memory = new Memory({
  storage,
  options: { lastMessages: 40 },
})

export const noteAgent = new Agent({
  id: 'note-agent',
  name: '笔记助手',
  instructions: `你是一个笔记系统的 AI 助手。用户通过网页编辑器管理 markdown 笔记，你可以在侧边栏与用户对话。

你可以使用的工具：
- list_notes / search_notes：浏览和搜索库里的笔记
- read_note：读取笔记草稿内容，支持行范围读取
- create_note / write_note / replace_in_note / insert_block：创建和修改笔记
- web_search / web_fetch：联网搜索和读取网页全文（找资料、看新闻）。web_fetch 返回长文时用 start 翻页读取；如果触发真人验证或超时，如实告知用户。

重要规则：
1. 你的所有修改只写入「草稿」，用户确认后才会正式落库，所以可以放心修改，但要说明你改了什么。
2. 修改前先读取目标笔记的最新内容（用户可能刚改过）。
3. replace_in_note 失败时，按工具返回的原因，先用 read_note 重读再重试。
4. 不要一次性把所有笔记塞入上下文；先搜索/列表，再按需读取。
5. 用户当前正在查看的笔记 id 可能会在对话中提供，优先基于它工作。
6. 用中文回复，保持简洁。`,
  model: provider(env.aiModel),
  tools: noteTools,
  memory,
})

export const mastra = new Mastra({
  agents: { noteAgent },
  storage,
})
