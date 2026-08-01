import { api, check, section } from './helpers.mts'

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

export async function runDiffTests() {
  section('diff / 部分提交 / 全部提交')
  const created = await api('/api/notes', { method: 'POST', body: JSON.stringify({ title: 'diff 目标', content: 'a\nb\nc\n' }) })
  const noteId = (created.body as { id: number }).id

  await api(`/api/notes/${noteId}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ draftContent: 'a\nb改\nc\nd新增\n', baseContentVersion: 1, baseTitleVersion: 1 }),
  })

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
  const afterCommit = await api(`/api/notes/${noteId}`)
  check('提交后无变更', (afterCommit.body as { hasChanges: boolean }).hasChanges === false)

  await api(`/api/notes/${noteId}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ draftContent: 'v2 内容\n', baseContentVersion: (commit.body as { draftContentVersion: number }).draftContentVersion, baseTitleVersion: 1 }),
  })
  const commitAll = await api('/api/changes/commit-all', { method: 'POST', body: '{}' })
  const afterAll = await api(`/api/notes/${noteId}`)
  check('全部提交', commitAll.status === 200 && (afterAll.body as { hasChanges: boolean }).hasChanges === false)

  await api(`/api/notes/${noteId}`, { method: 'DELETE' })
}
