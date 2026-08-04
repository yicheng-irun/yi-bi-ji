import { api, check, section } from './helpers.mts'

interface MemoryDto {
  id: number
  kind: string
  content: string
  status: string
  tags: string[]
  sourceThreadId: string | null
}

export async function runMemoryTests() {
  section('记忆 CRUD / 审核流')

  const created = await api<MemoryDto>('/api/memories', {
    method: 'POST',
    body: JSON.stringify({ content: '用户偏好用简体中文交流', kind: 'preference', tags: ['语言', ' 语言 '] }),
  })
  check('手动创建记忆（直接 confirmed，标签去重）',
    created.status === 201 && created.body.status === 'confirmed'
      && JSON.stringify(created.body.tags) === JSON.stringify(['语言']))
  const memId = created.body.id

  const listed = await api<{ pendingCount: number; memories: MemoryDto[] }>('/api/memories')
  check('列出记忆', listed.status === 200 && listed.body.memories.some((m) => m.id === memId))

  const patched = await api<MemoryDto>(`/api/memories/${memId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content: '用户偏好用简体中文交流，回复保持简洁' }),
  })
  check('编辑记忆内容', patched.status === 200 && patched.body.content.includes('简洁'))

  const searched = await api<{ memories: MemoryDto[] }>(`/api/memories?q=${encodeURIComponent('简体中文')}`)
  check('按关键词过滤', searched.status === 200 && searched.body.memories.some((m) => m.id === memId))

  const archived = await api<MemoryDto>(`/api/memories/${memId}/archive`, { method: 'POST', body: '{}' })
  check('归档记忆', archived.status === 200 && archived.body.status === 'archived')

  const confirmed = await api<MemoryDto>(`/api/memories/${memId}/confirm`, { method: 'POST', body: '{}' })
  check('重新确认记忆', confirmed.status === 200 && confirmed.body.status === 'confirmed')

  const byStatus = await api<{ memories: MemoryDto[] }>('/api/memories?status=pending')
  check('按状态过滤（pending 不含已确认）', byStatus.status === 200 && !byStatus.body.memories.some((m) => m.id === memId))

  const del = await api(`/api/memories/${memId}`, { method: 'DELETE' })
  check('删除记忆', del.status === 200)

  const gone = await api<{ memories: MemoryDto[] }>('/api/memories')
  check('删除后不再出现', !gone.body.memories.some((m) => m.id === memId))

  const notFound = await api(`/api/memories/99999/confirm`, { method: 'POST', body: '{}' })
  check('不存在的记忆返回 404', notFound.status === 404)
}
