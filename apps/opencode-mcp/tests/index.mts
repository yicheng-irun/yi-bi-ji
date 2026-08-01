import { createMCPClient } from '@ai-sdk/mcp'
import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'

const MCP_PORT = 15312
const OPENCODE_PORT = 15313
const BASE = `http://127.0.0.1:${MCP_PORT}/mcp`

let passed = 0
let failed = 0
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : '')
  }
}

async function waitForServer(timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${MCP_PORT}/health`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('opencode-mcp bridge did not start in time')
}

let child: ChildProcess | null = null

async function main() {
  console.log(`启动 opencode-mcp bridge (mcp=${MCP_PORT}, opencode=${OPENCODE_PORT})`)
  child = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env,
      MCP_PORT: String(MCP_PORT),
      MCP_HOSTNAME: '127.0.0.1',
      OPENCODE_PORT: String(OPENCODE_PORT),
      OPENCODE_HOSTNAME: '127.0.0.1',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
  })
  await waitForServer()

  const client = await createMCPClient({ transport: { type: 'http', url: BASE } })
  const tools = await client.tools()
  const toolNames = Object.keys(tools)
  console.log('  工具:', toolNames.join(', '))

  const expected = [
    'opencode_status',
    'opencode_list_sessions',
    'opencode_get_session',
    'opencode_prompt',
    'opencode_continue',
    'opencode_abort',
    'opencode_search',
    'opencode_run_shell',
  ]
  for (const name of expected) {
    check(`工具已注册: ${name}`, toolNames.includes(name))
  }

  const statusTool = tools.opencode_status as { execute: (input: unknown, extra?: unknown) => unknown }
  try {
    const raw = await statusTool.execute({})
    const chunks: unknown[] = []
    if (raw && typeof (raw as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function') {
      for await (const c of raw as AsyncIterable<unknown>) chunks.push(c)
    } else if (raw) {
      chunks.push(raw)
    }
    const text = chunks
      .map((c) => (c as { content?: { type?: string; text?: string }[] })?.content?.find((x) => x.type === 'text')?.text)
      .filter(Boolean)
      .join('\n')
    check('opencode_status 调用成功', typeof text === 'string' && text.includes('healthy'), text)
  } catch (e) {
    check('opencode_status 调用成功', false, (e as Error).message)
  }

  await client.close()
  console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
  process.exitCode = failed > 0 ? 1 : 0
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    if (child?.pid) {
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        try {
          process.kill(child.pid, 'SIGKILL')
        } catch {
          // already gone
        }
      }
      await once(child, 'exit').catch(() => {})
    }
  })
