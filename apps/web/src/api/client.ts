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
  resourceId: string
  createdAt: string
  updatedAt: string
  metadata?: { originNoteId?: number }
}

export interface ChatPart {
  type: 'text' | 'tool'
  text?: string
  toolName?: string
  state?: string
  args?: unknown
}

export interface ChatMessage {
  id?: string
  role: string
  parts: ChatPart[]
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
  listThreads: () => request<Thread[] | { threads: Thread[] }>('/api/chat/threads'),
  createThread: (title?: string, noteId?: number) =>
    request<Thread>('/api/chat/threads', { method: 'POST', body: JSON.stringify({ title, noteId }) }),
  getMessages: (threadId: string) =>
    request<{ messages: ChatMessage[] }>(`/api/chat/threads/${threadId}/messages`),
  deleteThread: (threadId: string) =>
    request<{ ok: boolean }>(`/api/chat/threads/${threadId}`, { method: 'DELETE' }),
  getContext: (threadId: string) =>
    request<{ messageCount: number; charCount: number; estimatedTokens: number }>(
      `/api/chat/threads/${threadId}/context`,
    ),
}

export interface StreamHandlers {
  onText: (delta: string) => void
  onToolCall: (toolName: string, args: unknown) => void
  onToolResult: (toolName: string, result: unknown) => void
  onDone: () => void
  onError: (message: string) => void
}

export async function streamChat(
  threadId: string,
  message: string,
  currentNoteId: number | undefined,
  handlers: StreamHandlers,
  signal?: AbortSignal,
) {
  const res = await fetch(`/api/chat/threads/${threadId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, currentNoteId }),
    signal,
  })
  if (!res.ok || !res.body) {
    handlers.onError(`HTTP ${res.status}`)
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const rawEvent = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      let event = 'message'
      let data = ''
      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      let parsed: Record<string, unknown> = {}
      try {
        parsed = data ? JSON.parse(data) : {}
      } catch {
        continue
      }
      switch (event) {
        case 'text':
          handlers.onText(String(parsed.delta ?? ''))
          break
        case 'tool-call':
          handlers.onToolCall(String(parsed.toolName ?? ''), parsed.args)
          break
        case 'tool-result':
          handlers.onToolResult(String(parsed.toolName ?? ''), parsed.result)
          break
        case 'done':
          handlers.onDone()
          break
        case 'error':
          handlers.onError(String(parsed.message ?? 'unknown error'))
          break
      }
    }
  }
  handlers.onDone()
}
