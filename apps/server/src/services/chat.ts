import type { UIMessage } from 'ai'
import { ChatMessage, ChatThread } from '../db/models.js'

export function parseThreadMetadata(thread: Pick<ChatThread, 'metadata'>): Record<string, unknown> {
  try {
    return JSON.parse(thread.metadata || '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

export function threadToJson(t: ChatThread) {
  return {
    id: t.id,
    title: t.title,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    metadata: parseThreadMetadata(t),
  }
}

export function rowToUIMessage(m: ChatMessage): UIMessage {
  let parts: UIMessage['parts'] = []
  try {
    parts = JSON.parse(m.parts || '[]') as UIMessage['parts']
  } catch {
    parts = []
  }
  return { id: m.id, role: m.role as UIMessage['role'], parts }
}

export async function loadHistory(threadId: string): Promise<UIMessage[]> {
  const rows = await ChatMessage.findAll({ where: { threadId }, order: [['createdAt', 'ASC']] })
  return rows.map(rowToUIMessage)
}

export async function persistMessages(threadId: string, messages: UIMessage[]) {
  const base = Date.now()
  await ChatMessage.bulkCreate(
    messages.map((m, i) => ({
      id: m.id,
      threadId,
      role: m.role,
      parts: JSON.stringify(m.parts ?? []),
      createdAt: new Date(base + i),
      updatedAt: new Date(base + i),
    })),
  )
  await ChatThread.update({ updatedAt: new Date() }, { where: { id: threadId } })
}

export async function deleteThreadCascade(threadId: string) {
  const all = await ChatThread.findAll({ attributes: ['id', 'metadata'] })
  const childIds = all
    .filter((t) => parseThreadMetadata(t).parentThreadId === threadId)
    .map((t) => t.id)
  const ids = [...childIds, threadId]
  await ChatMessage.destroy({ where: { threadId: ids } })
  await ChatThread.destroy({ where: { id: ids } })
}
