import { Op } from 'sequelize'
import { structuredPatch } from 'diff'
import { Note, AiChangeLog } from '../db/models.js'
import { emitEvent } from '../events/bus.js'

export class ConflictError extends Error {
  constructor(public note: Note) {
    super('version conflict')
  }
}

export class NotFoundError extends Error {}

export async function getNoteOrThrow(id: number) {
  const note = await Note.findByPk(id)
  if (!note) throw new NotFoundError(`note ${id} not found`)
  return note
}

export function serializeNote(note: Note) {
  const n = note.toJSON()
  let tags: string[] = []
  try {
    const parsed = JSON.parse(n.tags || '[]')
    if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string')
  } catch {
    // ignore malformed tags
  }
  return {
    ...n,
    tags,
    hasChanges: n.draftContent !== n.committedContent || n.draftTitle !== n.committedTitle,
    deletedAt: n.deletedAt ?? null,
  }
}

function ensureNotDeleted(note: Note) {
  if (note.deletedAt) {
    throw new Error(`笔记「${note.draftTitle}」已被标记删除，无法修改。如需恢复，请先撤销删除。`)
  }
}

function normalizeTags(tags: string[]) {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))]
}

export async function updateNoteMeta(id: number, input: { tags?: string[] }) {
  const note = await getNoteOrThrow(id)
  if (input.tags !== undefined) note.tags = JSON.stringify(normalizeTags(input.tags))
  await note.save()
  emitNoteUpdated(note, 'user')
  return serializeNote(note)
}

export async function listNotes() {
  const notes = await Note.findAll({ order: [['updatedAt', 'DESC']] })
  return notes.map(serializeNote)
}

export async function searchNotes(query: string, page = 1, perPage = 20) {
  const like = `%${query}%`
  const { rows, count } = await Note.findAndCountAll({
    where: {
      [Op.or]: [
        { draftTitle: { [Op.like]: like } },
        { draftContent: { [Op.like]: like } },
        { committedTitle: { [Op.like]: like } },
        { committedContent: { [Op.like]: like } },
      ],
    },
    order: [['updatedAt', 'DESC']],
    limit: perPage,
    offset: (page - 1) * perPage,
  })
  return {
    total: count,
    page,
    perPage,
    notes: rows.map((n) => ({
      id: n.id,
      title: n.draftTitle,
      updatedAt: n.updatedAt,
      snippet: makeSnippet(n.draftContent, query),
    })),
  }
}

function makeSnippet(content: string, query: string) {
  const idx = content.indexOf(query)
  if (idx < 0) return content.slice(0, 120)
  const start = Math.max(0, idx - 40)
  return content.slice(start, start + 160)
}

export async function createNote(
  input: { title: string; content: string; tags?: string[] },
  source: 'ai' | 'user',
  threadId?: string,
) {
  const note = await Note.create({
    committedTitle: '',
    committedContent: '',
    draftTitle: input.title,
    draftContent: input.content,
    tags: JSON.stringify(normalizeTags(input.tags ?? [])),
  })
  if (source === 'ai') {
    await AiChangeLog.create({
      noteId: note.id,
      threadId: threadId ?? null,
      action: 'create_note',
      summary: `创建笔记《${input.title}》`,
      beforeContent: '',
      afterContent: input.content,
    })
  }
  emitEvent({ type: 'note-created', noteId: note.id, source })
  emitNoteUpdated(note, source)
  return serializeNote(note)
}

function emitNoteUpdated(note: Note, source: 'ai' | 'user') {
  emitEvent({
    type: 'note-updated',
    noteId: note.id,
    draftTitle: note.draftTitle,
    draftContent: note.draftContent,
    draftContentVersion: note.draftContentVersion,
    draftTitleVersion: note.draftTitleVersion,
    source,
  })
}

export async function saveDraftByUser(
  id: number,
  input: { draftTitle?: string; draftContent?: string; baseContentVersion: number; baseTitleVersion: number },
) {
  const note = await getNoteOrThrow(id)
  ensureNotDeleted(note)
  if (
    note.draftContentVersion !== input.baseContentVersion ||
    note.draftTitleVersion !== input.baseTitleVersion
  ) {
    throw new ConflictError(note)
  }
  if (input.draftContent !== undefined && input.draftContent !== note.draftContent) {
    note.draftContent = input.draftContent
    note.draftContentVersion += 1
  }
  if (input.draftTitle !== undefined && input.draftTitle !== note.draftTitle) {
    note.draftTitle = input.draftTitle
    note.draftTitleVersion += 1
  }
  await note.save()
  emitNoteUpdated(note, 'user')
  return serializeNote(note)
}

async function writeDraftByAi(
  note: Note,
  newContent: string,
  meta: { action: string; summary: string; threadId?: string },
) {
  ensureNotDeleted(note)
  const before = note.draftContent
  note.draftContent = newContent
  note.draftContentVersion += 1
  await note.save()
  await AiChangeLog.create({
    noteId: note.id,
    threadId: meta.threadId ?? null,
    action: meta.action,
    summary: meta.summary,
    beforeContent: before,
    afterContent: newContent,
  })
  emitNoteUpdated(note, 'ai')
  return note
}

export async function aiWriteNote(id: number, content: string, threadId?: string) {
  const note = await getNoteOrThrow(id)
  await writeDraftByAi(note, content, { action: 'full_write', summary: '全量覆盖草稿', threadId })
  return serializeNote(note)
}

export async function aiReplaceInNote(id: number, oldString: string, newString: string, threadId?: string) {
  const note = await getNoteOrThrow(id)
  const content = note.draftContent
  const idx = content.indexOf(oldString)
  if (idx < 0) {
    return {
      ok: false as const,
      reason: 'old_string 在草稿中未找到，请先用 read_note 重新读取最新内容',
    }
  }
  if (content.indexOf(oldString, idx + 1) >= 0) {
    return {
      ok: false as const,
      reason: 'old_string 在草稿中出现多次，请提供更长的、唯一的上下文',
    }
  }
  const next = content.slice(0, idx) + newString + content.slice(idx + oldString.length)
  await writeDraftByAi(note, next, {
    action: 'replace',
    summary: `替换 ${oldString.length} 字符 → ${newString.length} 字符`,
    threadId,
  })
  return { ok: true as const, note: serializeNote(note) }
}

export type InsertAnchor =
  | { type: 'end' }
  | { type: 'after_heading'; heading: string }
  | { type: 'after_text'; text: string }

export async function aiInsertBlock(id: number, block: string, anchor: InsertAnchor, threadId?: string) {
  const note = await getNoteOrThrow(id)
  const content = note.draftContent
  let next: string
  if (anchor.type === 'end') {
    next = content.replace(/\s*$/, '') + '\n\n' + block.replace(/^\s+|\s+$/g, '') + '\n'
  } else if (anchor.type === 'after_heading') {
    const lines = content.split('\n')
    const idx = lines.findIndex((l) => l.trim().startsWith('#') && l.includes(anchor.heading))
    if (idx < 0) return { ok: false as const, reason: `未找到包含「${anchor.heading}」的标题行` }
    lines.splice(idx + 1, 0, '', block.replace(/^\s+|\s+$/g, ''))
    next = lines.join('\n')
  } else {
    const idx = content.indexOf(anchor.text)
    if (idx < 0) return { ok: false as const, reason: `未找到锚点文本「${anchor.text.slice(0, 50)}」` }
    const insertAt = idx + anchor.text.length
    next = content.slice(0, insertAt) + '\n\n' + block.replace(/^\s+|\s+$/g, '') + content.slice(insertAt)
  }
  await writeDraftByAi(note, next, { action: 'insert_block', summary: `插入区块（${anchor.type}）`, threadId })
  return { ok: true as const, note: serializeNote(note) }
}

export async function aiDeleteNote(id: number, threadId?: string) {
  const note = await getNoteOrThrow(id)
  ensureNotDeleted(note)
  note.deletedAt = new Date()
  await note.save()
  await AiChangeLog.create({
    noteId: note.id,
    threadId: threadId ?? null,
    action: 'delete_note',
    summary: `删除笔记《${note.draftTitle}》`,
    beforeContent: JSON.stringify({
      draftTitle: note.draftTitle,
      draftContent: note.draftContent,
      committedTitle: note.committedTitle,
      committedContent: note.committedContent,
      tags: note.tags,
    }),
    afterContent: '',
  })
  emitNoteUpdated(note, 'ai')
  return { ok: true as const, noteId: note.id, title: note.draftTitle }
}

export async function undoDeleteNote(id: number) {
  const note = await getNoteOrThrow(id)
  if (!note.deletedAt) throw new Error('该笔记未被标记删除，无需撤销')
  note.deletedAt = null
  await note.save()
  emitNoteUpdated(note, 'user')
  return serializeNote(note)
}

export async function readNote(id: number, startLine?: number, endLine?: number) {
  const note = await getNoteOrThrow(id)
  const lines = note.draftContent.split('\n')
  const s = startLine && startLine > 0 ? startLine : 1
  const e = endLine && endLine > 0 ? Math.min(endLine, lines.length) : lines.length
  return {
    id: note.id,
    title: note.draftTitle,
    draftContentVersion: note.draftContentVersion,
    totalLines: lines.length,
    startLine: s,
    endLine: e,
    content: lines.slice(s - 1, e).join('\n'),
    deletedAt: note.deletedAt ?? null,
  }
}

export function getDiff(note: Note) {
  const patch = structuredPatch('committed', 'draft', note.committedContent, note.draftContent, '', '', { context: 3 })
  return {
    noteId: note.id,
    committedTitle: note.committedTitle,
    draftTitle: note.draftTitle,
    committedContent: note.committedContent,
    deletedAt: note.deletedAt ?? null,
    hunks: patch.hunks,
  }
}

export async function listChanges() {
  const notes = await Note.findAll({ order: [['updatedAt', 'DESC']] })
  return notes
    .filter(
      (n) =>
        n.deletedAt ||
        n.draftContent !== n.committedContent ||
        n.draftTitle !== n.committedTitle,
    )
    .map((n) => ({
      id: n.id,
      committedTitle: n.committedTitle,
      draftTitle: n.draftTitle,
      updatedAt: n.updatedAt,
      deletedAt: n.deletedAt ?? null,
    }))
}

export async function commitNote(id: number, content?: string) {
  const note = await getNoteOrThrow(id)
  // 软删除的笔记 → 提交即硬删除
  if (note.deletedAt) {
    await note.destroy()
    emitEvent({ type: 'note-deleted', noteId: id })
    return { id, deleted: true }
  }
  const finalContent = content !== undefined ? content : note.draftContent
  note.committedTitle = note.draftTitle
  note.committedContent = finalContent
  if (note.draftContent !== finalContent) {
    note.draftContent = finalContent
    note.draftContentVersion += 1
  }
  await note.save()
  emitEvent({ type: 'note-committed', noteId: note.id })
  emitNoteUpdated(note, 'user')
  return serializeNote(note)
}

export async function commitAll() {
  const changes = await listChanges()
  const results = []
  for (const c of changes) {
    results.push(await commitNote(c.id))
  }
  return results
}

export async function rejectChange(id: number) {
  const note = await getNoteOrThrow(id)
  // 撤销软删除
  if (note.deletedAt) {
    note.deletedAt = null
  }
  // 重置草稿到已提交版本
  note.draftTitle = note.committedTitle
  note.draftContent = note.committedContent
  note.draftTitleVersion += 1
  note.draftContentVersion += 1
  await note.save()
  emitNoteUpdated(note, 'user')
  return serializeNote(note)
}

export async function deleteNote(id: number) {
  const note = await getNoteOrThrow(id)
  if (note.deletedAt) return serializeNote(note)
  note.deletedAt = new Date()
  await note.save()
  emitNoteUpdated(note, 'user')
  return serializeNote(note)
}
