import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const PORT = 15311
export const BASE = `http://localhost:${PORT}`

let passed = 0
let failed = 0

/** 断言并记录结果（跨测试文件共享计数） */
export function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : '')
  }
}

/** 打印测试分组标题 */
export function section(name: string) {
  console.log(`\n▶ ${name}`)
}

export function getResults() {
  return { passed, failed }
}

/** 发请求到测试服务，返回 { status, body } */
export async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const body = (await res.json().catch(() => ({}))) as T
  return { status: res.status, body }
}

async function waitForServer(timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE + '/api/health')
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('server did not start in time')
}

let server: ChildProcess | null = null
let dataDir = ''

/** 启动测试服务（临时数据目录）并等待就绪 */
export async function startServer() {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biji-test-'))
  console.log(`启动测试服务 (port=${PORT}, data=${dataDir})`)
  server = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir },
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
  })
  await waitForServer()
}

/** 停止测试服务并清理临时数据目录 */
export function stopServer() {
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM')
    } catch {
      server?.kill('SIGTERM')
    }
  }
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true })
}
