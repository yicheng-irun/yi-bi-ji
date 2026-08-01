import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({
  name: 'demo-echo',
  version: '1.0.0',
})

server.registerTool(
  'echo',
  { title: 'Echo', description: 'Returns the input text back', inputSchema: { text: z.string().describe('text to echo') } },
  async ({ text }) => ({ content: [{ type: 'text', text }] }),
)

await server.connect(new StdioServerTransport())
