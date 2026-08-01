import { api, BASE, check, section } from './helpers.mts'

export async function runEventsTests() {
  section('全局事件 SSE')
  const created = await api('/api/notes', { method: 'POST', body: JSON.stringify({ title: 'SSE 目标', content: 'a\n' }) })
  const noteId = (created.body as { id: number }).id

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

  await api(`/api/notes/${noteId}`, { method: 'DELETE' })
}
