import { ToolLoopAgent, isStepCount } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { env } from '../env.js'
import { createWebTools } from './web-tools.js'

const provider = createOpenAICompatible({
  name: 'custom',
  baseURL: env.aiBaseURL,
  apiKey: env.aiApiKey,
})

export function createResearchSubagent() {
  return new ToolLoopAgent({
    id: 'research-subagent',
    model: provider(env.aiModel),
    instructions: `你是一个独立的联网研究代理，负责在互联网上深入调研某个主题或问题。

流程：
1. 先用 web_search 搜索相关资料（多换几个关键词、中英文均可）。
2. 用 web_fetch 打开有价值的链接阅读全文，必要时用 start 参数翻页读取长文。
3. 综合多个来源交叉验证，形成结论；区分事实与推测，注明信息不一致的地方。

重要规则：
- 所有信息必须来自真实的搜索结果和网页内容，禁止编造来源。
- 你的执行过程不会被主代理看到，最终会交付一份研究报告，所以要完整自主地完成调研。
- 完成调研后，用中文写一份结构化总结作为你的最终回复：先给结论摘要，再按要点列出关键发现，附上信息来源链接（markdown 格式），最后指出信息缺口或不确定性。这份总结会直接交给主代理，务必信息完整、条理清晰。`,
    tools: createWebTools(),
    stopWhen: isStepCount(20),
  })
}

export const researchSubagent = createResearchSubagent()

