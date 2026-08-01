/** opencode server HTTP API 的薄封装（类型参考 opencode OpenAPI /doc） */

export interface OpenCodeHealth {
  healthy: boolean
  version: string
}

export interface OpenCodeSession {
  id: string
  title?: string
  time?: { created?: string; updated?: string }
  directory?: string
  version?: number
}

export interface OpenCodePart {
  id?: string
  type: string
  text?: string
  tool?: string
  state?: { status?: string }
  [k: string]: unknown
}

export interface OpenCodeMessageInfo {
  id: string
  role: 'user' | 'assistant' | 'system' | string
  parentID?: string
  time?: { created?: string }
  [k: string]: unknown
}

export interface OpenCodeChatMessage {
  info: OpenCodeMessageInfo
  parts: OpenCodePart[]
}

export interface OpenCodeMessageResult {
  info: OpenCodeMessageInfo
  parts: OpenCodePart[]
}

export interface OpenCodeFindMatch {
  path: string
  lines: string
  line_number: number
  absolute_offset: number
  submatches: { content: string; start: number; end: number }[]
}

export class OpenCodeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message)
  }
}

/** 从 opencode 消息结果中提取纯文本回复（不含推理与工具调用细节） */
export function extractReplyText(result: OpenCodeMessageResult): string {
  return result.parts
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('\n')
    .trim()
}

export interface OpenCodeClientOptions {
  baseURL: string
  username?: string
  password?: string
  /** 单个请求超时（毫秒），默认 15s；健康检查等需快速失败场景可设更短 */
  timeoutMs?: number
  /** 执行类请求（sendMessage / shell）超时（毫秒），默认 10 分钟 */
  taskTimeoutMs?: number
}

export class OpenCodeClient {
  private baseURL: string
  private auth: string | null
  private timeoutMs: number
  private taskTimeoutMs: number

  constructor(options: OpenCodeClientOptions) {
    this.baseURL = options.baseURL.replace(/\/+$/, '')
    this.auth =
      options.username || options.password
        ? 'Basic ' + Buffer.from(`${options.username ?? 'opencode'}:${options.password ?? ''}`).toString('base64')
        : null
    this.timeoutMs = options.timeoutMs ?? 15000
    this.taskTimeoutMs = options.taskTimeoutMs ?? 600000
  }

  private async request<T>(method: string, path: string, body?: unknown, timeoutMs?: number): Promise<T> {
    const res = await fetch(this.baseURL + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(this.auth ? { Authorization: this.auth } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs ?? this.timeoutMs),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new OpenCodeError(`${method} ${path} 失败: HTTP ${res.status}`, res.status, text.slice(0, 500))
    }
    if (res.status === 204) return undefined as T
    return (await res.json()) as T
  }

  /** GET /global/health — 健康检查与版本 */
  health(): Promise<OpenCodeHealth> {
    return this.request('GET', '/global/health')
  }

  /** GET /session — 列出所有会话 */
  listSessions(): Promise<OpenCodeSession[]> {
    return this.request('GET', '/session')
  }

  /** GET /session/:id — 会话详情 */
  getSession(id: string): Promise<OpenCodeSession> {
    return this.request('GET', `/session/${encodeURIComponent(id)}`)
  }

  /** GET /session/:id/message — 消息历史 */
  getMessages(id: string, limit?: number): Promise<OpenCodeChatMessage[]> {
    const q = limit && limit > 0 ? `?limit=${limit}` : ''
    return this.request('GET', `/session/${encodeURIComponent(id)}/message${q}`)
  }

  /** POST /session — 创建会话 */
  createSession(body?: { title?: string; parentID?: string }): Promise<OpenCodeSession> {
    return this.request('POST', '/session', body ?? {})
  }

  /** POST /session/:id/message — 发送消息并等待回复（执行类，走长超时） */
  sendMessage(
    id: string,
    body: { parts: { type: string; text?: string }[]; agent?: string; model?: string },
  ): Promise<OpenCodeMessageResult> {
    return this.request('POST', `/session/${encodeURIComponent(id)}/message`, body, this.taskTimeoutMs)
  }

  /** POST /session/:id/abort — 中止运行中的会话 */
  abort(id: string): Promise<boolean> {
    return this.request('POST', `/session/${encodeURIComponent(id)}/abort`)
  }

  /** GET /find?pattern= — 跨文件搜索 */
  find(pattern: string): Promise<OpenCodeFindMatch[]> {
    return this.request('GET', `/find?pattern=${encodeURIComponent(pattern)}`)
  }

  /** POST /session/:id/shell — 让 opencode 执行 shell 命令（执行类，走长超时） */
  shell(id: string, body: { command: string; agent?: string; model?: string }): Promise<OpenCodeMessageResult> {
    return this.request('POST', `/session/${encodeURIComponent(id)}/shell`, body, this.taskTimeoutMs)
  }
}
