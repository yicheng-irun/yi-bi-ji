import { Hono } from 'hono'
import { listChanges, getNoteOrThrow, getDiff, commitAll } from '../services/notes.js'

export const changesRoutes = new Hono()

changesRoutes.get('/', async (c) => c.json(await listChanges()))

changesRoutes.post('/commit-all', async (c) => c.json(await commitAll()))

changesRoutes.get('/:id/diff', async (c) => {
  const note = await getNoteOrThrow(Number(c.req.param('id')))
  return c.json(getDiff(note))
})
