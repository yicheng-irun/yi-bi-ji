import type { UIMessage } from 'ai'

export interface Note {
  id: number
  committedTitle: string
  committedContent: string
  draftTitle: string
  draftContent: string
  draftContentVersion: number
  draftTitleVersion: number
  tags: string[]
  hasChanges: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Hunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: string[]
}

export interface NoteDiff {
  noteId: number
  committedTitle: string
  draftTitle: string
  committedContent: string
  deletedAt: string | null
  hunks: Hunk[]
}

export interface ChangeItem {
  id: number
  committedTitle: string
  draftTitle: string
  updatedAt: string
  deletedAt: string | null
}

export interface Thread {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  metadata?: {
    originNoteId?: number
    kind?: 'subagent'
    parentThreadId?: string
    subagentId?: string
  }
}

export interface AiChangeLogItem {
  id: number
  noteId: number | null
  noteTitle: string | null
  threadId: string | null
  action: string
  summary: string
  createdAt: string
  beforeChars: number
  afterChars: number
}

export interface AiChangeLogDetail extends AiChangeLogItem {
  beforeContent: string
  afterContent: string
  hunks: Hunk[]
}

export const AI_LOG_ACTIONS: Record<string, string> = {
  create_note: '创建笔记',
  full_write: '全量写入',
  replace: '文本替换',
  insert_block: '插入区块',
  delete_note: '删除笔记',
  set_note_tags: '设置标签',
}

/** 当前前端实例的唯一 id，用于识别并忽略 SSE 中自己产生的回声事件 */
export const CLIENT_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error((body as { error?: string }).error ?? `HTTP ${res.status}`) as Error & {
      status: number
      body: unknown
    }
    err.status = res.status
    err.body = body
    throw err
  }
  return res.json() as Promise<T>
}

export const api = {
  listNotes: () => request<Note[]>('/api/notes'),
  getNote: (id: number) => request<Note>(`/api/notes/${id}`),
  createNote: (title: string) => request<Note>('/api/notes', { method: 'POST', body: JSON.stringify({ title }) }),
  deleteNote: (id: number) => request<Note>(`/api/notes/${id}`, { method: 'DELETE' }),
  saveDraft: (
    id: number,
    data: { draftTitle: string; draftContent: string; baseContentVersion: number; baseTitleVersion: number },
  ) => request<Note>(`/api/notes/${id}/draft`, { method: 'PUT', body: JSON.stringify({ ...data, clientId: CLIENT_ID }) }),
  commitNote: (id: number, content?: string) =>
    request<Note>(`/api/notes/${id}/commit`, { method: 'POST', body: JSON.stringify(content !== undefined ? { content } : {}) }),
  updateMeta: (id: number, data: { tags?: string[] }) =>
    request<Note>(`/api/notes/${id}/meta`, { method: 'PATCH', body: JSON.stringify(data) }),
  listChanges: () => request<ChangeItem[]>('/api/changes'),
  commitAll: () => request<Note[]>('/api/changes/commit-all', { method: 'POST', body: '{}' }),
  rejectChange: (id: number) => request<Note>(`/api/changes/${id}/reject`, { method: 'POST', body: '{}' }),
  getDiff: (id: number) => request<NoteDiff>(`/api/changes/${id}/diff`),
  listThreads: () => request<{ threads: Thread[] }>('/api/chat/threads'),
  createThread: (title?: string, noteId?: number) =>
    request<Thread>('/api/chat/threads', { method: 'POST', body: JSON.stringify({ title, noteId }) }),
  getMessages: (threadId: string) =>
    request<{ messages: UIMessage[] }>(`/api/chat/threads/${threadId}/messages`),
  deleteThread: (threadId: string) =>
    request<{ ok: boolean }>(`/api/chat/threads/${threadId}`, { method: 'DELETE' }),
  getContext: (threadId: string) =>
    request<{ messageCount: number; charCount: number; estimatedTokens: number }>(
      `/api/chat/threads/${threadId}/context`,
    ),
  listAiChangeLogs: (params: { noteId?: number; action?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams()
    if (params.noteId) qs.set('noteId', String(params.noteId))
    if (params.action) qs.set('action', params.action)
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.offset) qs.set('offset', String(params.offset))
    const q = qs.toString()
    return request<{ total: number; logs: AiChangeLogItem[] }>(`/api/ai-logs${q ? `?${q}` : ''}`)
  },
  getAiChangeLog: (id: number) => request<AiChangeLogDetail>(`/api/ai-logs/${id}`),
  deleteAiChangeLog: (id: number) =>
    request<{ ok: boolean }>(`/api/ai-logs/${id}`, { method: 'DELETE' }),
  clearAiChangeLogs: (params: { noteId?: number; action?: string } = {}) =>
    request<{ deleted: number }>('/api/ai-logs', { method: 'DELETE', body: JSON.stringify(params) }),
}
