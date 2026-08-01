import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

/** opencode serve 进程的工作目录（项目根），默认为仓库根目录 */
function resolveProjectDir(): string {
  const configured = process.env.OPENCODE_PROJECT_DIR
  if (configured) return path.resolve(configured)
  return path.resolve(process.cwd(), '..', '..')
}

export const env = {
  /** 本 MCP 服务器监听端口 */
  mcpPort: Number(process.env.MCP_PORT ?? 29420),
  mcpHostname: process.env.MCP_HOSTNAME ?? '0.0.0.0',
  /** MCP 端点访问令牌（Bearer）；为空则 `/mcp` 不做鉴权（局域网需务必设置） */
  mcpToken: process.env.MCP_TOKEN ?? '',
  /** opencode serve 地址；显式设置则不再由本进程 spawn */
  opencodeUrl: process.env.OPENCODE_URL ?? '',
  opencodePort: Number(process.env.OPENCODE_PORT ?? 4096),
  opencodeHostname: process.env.OPENCODE_HOSTNAME ?? '127.0.0.1',
  opencodeProjectDir: resolveProjectDir(),
  /** opencode serve 的 HTTP Basic auth（服务端凭据） */
  opencodeUsername: process.env.OPENCODE_USERNAME ?? process.env.OPENCODE_SERVER_USERNAME ?? 'opencode',
  opencodePassword: process.env.OPENCODE_PASSWORD ?? process.env.OPENCODE_SERVER_PASSWORD ?? '',
  /** opencode 可执行文件 */
  opencodeBin: process.env.OPENCODE_BIN ?? 'opencode',
}
