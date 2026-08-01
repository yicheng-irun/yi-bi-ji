import { api, check, section } from './helpers.mts'

export async function runNotesTests() {
  section('笔记 CRUD / 草稿 / 冲突')
  const created = await api('/api/notes', { method: 'POST', body: JSON.stringify({ title: '冒烟', content: 'a\nb\nc\n' }) })
  check('创建笔记', created.status === 201)
  const noteId = (created.body as { id: number }).id

  const get = await api<{ draftTitle: string }>(`/api/notes/${noteId}`)
  check('读取笔记', get.status === 200 && get.body.draftTitle === '冒烟')

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

  section('标签')
  const meta = await api(`/api/notes/${noteId}/meta`, {
    method: 'PATCH',
    body: JSON.stringify({ tags: ['学习', ' 决策 ', '学习'] }),
  })
  check('设置标签(去重去空格)', meta.status === 200
    && JSON.stringify((meta.body as { tags: string[] }).tags) === JSON.stringify(['学习', '决策']))
  const metaBack = await api(`/api/notes/${noteId}`)
  check('标签持久化', JSON.stringify((metaBack.body as { tags: string[] }).tags) === JSON.stringify(['学习', '决策']))

  const del = await api(`/api/notes/${noteId}`, { method: 'DELETE' })
  check('删除笔记', del.status === 200)
}
