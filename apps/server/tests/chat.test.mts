import fs from 'node:fs'
import path from 'node:path'
import { api, BASE, check, section } from './helpers.mts'

export async function runChatTests() {
  section('AI 会话')
  let hasAiKey = !!process.env.AI_API_KEY
  if (!hasAiKey) {
    const envFile = path.resolve(import.meta.dirname, '../.env')
    if (fs.existsSync(envFile) && /^AI_API_KEY=.+/m.test(fs.readFileSync(envFile, 'utf8'))) hasAiKey = true
  }
  if (!hasAiKey) {
    console.log('  - 跳过（未设置 AI_API_KEY）')
    return
  }
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
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) continue
    const data = line.slice(5).trim()
    if (data === '[DONE]') { events.push('[DONE]'); continue }
    try {
      const parsed = JSON.parse(data) as { type?: string }
      if (parsed.type) events.push(parsed.type)
    } catch { /* ignore */ }
  }
  check('流式返回 text-delta 事件', events.includes('text-delta'), events.slice(0, 10))
  check('agent 调用了 read_note 工具', text.includes('"toolName":"read_note"'))
  check('流正常结束 [DONE]', events.includes('[DONE]'))

  const history = await api(`/api/chat/threads/${tid}/messages`)
  const msgs = (history.body as { messages: Array<{ role: string; parts: Array<{ type: string }> }> }).messages
  check(
    '消息已持久化（含工具调用）',
    msgs.length >= 2 && msgs.some((m) => m.role === 'assistant' && m.parts.some((p) => p.type === 'tool-read_note')),
    msgs.map((m) => [m.role, m.parts.map((p) => p.type)]),
  )

  const ctx = await api(`/api/chat/threads/${tid}/context`)
  check('上下文统计接口', ctx.status === 200 && (ctx.body as { messageCount: number }).messageCount >= 2, ctx.body)

  const delThread = await api(`/api/chat/threads/${tid}`, { method: 'DELETE' })
  check('删除会话', delThread.status === 200)
  await api(`/api/notes/${nid}`, { method: 'DELETE' })
}
