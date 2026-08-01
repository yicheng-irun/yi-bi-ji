import { createMCPClient, type MCPClient } from '@ai-sdk/mcp'
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio'
import type { ToolSet } from 'ai'

export interface McpServerConfig {
  /** 服务器唯一标识，也是工具名前缀 */
  name: string
  /** 传输类型：http（推荐）/ sse / stdio */
  type: 'http' | 'sse' | 'stdio'
  /** http/sse 的服务器地址 */
  url?: string
  /** http/sse 的请求头 */
  headers?: Record<string, string>
  /** stdio 启动命令 */
  command?: string
  /** stdio 启动参数 */
  args?: string[]
  /** stdio 环境变量 */
  env?: Record<string, string>
  /** 是否启用（默认 true；未启用时不挂载工具到 agent） */
  enabled?: boolean
}

/** 解析设置里的 MCP 服务器配置（JSON 数组字符串），非法输入返回空数组 */
export function parseMcpServers(raw: string | null | undefined): McpServerConfig[] {
  if (!raw || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((s): s is McpServerConfig => !!s && typeof s === 'object' && typeof s.name === 'string')
      .map((s) => ({
        name: s.name,
        type: s.type === 'sse' || s.type === 'stdio' ? s.type : 'http',
        url: typeof s.url === 'string' ? s.url : undefined,
        headers: s.headers && typeof s.headers === 'object' ? (s.headers as Record<string, string>) : undefined,
        command: typeof s.command === 'string' ? s.command : undefined,
        args: Array.isArray(s.args) ? (s.args as string[]) : undefined,
        env: s.env && typeof s.env === 'object' ? (s.env as Record<string, string>) : undefined,
        enabled: s.enabled !== false,
      }))
  } catch {
    return []
  }
}

function createTransport(server: McpServerConfig) {
  if (server.type === 'stdio') {
    return new Experimental_StdioMCPTransport({
      command: server.command ?? '',
      args: server.args,
      env: server.env,
    })
  }
  return {
    type: server.type,
    url: server.url ?? '',
    headers: server.headers,
  }
}

export function mcpToolKey(serverName: string, toolName: string): string {
  return `mcp__${serverName}__${toolName}`
}

export interface McpServerInfo {
  name: string
  tools: { key: string; name: string; description?: string }[]
  error?: string
}

export interface LoadedMcp {
  tools: ToolSet
  serversInfo: McpServerInfo[]
  /** 保持连接的 MCP 客户端（tools 的 execute 依赖它们，生命周期与缓存一致） */
  clients: MCPClient[]
}

/**
 * 连接配置的 MCP 服务器并汇总它们的工具（键名带 mcp__服务器__工具 前缀，避免与内置工具冲突）。
 * 连接失败的服务器会记录 error 并继续处理其余服务器。
 *
 * 注意：返回的 tools 的 execute 依赖对应的 client 实例，因此 client 不在此处关闭，
 * 由调用方在不再需要时通过 closeMcpClients() 统一关闭。
 */
export async function loadMcpTools(servers: McpServerConfig[]): Promise<LoadedMcp> {
  const tools: ToolSet = {}
  const serversInfo: McpServerInfo[] = []
  const clients: MCPClient[] = []
  for (const server of servers) {
    try {
      const client = await createMCPClient({ transport: createTransport(server) })
      clients.push(client)
      const serverTools = await client.tools()
      const list: McpServerInfo['tools'] = []
      for (const [name, tool] of Object.entries(serverTools)) {
        const key = mcpToolKey(server.name, name)
        tools[key] = tool as ToolSet[string]
        list.push({ key, name, description: (tool as { description?: string }).description })
      }
      serversInfo.push({ name: server.name, tools: list })
    } catch (e) {
      serversInfo.push({ name: server.name, tools: [], error: (e as Error).message })
    }
  }
  return { tools, serversInfo, clients }
}

/** 关闭一批 MCP 客户端（缓存失效/服务重启时调用，避免连接泄漏） */
export async function closeMcpClients(clients: MCPClient[]): Promise<void> {
  for (const c of clients) {
    await c.close().catch(() => {})
  }
}

let cache: { signature: string; loaded: LoadedMcp } | null = null

export function getMcpCacheKey(servers: McpServerConfig[]): string {
  return JSON.stringify(servers)
}

export async function loadMcpToolsCached(servers: McpServerConfig[]): Promise<LoadedMcp> {
  const signature = getMcpCacheKey(servers)
  if (cache && cache.signature === signature) return cache.loaded
  const loaded = await loadMcpTools(servers)
  cache = { signature, loaded }
  return loaded
}

export function clearMcpCache() {
  const old = cache
  cache = null
  if (old) {
    void closeMcpClients(old.loaded.clients)
  }
}
