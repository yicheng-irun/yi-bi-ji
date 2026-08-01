import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { OpenCodeClient, extractReplyText } from './opencode-client.js'

type TextResult = { content: { type: 'text'; text: string }[] }

function text(text: string): TextResult {
  return { content: [{ type: 'text', text }] }
}

function sessionSummary(s: { id: string; title?: string; time?: { updated?: string; created?: string } }): string {
  return `${s.id}\t${s.title ?? '(无标题)'}\t${s.time?.updated ?? s.time?.created ?? ''}`
}

/** 注册全部 MCP 工具（opencode_client 实例注入闭包） */
export function registerTools(server: McpServer, client: OpenCodeClient) {
  server.registerTool(
    'opencode_status',
    {
      title: 'opencode 健康检查',
      description: '检查 opencode serve 是否可用并返回版本信息。不执行任何开发操作。',
      inputSchema: z.object({}),
    },
    async (): Promise<TextResult> => {
      const h = await client.health()
      return text(JSON.stringify(h, null, 2))
    },
  )

  server.registerTool(
    'opencode_list_sessions',
    {
      title: '列出 opencode 会话',
      description: '列出已有的 opencode 会话（id、标题、更新时间）。只读操作，不会改动代码。',
      inputSchema: z.object({}),
    },
    async (): Promise<TextResult> => {
      const sessions = await client.listSessions()
      if (sessions.length === 0) return text('（暂无会话）')
      return text(`会话列表：\n${sessions.map(sessionSummary).join('\n')}`)
    },
  )

  server.registerTool(
    'opencode_get_session',
    {
      title: '查看 opencode 会话详情',
      description: '获取指定会话的详情与消息历史（含工具调用记录）。只读操作，不会改动代码。',
      inputSchema: z.object({
        sessionId: z.string().describe('opencode 会话 id（来自 opencode_prompt / opencode_list_sessions）'),
        limit: z.number().int().positive().max(200).optional().describe('最多取最近多少条消息（默认全部）'),
      }),
    },
    async ({ sessionId, limit }) => {
      const session = await client.getSession(sessionId)
      const messages = await client.getMessages(sessionId, limit)
      const lines = [`会话: ${session.title ?? sessionId}`, '']
      for (const m of messages) {
        const role = m.info.role
        const textParts = m.parts
          .filter((p) => p.type === 'text' && typeof p.text === 'string')
          .map((p) => (p.text as string).trim())
          .filter(Boolean)
        const toolCalls = m.parts.filter((p) => p.type === 'tool').length
        const head = `--- [${role}]`
        if (textParts.length === 0 && toolCalls === 0) {
          lines.push(`${head}（无文本，${m.parts.length} parts）`)
        } else {
          lines.push(head)
          if (toolCalls > 0) lines.push(`  [调用了 ${toolCalls} 个工具]`)
          for (const t of textParts) lines.push(t)
        }
      }
      return text(lines.join('\n'))
    },
  )

  server.registerTool(
    'opencode_prompt',
    {
      title: '在 opencode 发起任务',
      description:
        '在 opencode 创建一个新会话并发送消息执行开发任务（可能改动代码、运行命令）。返回执行结果与 session id，后续可用 opencode_continue(sessionId) 续接。',
      inputSchema: z.object({
        message: z.string().describe('要执行的任务描述（open code 开发任务）'),
        title: z.string().optional().describe('会话标题（可选）'),
        agent: z.string().optional().describe('使用的 opencode agent 名（默认 build）'),
        model: z.string().optional().describe('使用的模型名（可选）'),
      }),
    },
    async ({ message, title, agent, model }) => {
      const session = await client.createSession({ title })
      const result = await client.sendMessage(session.id, { parts: [{ type: 'text', text: message }], agent, model })
      return text(
        `sessionId: ${session.id}\n标题: ${session.title ?? ''}\n\n执行结果:\n${extractReplyText(result) || '（无文本回复）'}`,
      )
    },
  )

  server.registerTool(
    'opencode_continue',
    {
      title: '续接 opencode 会话',
      description:
        '在指定 opencode 会话上继续对话（延续上下文，非新会话）。可能改动代码、运行命令。返回执行结果与 session id。',
      inputSchema: z.object({
        sessionId: z.string().describe('要续接的 opencode 会话 id'),
        message: z.string().describe('要发送的消息（继续任务的指示）'),
        agent: z.string().optional().describe('使用的 opencode agent 名（默认 build）'),
        model: z.string().optional().describe('使用的模型名（可选）'),
      }),
    },
    async ({ sessionId, message, agent, model }) => {
      const result = await client.sendMessage(sessionId, { parts: [{ type: 'text', text: message }], agent, model })
      return text(`sessionId: ${sessionId}\n\n执行结果:\n${extractReplyText(result) || '（无文本回复）'}`)
    },
  )

  server.registerTool(
    'opencode_abort',
    {
      title: '中止 opencode 会话',
      description: '中止运行中的 opencode 会话。不执行开发操作。',
      inputSchema: z.object({
        sessionId: z.string().describe('要中止的 opencode 会话 id'),
      }),
    },
    async ({ sessionId }) => {
      const ok = await client.abort(sessionId)
      return text(`中止${ok ? '成功' : '失败'}`)
    },
  )

  server.registerTool(
    'opencode_search',
    {
      title: '在项目中搜索代码',
      description: '跨文件搜索文本/代码（只读，不执行开发操作）。用于定位代码位置。',
      inputSchema: z.object({
        pattern: z.string().describe('要搜索的文本或正则模式'),
      }),
    },
    async ({ pattern }) => {
      const matches = await client.find(pattern)
      if (matches.length === 0) return text('（无匹配）')
      return text(
        matches
          .map((m) => `${m.path}:${m.line_number}\n  ${m.lines.trim()}`)
          .join('\n')
          .slice(0, 20000),
      )
    },
  )

  server.registerTool(
    'opencode_run_shell',
    {
      title: '在 opencode 中执行 shell 命令',
      description:
        '让 opencode 在项目环境执行 shell 命令（会运行命令，可能改动环境/文件）。返回执行输出。注意：该命令会在 opencode 的会话上下文中执行，属于高权限操作。',
      inputSchema: z.object({
        sessionId: z.string().describe('在哪个 opencode 会话中执行（建议先 opencode_prompt 拿到会话）'),
        command: z.string().describe('要执行的 shell 命令'),
        agent: z.string().optional().describe('使用的 opencode agent 名（默认 build）'),
        model: z.string().optional().describe('使用的模型名（可选）'),
      }),
    },
    async ({ sessionId, command, agent, model }) => {
      const result = await client.shell(sessionId, { command, agent, model })
      return text(`命令: ${command}\n\n输出:\n${extractReplyText(result) || '（无文本输出）'}`)
    },
  )
}
