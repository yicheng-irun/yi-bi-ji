import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { api, AI_LOG_ACTIONS, type AiChangeLogItem, type AiChangeLogDetail, type Hunk, type Note } from '../api/client'
import { Select, type SelectOption } from '../components/Select'
import { Loading } from '../components/Loading'
import { useDocTitle } from '../hooks/use-doc-title'

const Page = styled.div`
  max-width: 900px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 14px;
`

const Header = styled.div`
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  h2 { font-size: 18px; font-weight: 700; margin: 0; }
  .count { font-size: 12px; color: var(--text-muted); }
  .filters { display: flex; gap: 10px; margin-left: auto; }
  .filters > div { flex: initial; width: 180px; }
  .clear-btn { flex-shrink: 0; color: var(--red); }
`

const Row = styled.div<{ $open: boolean }>`
  border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden;
  background: var(--bg-card);
  ${(p) => p.$open && `border-color: var(--accent); box-shadow: var(--shadow);`}
  .del-btn { opacity: 0; }
  &:hover .del-btn { opacity: 1; }
  ${(p) => p.$open && '.del-btn { opacity: 1; }'}
`

const RowHead = styled.div`
  padding: 10px 14px; cursor: pointer; user-select: none;
  display: flex; align-items: center; gap: 10px;
  &:hover { background: var(--bg-hover); }
`

const ActionBadge = styled.span<{ $action: string }>`
  flex-shrink: 0;
  font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px;
  color: ${(p) => (p.$action === 'delete_note' ? 'var(--red)' : p.$action === 'create_note' ? 'var(--green)' : 'var(--accent)')};
  background: ${(p) => (p.$action === 'delete_note' ? '#fef2f2' : p.$action === 'create_note' ? 'var(--green-bg)' : 'var(--accent-light)')};
`

const Summary = styled.div`
  flex: 1; min-width: 0;
  font-size: 13px; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  .note { color: var(--accent); }
  .spacer { color: var(--text-muted); margin: 0 6px; }
`

const Meta = styled.div<{ $open: boolean }>`
  flex-shrink: 0; font-size: 11px; color: var(--text-muted);
  display: flex; align-items: center; gap: 8px;
  .chars { font-family: var(--font-mono); }
  .caret { font-size: 9px; transition: transform .15s; }
  ${(p) => (p.$open ? '.caret { transform: rotate(90deg); }' : '')}
`

const DelBtn = styled.button`
  flex-shrink: 0; border: none; background: transparent; padding: 2px 6px;
  font-size: 14px; line-height: 1; color: var(--text-muted); border-radius: 4px;
  transition: opacity .15s, color .15s, background .15s;
  &:hover { color: var(--red); background: #fef2f2; }
`

const DiffBox = styled.div`
  border-top: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 10px; padding: 12px 14px;
  background: var(--bg-hover);
`

const HunkBox = styled.div`
  border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden;
  background: var(--bg-card);
`

const HunkHeader = styled.div`
  display: flex; align-items: center; gap: 10px;
  background: #f9fafb; padding: 6px 12px; border-bottom: 1px solid var(--border);
  font-size: 12px; color: var(--text-secondary); font-family: var(--font-mono);
`

const LineRow = styled.div<{ $kind: string }>`
  font-family: var(--font-mono); font-size: 12.5px; line-height: 1.5;
  padding: 1px 12px; white-space: pre-wrap; word-break: break-all;
  background: ${(p) => (p.$kind === '+' ? 'var(--green-bg)' : p.$kind === '-' ? '#fef2f2' : 'transparent')};
  color: ${(p) => (p.$kind === '+' ? 'var(--green)' : p.$kind === '-' ? 'var(--red)' : 'var(--text)')};
`

const Empty = styled.div`
  text-align: center; color: var(--text-muted); font-size: 13px;
  padding: 40px 0;
`

export default function AiLogsPage() {
  useDocTitle('AI 记录')

  const [notes, setNotes] = useState<Note[]>([])
  const [noteId, setNoteId] = useState('')
  const [action, setAction] = useState('')
  const [logs, setLogs] = useState<AiChangeLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Record<number, AiChangeLogDetail>>({})
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    api.listNotes().then((n) => setNotes(n)).catch(console.error)
  }, [])

  const load = useCallback(async (offset: number, reset: boolean) => {
    const res = await api.listAiChangeLogs({
      noteId: noteId ? Number(noteId) : undefined,
      action: action || undefined,
      limit: 30,
      offset,
    })
    setTotal(res.total)
    setLogs((prev) => (reset ? res.logs : [...prev, ...res.logs]))
  }, [noteId, action])

  useEffect(() => {
    setLoading(true)
    load(0, true)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [load])

  const toggle = async (id: number) => {
    if (!detail[id]) {
      try {
        const d = await api.getAiChangeLog(id)
        setDetail((m) => ({ ...m, [id]: d }))
      } catch (e) {
        console.error(e)
        return
      }
    }
    setExpanded((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const removeLog = async (id: number) => {
    if (!confirm('确定删除这条修改记录？')) return
    await api.deleteAiChangeLog(id)
    setLogs((prev) => prev.filter((l) => l.id !== id))
    setTotal((t) => Math.max(0, t - 1))
    setDetail((m) => { const n = { ...m }; delete n[id]; return n })
    setExpanded((s) => { const n = new Set(s); n.delete(id); return n })
  }

  const clearLogs = async () => {
    const scope = noteId || action ? '当前筛选条件下的记录' : '全部修改记录'
    if (!confirm(`确定清空${scope}？此操作不可恢复。`)) return
    const res = await api.clearAiChangeLogs({
      noteId: noteId ? Number(noteId) : undefined,
      action: action || undefined,
    })
    setLogs([])
    setTotal(0)
    setDetail({})
    setExpanded(new Set())
    if (res.deleted > 0) alert(`已清空 ${res.deleted} 条记录`)
  }

  const noteOptions: SelectOption[] = [
    { value: '', label: '全部笔记' },
    ...notes.map((n) => ({ value: String(n.id), label: `#${n.id} ${n.draftTitle || '(无标题)'}` })),
  ]
  const actionOptions: SelectOption[] = [
    { value: '', label: '全部动作' },
    ...Object.entries(AI_LOG_ACTIONS).map(([v, l]) => ({ value: v, label: l })),
  ]

  const renderDiff = (d: AiChangeLogDetail) => {
    const hunks = d.hunks.filter((h: Hunk) => h.lines.some((l) => l[0] === '+' || l[0] === '-'))
    if (hunks.length === 0) {
      return <Empty>内容无差异（仅元数据变更）。</Empty>
    }
    return hunks.map((h, i) => (
      <HunkBox key={i}>
        <HunkHeader>@@ -{h.oldStart},{h.oldLines} +{h.newStart},{h.newLines} @@</HunkHeader>
        {h.lines.filter((l) => l[0] !== '\\').map((l, j) => (
          <LineRow key={j} $kind={l[0]}>{l}</LineRow>
        ))}
      </HunkBox>
    ))
  }

  return (
    <Page>
      <Header>
        <h2>AI 修改记录</h2>
        {!loading && <span className="count">共 {total} 条</span>}
        <div className="filters">
          <Select value={noteId} onChange={setNoteId} options={noteOptions} />
          <Select value={action} onChange={setAction} options={actionOptions} />
        </div>
        <button className="clear-btn" onClick={() => void clearLogs()}>清空</button>
      </Header>

      {loading && <Loading />}

      {!loading && logs.map((log) => {
        const d = detail[log.id]
        return (
          <Row key={log.id} $open={expanded.has(log.id)}>
            <RowHead onClick={() => void toggle(log.id)}>
              <ActionBadge $action={log.action}>{AI_LOG_ACTIONS[log.action] ?? log.action}</ActionBadge>
              <Summary>
                {log.noteId != null && log.noteTitle
                  ? <Link to={`/notes/${log.noteId}`} onClick={(e) => e.stopPropagation()}>{log.noteTitle}</Link>
                  : <span className="note">(笔记已删除)</span>}
                <span className="spacer">·</span>
                {log.summary}
              </Summary>
              <Meta $open={expanded.has(log.id)}>
                <span className="chars">{log.beforeChars}→{log.afterChars}</span>
                <span>{new Date(log.createdAt).toLocaleString('zh-CN')}</span>
                <DelBtn
                  className="del-btn"
                  title="删除此记录"
                  onClick={(e) => { e.stopPropagation(); void removeLog(log.id) }}
                >🗑</DelBtn>
                <span className="caret">▸</span>
              </Meta>
            </RowHead>
            {expanded.has(log.id) && d && (
              <DiffBox>{renderDiff(d)}</DiffBox>
            )}
          </Row>
        )
      })}

      {!loading && logs.length === 0 && <Empty>暂无 AI 修改记录。</Empty>}

      {!loading && logs.length > 0 && logs.length < total && (
        <button onClick={() => load(logs.length, false)}>加载更多（{logs.length}/{total}）</button>
      )}
    </Page>
  )
}
