import { serve } from '@hono/node-server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { Hono } from 'hono'
import { env } from './env.js'
import { registerTools } from './tools.js'
import { ServeManager } from './serve-manager.js'

const app = new Hono()

const serveManager = new ServeManager({
  bin: env.opencodeBin,
  port: env.opencodePort,
  hostname: env.opencodeHostname,
  projectDir: env.opencodeProjectDir,
  username: env.opencodeUsername,
  password: env.opencodePassword,
  externalUrl: env.opencodeUrl || undefined,
})

app.get('/health', (c) => c.json({ ok: true }))

if (env.mcpToken) {
  app.use('/mcp', async (c, next) => {
    const auth = c.req.header('authorization')
    if (auth === `Bearer ${env.mcpToken}`) return next()
    return c.json({ error: 'unauthorized' }, 401)
  })
}

const transport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
})
const server = new McpServer({ name: 'bi-ji-opencode-mcp', version: '0.1.0' })
registerTools(server, serveManager.client)
await server.connect(transport)

app.all('/mcp', (c) => transport.handleRequest(c.req.raw))

await serveManager.start()
serve({ fetch: app.fetch, port: env.mcpPort, hostname: env.mcpHostname }, (info) => {
  console.log(`[opencode-mcp] MCP server listening on http://${info.address}:${info.port}/mcp`)
})

async function shutdown() {
  await transport.close().catch(() => {})
  await serveManager.dispose()
  process.exit(0)
}
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    void shutdown()
  })
}
