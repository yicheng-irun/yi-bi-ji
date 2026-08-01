import { Hono } from 'hono'
import { loadMcpTools, parseMcpServers } from '../agent/mcp.js'

export const mcpRoutes = new Hono()

/** 测试 MCP 服务器连接并列出可用工具（不落库，用于设置页试连） */
mcpRoutes.post('/test', async (c) => {
  const body = await c.req.json<{ mcpServers?: string }>().catch(() => ({}) as { mcpServers?: string })
  const servers = parseMcpServers(body.mcpServers)
  if (servers.length === 0) {
    return c.json({ ok: true, servers: [] })
  }
  const { serversInfo } = await loadMcpTools(servers)
  const failed = serversInfo.some((s) => s.error)
  return c.json({
    ok: !failed,
    servers: serversInfo.map((s) => ({ name: s.name, error: s.error ?? null, tools: s.tools })),
  })
})
