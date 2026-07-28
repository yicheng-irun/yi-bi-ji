import { Hono } from 'hono'
import {
  listNotes,
  getNoteOrThrow,
  serializeNote,
  createNote,
  saveDraftByUser,
  commitNote,
  deleteNote,
  ConflictError,
  NotFoundError,
} from '../services/notes.js'

export const notesRoutes = new Hono()

notesRoutes.get('/', async (c) => c.json(await listNotes()))

notesRoutes.post('/', async (c) => {
  const body = await c.req.json<{ title?: string; content?: string }>()
  const note = await createNote({ title: body.title ?? '未命名', content: body.content ?? '' }, 'user')
  return c.json(note, 201)
})

notesRoutes.get('/:id', async (c) => {
  const note = await getNoteOrThrow(Number(c.req.param('id')))
  return c.json(serializeNote(note))
})

notesRoutes.put('/:id/draft', async (c) => {
  const body = await c.req.json<{
    draftTitle?: string
    draftContent?: string
    baseContentVersion: number
    baseTitleVersion: number
  }>()
  const note = await saveDraftByUser(Number(c.req.param('id')), body)
  return c.json(note)
})

notesRoutes.post('/:id/commit', async (c) => {
  const body = await c.req.json<{ content?: string }>().catch(() => ({} as { content?: string }))
  const note = await commitNote(Number(c.req.param('id')), body.content)
  return c.json(note)
})

notesRoutes.delete('/:id', async (c) => {
  await deleteNote(Number(c.req.param('id')))
  return c.json({ ok: true })
})

export function noteErrorHandler(err: Error, c: Parameters<Parameters<Hono['onError']>[0]>[1]) {
  if (err instanceof ConflictError) {
    return c.json({ error: 'conflict', note: serializeNote(err.note) }, 409)
  }
  if (err instanceof NotFoundError) {
    return c.json({ error: err.message }, 404)
  }
  console.error(err)
  return c.json({ error: 'internal error' }, 500)
}
