import path from 'node:path'
import { api, check, section } from './helpers.mts'

interface McpTool { key: string; name: string }

export async function runMcpTests() {
  section('MCP 服务器')
  const mcpDemo = path.resolve(import.meta.dirname, './fixtures/mcp-demo-server.mts')
  const mcpConfig = JSON.stringify([
    { name: 'demo', type: 'stdio', command: 'npx', args: ['tsx', mcpDemo] },
  ])
  const mcpTest = await api('/api/mcp/test', { method: 'POST', body: JSON.stringify({ mcpServers: mcpConfig }) })
  const mcpServers = (mcpTest.body as { servers: Array<{ name: string; error: string | null; tools: McpTool[] }> }).servers
  check('MCP 测试连接成功', mcpTest.status === 200 && mcpServers[0]?.name === 'demo' && !mcpServers[0]?.error)
  check('MCP 工具带前缀加载', !!mcpServers[0]?.tools.find((t) => t.key === 'mcp__demo__echo'), mcpServers[0]?.tools)
  const mcpBad = await api('/api/mcp/test', { method: 'POST', body: JSON.stringify({ mcpServers: JSON.stringify([{ name: 'x', type: 'http', url: 'http://127.0.0.1:1' }]) }) })
  check('MCP 连接失败返回 error', ((mcpBad.body as { servers: Array<{ error: string | null }> }).servers[0]?.error ?? '') !== '')

  const saveMcp = await api('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ mcpServers: mcpConfig }),
  })
  check('保存 MCP 配置', saveMcp.status === 200 && (saveMcp.body as { mcpServers: string }).mcpServers === mcpConfig)
  const readMcp = await api('/api/settings')
  check('MCP 配置持久化', (readMcp.body as { mcpServers: string }).mcpServers === mcpConfig)

  const disabledConfig = JSON.stringify([
    { name: 'demo', type: 'stdio', command: 'npx', args: ['tsx', mcpDemo], enabled: false },
  ])
  const saveDisabled = await api('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ mcpServers: disabledConfig }),
  })
  check('保存禁用状态的 MCP 配置', saveDisabled.status === 200 && (saveDisabled.body as { mcpServers: string }).mcpServers === disabledConfig)

  await api('/api/settings', { method: 'PUT', body: JSON.stringify({ mcpServers: '' }) })
}
