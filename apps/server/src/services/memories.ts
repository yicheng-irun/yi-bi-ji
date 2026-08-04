import { Op } from 'sequelize'
import { Memory, AiChangeLog, type MemoryKind, type MemoryStatus } from '../db/models.js'
import { NotFoundError } from './notes.js'

export const MEMORY_KINDS: MemoryKind[] = ['fact', 'preference', 'decision', 'todo']

export function serializeMemory(m: Memory) {
  const j = m.toJSON()
  let tags: string[] = []
  try {
    const parsed = JSON.parse(j.tags || '[]')
    if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string')
  } catch {
    // ignore malformed tags
  }
  return { ...j, tags }
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))]
}

function normalizeContent(content: string) {
  return content.replace(/\s+/g, ' ').trim()
}

async function getMemoryOrThrow(id: number) {
  const m = await Memory.findByPk(id)
  if (!m) throw new NotFoundError(`memory ${id} not found`)
  return m
}

export async function listMemories(filter: { status?: MemoryStatus; kind?: MemoryKind; q?: string } = {}) {
  const where: Record<string | symbol, unknown> = {}
  if (filter.status) where.status = filter.status
  if (filter.kind) where.kind = filter.kind
  if (filter.q?.trim()) where.content = { [Op.like]: `%${filter.q.trim()}%` }
  const [rows, pendingCount] = await Promise.all([
    Memory.findAll({ where, order: [['updatedAt', 'DESC']], limit: 200 }),
    Memory.count({ where: { status: 'pending' } }),
  ])
  return { pendingCount, memories: rows.map(serializeMemory) }
}

/** AI 沉淀记忆：直接生效（confirmed）；与现有未归档记忆内容重复时直接返回已有条目 */
export async function rememberMemory(
  input: { content: string; kind: MemoryKind; tags?: string[] },
  threadId?: string,
) {
  const content = normalizeContent(input.content)
  if (!content) throw new Error('记忆内容不能为空')
  const dup = await Memory.findOne({
    where: { content, status: { [Op.ne]: 'archived' } },
    order: [['id', 'ASC']],
  })
  if (dup) return { memory: serializeMemory(dup), duplicated: true as const }
  const m = await Memory.create({
    kind: input.kind,
    content,
    status: 'confirmed',
    tags: JSON.stringify(normalizeTags(input.tags ?? [])),
    sourceThreadId: threadId ?? null,
  })
  await AiChangeLog.create({
    noteId: null,
    threadId: threadId ?? null,
    action: 'remember',
    summary: `沉淀记忆（${input.kind}）：${content.slice(0, 50)}`,
    beforeContent: '',
    afterContent: content,
  })
  return { memory: serializeMemory(m), duplicated: false as const }
}

/** 检索记忆：默认只查已确认；query 为空时按更新时间返回最近条目 */
export async function recallMemories(opts: { query?: string; kind?: MemoryKind; status?: MemoryStatus; limit?: number } = {}) {
  const status = opts.status ?? 'confirmed'
  const where: Record<string | symbol, unknown> = { status }
  if (opts.kind) where.kind = opts.kind
  if (opts.query?.trim()) where.content = { [Op.like]: `%${opts.query.trim()}%` }
  const rows = await Memory.findAll({
    where,
    order: [['updatedAt', 'DESC']],
    limit: Math.min(opts.limit ?? 20, 100),
  })
  return rows.map((m) => {
    const j = serializeMemory(m)
    return { id: j.id, kind: j.kind, content: j.content, status: j.status, updatedAt: j.updatedAt }
  })
}

/** 注入系统提示词用的已确认记忆（最近 N 条） */
export async function loadConfirmedMemories(limit = 50) {
  const rows = await Memory.findAll({
    where: { status: 'confirmed' },
    order: [['updatedAt', 'DESC']],
    limit,
  })
  return rows.map((m) => ({ id: m.id, kind: m.kind as MemoryKind, content: m.content }))
}

export async function createMemoryByUser(input: { content: string; kind?: MemoryKind; tags?: string[] }) {
  const content = normalizeContent(input.content)
  if (!content) throw new Error('记忆内容不能为空')
  const m = await Memory.create({
    kind: input.kind ?? 'fact',
    content,
    status: 'confirmed',
    tags: JSON.stringify(normalizeTags(input.tags ?? [])),
    sourceThreadId: null,
  })
  return serializeMemory(m)
}

export async function updateMemory(id: number, input: { content?: string; kind?: MemoryKind; tags?: string[] }) {
  const m = await getMemoryOrThrow(id)
  if (input.content !== undefined) {
    const content = normalizeContent(input.content)
    if (!content) throw new Error('记忆内容不能为空')
    m.content = content
  }
  if (input.kind !== undefined) m.kind = input.kind
  if (input.tags !== undefined) m.tags = JSON.stringify(normalizeTags(input.tags))
  await m.save()
  return serializeMemory(m)
}

export async function confirmMemory(id: number) {
  const m = await getMemoryOrThrow(id)
  m.status = 'confirmed'
  await m.save()
  return serializeMemory(m)
}

export async function archiveMemory(id: number) {
  const m = await getMemoryOrThrow(id)
  m.status = 'archived'
  await m.save()
  return serializeMemory(m)
}

export async function deleteMemory(id: number) {
  const m = await getMemoryOrThrow(id)
  await m.destroy()
  return { ok: true as const, id }
}
