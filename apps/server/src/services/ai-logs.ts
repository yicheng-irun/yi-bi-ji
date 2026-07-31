import { structuredPatch } from 'diff'
import { Note, AiChangeLog } from '../db/models.js'
import { NotFoundError } from './notes.js'

export const AI_LOG_ACTIONS: Record<string, string> = {
  create_note: '创建笔记',
  full_write: '全量写入',
  replace: '文本替换',
  insert_block: '插入区块',
  delete_note: '删除笔记',
  set_note_tags: '设置标签',
}

export async function listAiChangeLogs(opts: {
  noteId?: number
  threadId?: string
  action?: string
  limit?: number
  offset?: number
}) {
  const where: Record<string, unknown> = {}
  if (opts.noteId) where.noteId = opts.noteId
  if (opts.threadId) where.threadId = opts.threadId
  if (opts.action) where.action = opts.action

  const { rows, count } = await AiChangeLog.findAndCountAll({
    where,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: opts.limit ?? 50,
    offset: opts.offset ?? 0,
  })

  const noteIds = [...new Set(rows.map((r) => r.noteId).filter((x): x is number => x != null))]
  const notes = noteIds.length ? await Note.findAll({ where: { id: noteIds } }) : []
  const titleById = new Map(notes.map((n) => [n.id, n.draftTitle || n.committedTitle]))

  return {
    total: count,
    logs: rows.map((r) => ({
      id: r.id,
      noteId: r.noteId,
      noteTitle: r.noteId != null ? (titleById.get(r.noteId) ?? null) : null,
      threadId: r.threadId,
      action: r.action,
      summary: r.summary,
      createdAt: r.createdAt,
      beforeChars: r.beforeContent.length,
      afterChars: r.afterContent.length,
    })),
  }
}

export async function deleteAiChangeLog(id: number) {
  const log = await AiChangeLog.findByPk(id)
  if (!log) throw new NotFoundError(`ai change log ${id} not found`)
  await log.destroy()
  return { ok: true }
}

export async function clearAiChangeLogs(opts: { noteId?: number; threadId?: string; action?: string }) {
  const where: Record<string, unknown> = {}
  if (opts.noteId) where.noteId = opts.noteId
  if (opts.threadId) where.threadId = opts.threadId
  if (opts.action) where.action = opts.action
  const { count } = await AiChangeLog.findAndCountAll({ where })
  await AiChangeLog.destroy({ where })
  return { deleted: count }
}

export async function getAiChangeLogDetail(id: number) {
  const log = await AiChangeLog.findByPk(id)
  if (!log) throw new NotFoundError(`ai change log ${id} not found`)

  let noteTitle: string | null = null
  if (log.noteId != null) {
    const note = await Note.findByPk(log.noteId)
    noteTitle = note ? (note.draftTitle || note.committedTitle) : null
  }

  const patch = structuredPatch('before', 'after', log.beforeContent, log.afterContent, '', '', { context: 3 })

  return {
    id: log.id,
    noteId: log.noteId,
    noteTitle,
    threadId: log.threadId,
    action: log.action,
    summary: log.summary,
    beforeContent: log.beforeContent,
    afterContent: log.afterContent,
    createdAt: log.createdAt,
    hunks: patch.hunks,
  }
}
