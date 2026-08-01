import { Hono } from 'hono'
import { createAgentUIStreamResponse, type InferAgentUIMessage, type UIMessage } from 'ai'
import { ChatMessage, ChatThread } from '../db/models.js'
import { createNoteAgent } from '../agent/index.js'
import { deleteThreadCascade, loadHistory, persistMessages, threadToJson } from '../services/chat.js'

const MAX_CONTEXT_MESSAGES = 40

export const chatRoutes = new Hono()

chatRoutes.get('/threads', async (c) => {
  const threads = await ChatThread.findAll({ order: [['updatedAt', 'DESC']], limit: 100 })
  return c.json({ threads: threads.map(threadToJson) })
})

chatRoutes.post('/threads', async (c) => {
  const body = await c.req.json<{ title?: string; noteId?: number }>().catch(() => ({}) as { title?: string; noteId?: number })
  const thread = await ChatThread.create({
    id: crypto.randomUUID(),
    title: body.title ?? `对话 ${new Date().toLocaleString('zh-CN')}`,
    metadata: JSON.stringify(typeof body.noteId === 'number' ? { originNoteId: body.noteId } : {}),
  })
  return c.json(threadToJson(thread), 201)
})

chatRoutes.get('/threads/:id/context', async (c) => {
  const threadId = c.req.param('id')
  const rows = await ChatMessage.findAll({ where: { threadId }, attributes: ['parts'] })
  let charCount = 0
  for (const r of rows) charCount += r.parts.length
  return c.json({
    messageCount: rows.length,
    charCount,
    estimatedTokens: Math.ceil(charCount / 2),
  })
})

chatRoutes.delete('/threads/:id', async (c) => {
  await deleteThreadCascade(c.req.param('id'))
  return c.json({ ok: true })
})

chatRoutes.get('/threads/:id/messages', async (c) => {
  const messages = await loadHistory(c.req.param('id'))
  return c.json({ messages })
})

chatRoutes.post('/threads/:id/stream', async (c) => {
  const threadId = c.req.param('id')
  const body = await c.req
    .json<{ message?: string; messages?: UIMessage[] }>()
    .catch(() => ({}) as { message?: string; messages?: UIMessage[] })

  let thread = await ChatThread.findByPk(threadId)
  if (!thread) {
    thread = await ChatThread.create({ id: threadId, title: `对话 ${threadId}` })
  }

  let newMessage: UIMessage | undefined
  if (Array.isArray(body.messages) && body.messages.length > 0) {
    newMessage = body.messages[body.messages.length - 1]
  } else if (typeof body.message === 'string' && body.message.trim()) {
    newMessage = { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: body.message }] }
  }
  if (!newMessage) return c.json({ error: 'message is required' }, 400)

  const md = newMessage.metadata
  const voiceMode = !!md && typeof md === 'object' && (md as Record<string, unknown>).inputMethod === 'voice'

  const history = (await loadHistory(threadId)).slice(-MAX_CONTEXT_MESSAGES)
  const knownIds = new Set(history.map((m) => m.id))
  const uiMessages = [...history, newMessage]

  const agent = await createNoteAgent(threadId, { voiceMode })
  type AgentUIMessage = InferAgentUIMessage<typeof agent>

  return createAgentUIStreamResponse({
    agent,
    uiMessages,
    originalMessages: uiMessages as AgentUIMessage[],
    generateMessageId: () => crypto.randomUUID(),
    onEnd: async ({ messages, isAborted }) => {
      if (isAborted) return
      const fresh = messages.filter((m) => !knownIds.has(m.id))
      if (fresh.length > 0) {
        await persistMessages(threadId, fresh).catch((err) => console.error('persist messages failed', err))
      }
    },
  })
})
