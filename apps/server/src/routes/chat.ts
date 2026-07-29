import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { RequestContext } from '@mastra/core/request-context'
import { mastra, memory } from '../mastra/index.js'

const RESOURCE_ID = 'local-user'

export const chatRoutes = new Hono()

chatRoutes.get('/threads', async (c) => {
  const result = await memory.listThreads({
    filter: { resourceId: RESOURCE_ID },
    perPage: 100,
    orderBy: { field: 'updatedAt', direction: 'DESC' },
  })
  return c.json(result)
})

chatRoutes.post('/threads', async (c) => {
  const body = await c.req.json<{ title?: string; noteId?: number }>().catch(() => ({} as { title?: string; noteId?: number }))
  const now = new Date()
  const thread = await memory.saveThread({
    thread: {
      id: crypto.randomUUID(),
      resourceId: RESOURCE_ID,
      title: body.title ?? `对话 ${now.toLocaleString('zh-CN')}`,
      createdAt: now,
      updatedAt: now,
      ...(typeof body.noteId === 'number' ? { metadata: { originNoteId: body.noteId } } : {}),
    },
  })
  return c.json(thread, 201)
})

chatRoutes.delete('/threads/:id', async (c) => {
  await memory.deleteThread(c.req.param('id'))
  return c.json({ ok: true })
})

chatRoutes.get('/threads/:id/messages', async (c) => {
  const threadId = c.req.param('id')
  const result = await memory.recall({ threadId, resourceId: RESOURCE_ID })
  return c.json({ messages: result.messages.map(normalizeMessage) })
})

function normalizeMessage(msg: unknown) {
  const m = msg as {
    id?: string
    role?: string
    createdAt?: Date
    content?: { parts?: Array<Record<string, unknown>>; content?: string } | string
  }
  const rawContent = m.content
  const parts = typeof rawContent === 'object' && rawContent !== null ? rawContent.parts : undefined
  const out: Array<Record<string, unknown>> = []
  if (Array.isArray(parts)) {
    for (const p of parts) {
      if (p.type === 'text') {
        out.push({ type: 'text', text: p.text })
      } else if (p.type === 'tool-invocation') {
        const ti = p.toolInvocation as Record<string, unknown> | undefined
        out.push({
          type: 'tool',
          toolName: ti?.toolName,
          state: ti?.state,
          args: ti?.args,
        })
      }
    }
  } else if (typeof rawContent === 'string') {
    out.push({ type: 'text', text: rawContent })
  } else if (typeof rawContent === 'object' && rawContent?.content) {
    out.push({ type: 'text', text: rawContent.content })
  }
  return { id: m.id, role: m.role, createdAt: m.createdAt, parts: out }
}

chatRoutes.post('/threads/:id/stream', async (c) => {
  const threadId = c.req.param('id')
  const body = await c.req.json<{ message: string; currentNoteId?: number }>()

  const thread = await memory.getThreadById({ threadId })
  if (!thread) {
    const now = new Date()
    await memory.saveThread({
      thread: { id: threadId, resourceId: RESOURCE_ID, title: `对话 ${threadId}`, createdAt: now, updatedAt: now },
    })
  }

  const userMessage = body.currentNoteId
    ? `[用户当前正在查看笔记 id=${body.currentNoteId}]\n\n${body.message}`
    : body.message

  const requestContext = new RequestContext()
  requestContext.set('threadId', threadId)

  return streamSSE(c, async (stream) => {
    try {
      const agent = mastra.getAgentById('note-agent')
      const result = await agent.stream(userMessage, {
        memory: { resource: RESOURCE_ID, thread: threadId },
        requestContext,
        maxSteps: 15,
      })

      for await (const chunk of result.fullStream) {
        const evt = normalizeChunk(chunk)
        if (evt) {
          await stream.writeSSE({ event: evt.event, data: JSON.stringify(evt.data) })
        }
      }
      await stream.writeSSE({ event: 'done', data: '{}' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ message }) }).catch(() => {})
    }
  })
})

function normalizeChunk(chunk: unknown): { event: string; data: Record<string, unknown> } | null {
  const ch = chunk as { type?: string; payload?: Record<string, unknown> }
  const p = ch.payload ?? {}
  switch (ch.type) {
    case 'text-delta':
      return { event: 'text', data: { delta: p.text ?? '' } }
    case 'tool-call':
      return { event: 'tool-call', data: { toolName: p.toolName, args: p.args } }
    case 'tool-result': {
      let result: unknown = p.result
      try {
        const s = JSON.stringify(result)
        if (s.length > 2000) result = s.slice(0, 2000) + '…(截断)'
      } catch {
        result = String(result)
      }
      return { event: 'tool-result', data: { toolName: p.toolName, result } }
    }
    case 'error':
      return { event: 'error', data: { message: String(p.error ?? 'unknown error') } }
    default:
      return null
  }
}
