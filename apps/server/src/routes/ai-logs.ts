import { Hono } from 'hono'
import { listAiChangeLogs, getAiChangeLogDetail, deleteAiChangeLog, clearAiChangeLogs } from '../services/ai-logs.js'

export const aiLogsRoutes = new Hono()

aiLogsRoutes.get('/', async (c) => {
  const q = c.req.query()
  const limit = Math.min(Number(q.limit ?? 50) || 50, 200)
  const offset = Number(q.offset ?? 0) || 0
  const noteId = q.noteId ? Number(q.noteId) : undefined
  return c.json(
    await listAiChangeLogs({
      noteId,
      threadId: q.threadId || undefined,
      action: q.action || undefined,
      limit,
      offset,
    }),
  )
})

aiLogsRoutes.delete('/', async (c) => {
  const body = await c.req.json<{ noteId?: number; action?: string }>().catch(() => ({} as { noteId?: number; action?: string }))
  return c.json(
    await clearAiChangeLogs({
      noteId: body.noteId ? Number(body.noteId) : undefined,
      action: body.action || undefined,
    }),
  )
})

aiLogsRoutes.get('/:id', async (c) => {
  return c.json(await getAiChangeLogDetail(Number(c.req.param('id'))))
})

aiLogsRoutes.delete('/:id', async (c) => {
  return c.json(await deleteAiChangeLog(Number(c.req.param('id'))))
})
