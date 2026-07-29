import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PORT = 15311
const BASE = `http://localhost:${PORT}`

let passed = 0
let failed = 0
let server: ChildProcess | null = null
let dataDir = ''

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : '')
  }
}

async function api<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
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

interface Hunk {
  oldStart: number
  oldLines: number
  lines: string[]
}

function buildFromHunks(committed: string, hunks: Hunk[], accepted: boolean[]) {
  const oldLines = committed.split('\n')
  const out: string[] = []
  let cursor = 0
  hunks.forEach((h, i) => {
    const start = h.oldStart - 1
    out.push(...oldLines.slice(cursor, start))
    if (accepted[i]) out.push(...h.lines.filter((l) => l[0] === ' ' || l[0] === '+').map((l) => l.slice(1)))
    else out.push(...h.lines.filter((l) => l[0] === ' ' || l[0] === '-').map((l) => l.slice(1)))
    cursor = start + h.oldLines
  })
  out.push(...oldLines.slice(cursor))
  return out.join('\n')
}

async function run() {
  console.log('▶ 笔记 CRUD / 草稿 / 冲突')
  const created = await api('/api/notes', { method: 'POST', body: JSON.stringify({ title: '冒烟', content: 'a\nb\nc\n' }) })
  check('创建笔记', created.status === 201)
  const noteId = (created.body as { id: number }).id

  const save1 = await api(`/api/notes/${noteId}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ draftContent: 'a\nb改\nc\nd新增\n', baseContentVersion: 1, baseTitleVersion: 1 }),
  })
  check('保存草稿成功', save1.status === 200 && (save1.body as { draftContentVersion: number }).draftContentVersion === 2)

  const conflict = await api(`/api/notes/${noteId}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ draftContent: 'x', baseContentVersion: 1, baseTitleVersion: 1 }),
  })
  check('过期版本号保存返回 409', conflict.status === 409)

  console.log('▶ diff / 部分提交 / 全部提交')
  const diff = await api(`/api/changes/${noteId}/diff`)
  const hunks = (diff.body as { hunks: Hunk[] }).hunks
  check('diff 返回 hunks', diff.status === 200 && hunks.length > 0)

  const committed = (diff.body as { committedContent: string }).committedContent
  const draft = (await api(`/api/notes/${noteId}`)).body as { draftContent: string }
  check('hunks 全接受可还原草稿', buildFromHunks(committed, hunks, hunks.map(() => true)) === draft.draftContent)
  check('hunks 全拒绝可还原已提交', buildFromHunks(committed, hunks, hunks.map(() => false)) === committed)
  check('hunks 不含换行伪行', !hunks.some((h) => h.lines.some((l) => l[0] === '\\' && buildFromHunks(committed, [h], [true]).includes('No newline'))))

  const partial = buildFromHunks(committed, hunks, hunks.map((_, i) => i !== 0))
  const commit = await api(`/api/notes/${noteId}/commit`, { method: 'POST', body: JSON.stringify({ content: partial }) })
  check('部分提交落库', commit.status === 200 && (commit.body as { committedContent: string }).committedContent === partial)
  check('提交后无变更', ((await api('/api/changes')).body as unknown[]).length === 0)

  await api(`/api/notes/${noteId}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ draftContent: 'v2 内容\n', baseContentVersion: (commit.body as { draftContentVersion: number }).draftContentVersion, baseTitleVersion: 1 }),
  })
  const commitAll = await api('/api/changes/commit-all', { method: 'POST', body: '{}' })
  check('全部提交', commitAll.status === 200 && ((await api('/api/changes')).body as unknown[]).length === 0)

  console.log('▶ 全局事件 SSE')
  const sseEvents: string[] = []
  const controller = new AbortController()
  const ssePromise = (async () => {
    const res = await fetch(BASE + '/api/events', { signal: controller.signal })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, idx)
        buf = buf.slice(idx + 2)
        const ev = raw.split('\n').find((l) => l.startsWith('event:'))
        if (ev) sseEvents.push(ev.slice(6).trim())
      }
    }
  })().catch(() => {})
  await new Promise((r) => setTimeout(r, 500))
  const note = (await api(`/api/notes/${noteId}`)).body as { draftContentVersion: number }
  await api(`/api/notes/${noteId}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ draftContent: 'sse 测试\n', baseContentVersion: note.draftContentVersion, baseTitleVersion: 1 }),
  })
  await new Promise((r) => setTimeout(r, 800))
  controller.abort()
  await ssePromise
  check('草稿保存触发 note-updated 事件', sseEvents.includes('note-updated'), sseEvents)

  const del = await api(`/api/notes/${noteId}`, { method: 'DELETE' })
  check('删除笔记', del.status === 200)

  console.log('▶ AI 会话')
  let hasAiKey = !!process.env.AI_API_KEY
  if (!hasAiKey) {
    const envFile = path.resolve(import.meta.dirname, '../.env')
    if (fs.existsSync(envFile) && /^AI_API_KEY=.+/m.test(fs.readFileSync(envFile, 'utf8'))) hasAiKey = true
  }
  if (!hasAiKey) {
    console.log('  - 跳过（未设置 AI_API_KEY）')
  } else {
    const note2 = await api('/api/notes', { method: 'POST', body: JSON.stringify({ title: 'AI 目标', content: '初始内容\n' }) })
    const nid = (note2.body as { id: number }).id
    const thread = await api('/api/chat/threads', { method: 'POST', body: JSON.stringify({ noteId: nid }) })
    const tid = (thread.body as { id: string }).id
    check('创建关联会话(带 originNoteId)', thread.status === 201 && (thread.body as { metadata?: { originNoteId?: number } }).metadata?.originNoteId === nid)

    const events: string[] = []
    const res = await fetch(`${BASE}/api/chat/threads/${tid}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '用 read_note 读一下当前笔记，然后回复我一个字：好', currentNoteId: nid }),
    })
    const text = await res.text()
    for (const chunk of text.split('\n\n')) {
      const ev = chunk.split('\n').find((l) => l.startsWith('event:'))
      if (ev) events.push(ev.slice(6).trim())
    }
    check('流式返回 text 事件', events.includes('text'), events.slice(0, 10))
    check('agent 调用了 read_note 工具', text.includes('"toolName":"read_note"'))
    check('流正常结束 done', events.includes('done'))

    const ctx = await api(`/api/chat/threads/${tid}/context`)
    check('上下文统计接口', ctx.status === 200 && (ctx.body as { messageCount: number }).messageCount >= 2, ctx.body)

    const delThread = await api(`/api/chat/threads/${tid}`, { method: 'DELETE' })
    check('删除会话', delThread.status === 200)
    await api(`/api/notes/${nid}`, { method: 'DELETE' })
  }
}

async function main() {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biji-smoke-'))
  console.log(`启动测试服务 (port=${PORT}, data=${dataDir})`)
  server = spawn('npx', ['tsx', 'src/index.ts'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir },
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: true,
  })

  const stopServer = () => {
    if (server?.pid) {
      try {
        process.kill(-server.pid, 'SIGTERM')
      } catch {
        server?.kill('SIGTERM')
      }
    }
  }

  try {
    await waitForServer()
    await run()
  } finally {
    stopServer()
    fs.rmSync(dataDir, { recursive: true, force: true })
  }

  console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM')
    } catch {
      server?.kill('SIGTERM')
    }
  }
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true })
  process.exit(1)
})
