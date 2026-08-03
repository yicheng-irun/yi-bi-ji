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

export interface SearchResultItem {
  id: number
  title: string
  updatedAt: string
  snippet: string
  hasChanges: boolean
  deletedAt: string | null
}

export const api = {
  listNotes: () => request<Note[]>('/api/notes'),
  getNote: (id: number) => request<Note>(`/api/notes/${id}`),
  searchNotes: (q: string) =>
    request<{ total: number; page: number; perPage: number; notes: SearchResultItem[] }>(
      `/api/notes/search?q=${encodeURIComponent(q)}`,
    ),
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
  getSettings: () => request<Settings>('/api/settings'),
  updateSettings: (data: Partial<Settings>) =>
    request<Settings>('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  testSettings: () =>
    request<{ ok: boolean; text?: string; error?: string }>('/api/settings/test', { method: 'POST', body: '{}' }),
  testBackup: () =>
    request<{ ok: boolean; error?: string }>('/api/backup/test', { method: 'POST', body: '{}' }),
  syncBackup: () =>
    request<{ ok: boolean; counts?: Record<string, number>; error?: string }>('/api/backup/sync', { method: 'POST', body: '{}' }),
  testMcp: (mcpServers: string) =>
    request<McpTestResult>('/api/mcp/test', { method: 'POST', body: JSON.stringify({ mcpServers }) }),
  getBrowserStatus: () => request<BrowserStatus>('/api/browser/status'),
  testBrowser: (url: string) =>
    request<BrowserTestResult>('/api/browser/test', { method: 'POST', body: JSON.stringify({ url }) }),
  disconnectBrowser: () =>
    request<{ ok: boolean }>('/api/browser/disconnect', { method: 'POST', body: '{}' }),
  transcribeAudio: async (blob: Blob) => {
    const res = await fetch('/api/voice/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': blob.type || 'audio/wav' },
      body: blob,
    })
    const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
    if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`)
    return json.text ?? ''
  },
  speech: async (text: string) => {
    const res = await fetch('/api/voice/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(json.error ?? `HTTP ${res.status}`)
    }
    return await res.blob()
  },
  testVoice: () =>
    request<{ ok: boolean; error?: string }>('/api/voice/test', { method: 'POST', body: '{}' }),
  /** 语音设置页测试：用指定档案（可为未保存的编辑内容）合成音频，返回可播放的 Blob */
  testVoiceSpeech: async (text: string, profile?: VoiceProfileDraft) => {
    const res = await fetch('/api/voice/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, profile }),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(json.error ?? `HTTP ${res.status}`)
    }
    return await res.blob()
  },
  /** 语音设置页测试：用指定档案识别音频（录音 / 文件），返回文本 */
  testVoiceAsr: async (blob: Blob, profile?: VoiceProfileDraft) => {
    const buf = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) {
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    }
    const res = await fetch('/api/voice/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64: btoa(bin), mimeType: blob.type || 'audio/wav', profile }),
    })
    const json = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
    if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`)
    return json.text ?? ''
  },
}

export interface McpToolInfo {
  key: string
  name: string
  description?: string
}

/** MCP 服务器配置（设置页编辑/预览用，与后端 McpServerConfig 一致） */
export interface McpServerDraft {
  name: string
  type: 'http' | 'sse' | 'stdio'
  url?: string
  headers?: Record<string, string>
  command?: string
  args?: string[]
  env?: Record<string, string>
  enabled?: boolean
}

export function parseMcpServers(raw: string): McpServerDraft[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is McpServerDraft => !!s && typeof s === 'object' && typeof s.name === 'string')
  } catch {
    return []
  }
}

export function serializeMcpServers(servers: McpServerDraft[]): string {
  return JSON.stringify(servers, null, 2)
}

export interface McpServerResult {
  name: string
  error: string | null
  tools: McpToolInfo[]
}

export interface McpTestResult {
  ok: boolean
  servers: McpServerResult[]
}

export interface Settings {
  aiBaseURL: string
  aiApiKey: string
  aiModel: string
  reasoningEffort: string
  aiTools: string
  aiSubagentTools: string
  mcpServers: string
  browserCdpEnabled: string
  browserCdpUrl: string
  backupType: string
  backupPath: string
  backupHost: string
  backupPort: string
  backupUser: string
  backupPassword: string
  backupDatabase: string
  voiceProvider: string
  voiceAsrUrl: string
  voiceAsrModel: string
  voiceTtsUrl: string
  voiceTtsModel: string
  voiceTtsVoice: string
  voiceLang: string
  voiceProfiles: string
  voiceActiveProfile: string
  voiceEnabled: string
  voiceAutoSpeak: string
  voiceAutoSend: string
}

/** 语音配置档案（设置页编辑用，与后端 voice-config.ts 一致） */
export interface VoiceAsrDraft {
  url: string
  method?: string
  headers?: Record<string, string>
  format?: 'multipart' | 'json'
  fileField?: string
  body?: unknown
  textPath?: string
  timeoutMs?: number
}

export interface VoiceTtsDraft {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: unknown
  responseType?: 'binary' | 'json'
  audioPath?: string
  timeoutMs?: number
}

export interface VoiceProfileDraft {
  name: string
  apiKey?: string
  asr?: VoiceAsrDraft
  tts?: VoiceTtsDraft
}

export function parseVoiceProfiles(raw: string): VoiceProfileDraft[] {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p): p is VoiceProfileDraft => !!p && typeof p === 'object' && typeof p.name === 'string')
  } catch {
    return []
  }
}

export function serializeVoiceProfiles(profiles: VoiceProfileDraft[]): string {
  return JSON.stringify(profiles, null, 2)
}

export interface CdpTabInfo {
  index: number
  title: string
  url: string
}

export interface BrowserStatus {
  enabled: boolean
  url: string
  connected: boolean
  version?: string
  tabs?: CdpTabInfo[]
  reason?: string
}

export interface BrowserTestResult {
  ok: boolean
  url: string
  version?: string
  tabs?: CdpTabInfo[]
  reason?: string
}

/** Agent 工具元信息，用于设置页勾选「可用工具」 */
export interface AgentToolInfo {
  name: string
  label: string
  hint: string
  /** 该工具的前置依赖：'cdp' 表示需在「浏览器控制」启用后才能勾选/使用 */
  requires?: 'cdp'
}

export const AGENT_TOOLS: AgentToolInfo[] = [
  { name: 'web_search', label: '联网搜索', hint: '在互联网上搜索资料、新闻' },
  { name: 'web_fetch', label: '网页抓取', hint: '打开网页提取正文（Markdown）' },
  { name: 'deep_research', label: '深度调研子代理', hint: '派出联网研究子代理做复杂调研' },
  { name: 'browser_tabs', label: '浏览器·标签页', hint: '列出本机浏览器打开的标签页', requires: 'cdp' },
  { name: 'browser_read', label: '浏览器·读取', hint: '读取已打开页面正文（可过登录/反爬）', requires: 'cdp' },
  { name: 'browser_screenshot', label: '浏览器·截图', hint: '截取当前页面并存入笔记', requires: 'cdp' },
  { name: 'browser_navigate', label: '浏览器·跳转', hint: '让浏览器跳转/新开网页', requires: 'cdp' },
  { name: 'browser_click', label: '浏览器·点击', hint: '点击页面元素（真实操作）', requires: 'cdp' },
  { name: 'browser_type', label: '浏览器·输入', hint: '在输入框中输入文字（真实操作）', requires: 'cdp' },
  { name: 'browser_eval', label: '浏览器·执行 JS', hint: '在页面里执行 JavaScript（滚动/DOM 等，真实操作）', requires: 'cdp' },
  { name: 'list_notes', label: '列出笔记', hint: '概览库中所有笔记' },
  { name: 'search_notes', label: '搜索笔记', hint: '按关键词模糊搜索笔记' },
  { name: 'read_note', label: '读取笔记', hint: '读取笔记草稿内容（支持行范围）' },
  { name: 'create_note', label: '创建笔记', hint: '新建笔记（写入草稿）' },
  { name: 'set_note_tags', label: '设置标签', hint: '整体设置笔记标签' },
  { name: 'write_note', label: '全量写入', hint: '整体覆盖笔记草稿' },
  { name: 'replace_in_note', label: '文本替换', hint: '在笔记中做字符串替换' },
  { name: 'insert_block', label: '插入区块', hint: '在笔记中锚点插入 markdown 区块' },
  { name: 'delete_note', label: '删除笔记', hint: '标记笔记待删除（软删除）' },
]

/** 调研子代理可用工具（不含 deep_research，避免递归） */
export const SUBAGENT_TOOLS = AGENT_TOOLS.filter((t) => t.name !== 'deep_research')

export const ALL_TOOLS_SENTINEL = '*'

export const REASONING_EFFORT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '不设置' },
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
]
