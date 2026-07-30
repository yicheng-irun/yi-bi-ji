import { Hono } from 'hono'
import { listChanges, getNoteOrThrow, getDiff, commitAll, rejectChange } from '../services/notes.js'

export const changesRoutes = new Hono()

changesRoutes.get('/', async (c) => c.json(await listChanges()))

changesRoutes.post('/commit-all', async (c) => c.json(await commitAll()))

changesRoutes.post('/:id/reject', async (c) => {
  const note = await rejectChange(Number(c.req.param('id')))
  return c.json(note)
})

changesRoutes.get('/:id/diff', async (c) => {
  const note = await getNoteOrThrow(Number(c.req.param('id')))
  return c.json(getDiff(note))
})
