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
}
