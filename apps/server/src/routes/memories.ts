import { Hono } from 'hono'
import type { MemoryKind, MemoryStatus } from '../db/models.js'
import {
  listMemories,
  createMemoryByUser,
  updateMemory,
  confirmMemory,
  archiveMemory,
  deleteMemory,
  MEMORY_KINDS,
} from '../services/memories.js'

export const memoriesRoutes = new Hono()

const STATUSES: MemoryStatus[] = ['pending', 'confirmed', 'archived']

function parseKind(raw?: string): MemoryKind | undefined {
  return MEMORY_KINDS.includes(raw as MemoryKind) ? (raw as MemoryKind) : undefined
}

function parseStatus(raw?: string): MemoryStatus | undefined {
  return STATUSES.includes(raw as MemoryStatus) ? (raw as MemoryStatus) : undefined
}

memoriesRoutes.get('/', async (c) => {
  return c.json(
    await listMemories({
      status: parseStatus(c.req.query('status')),
      kind: parseKind(c.req.query('kind')),
      q: c.req.query('q'),
    }),
  )
})

memoriesRoutes.post('/', async (c) => {
  const body = await c.req.json<{ content?: string; kind?: string; tags?: string[] }>().catch(
    () => ({}) as { content?: string; kind?: string; tags?: string[] },
  )
  const m = await createMemoryByUser({ content: body.content ?? '', kind: parseKind(body.kind), tags: body.tags })
  return c.json(m, 201)
})

memoriesRoutes.patch('/:id', async (c) => {
  const body = await c.req.json<{ content?: string; kind?: string; tags?: string[] }>().catch(
    () => ({}) as { content?: string; kind?: string; tags?: string[] },
  )
  const m = await updateMemory(Number(c.req.param('id')), {
    content: body.content,
    kind: parseKind(body.kind),
    tags: body.tags,
  })
  return c.json(m)
})

memoriesRoutes.post('/:id/confirm', async (c) => c.json(await confirmMemory(Number(c.req.param('id')))))

memoriesRoutes.post('/:id/archive', async (c) => c.json(await archiveMemory(Number(c.req.param('id')))))

memoriesRoutes.delete('/:id', async (c) => c.json(await deleteMemory(Number(c.req.param('id')))))
