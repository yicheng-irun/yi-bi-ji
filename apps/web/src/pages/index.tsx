import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { api, type Note, type SearchResultItem } from '../api/client'
import { createEventStream } from '../lib/events'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { Empty } from '../ui/Empty'
import { Loading } from '../ui/Loading'
import { SiteTitle } from '../ui/SiteTitle'

const Page = styled.div`
  max-width: 760px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 16px;
`

const CreateBar = styled.div`
  display: flex; gap: 10px; align-items: center;
  .grow { flex: 1; min-width: 0; }
`

const Snippet = styled.div`
  font-size: 12px; color: var(--text-secondary); margin-top: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`

const Card = styled(Link)`
  display: flex; align-items: center; gap: 14px;
  padding: 14px 18px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  color: inherit; box-shadow: var(--shadow-sm);
  transition: box-shadow .15s, border-color .15s;

  &:hover {
    box-shadow: var(--shadow); border-color: var(--accent);
  }

  .icon { font-size: 22px; flex-shrink: 0; }
  .info { flex: 1; min-width: 0; }
  .title { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
  .actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
`

const Count = styled.div`
  font-size: 13px; color: var(--text-secondary); padding: 0 2px;
`

const ChipRow = styled.div`
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
`

const Chip = styled.button<{ $on: boolean }>`
  height: 28px; padding: 0 12px; font-size: 12px; border-radius: 14px;
  background: ${(p) => (p.$on ? 'var(--accent-light)' : 'var(--bg-card)')};
  border-color: ${(p) => (p.$on ? 'var(--accent)' : 'var(--border)')};
  color: ${(p) => (p.$on ? 'var(--accent)' : 'var(--text-secondary)')};
  font-weight: ${(p) => (p.$on ? 600 : 400)};
  .n { opacity: .6; margin-left: 4px; }
`

const Tag = styled.span`
  font-size: 11px; color: var(--text-muted); background: var(--bg-hover);
  border-radius: 4px; padding: 1px 6px;
`

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [tag, setTag] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[] | null>(null)
  const [searchTotal, setSearchTotal] = useState(0)
  const navigate = useNavigate()

  const UNTAGGED = '__untagged__'

  const tags = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of notes) for (const t of n.tags) m.set(t, (m.get(t) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [notes])

  const untaggedCount = useMemo(() => notes.filter((n) => n.tags.length === 0).length, [notes])

  const visible = useMemo(
    () => notes.filter((n) => !tag || (tag === UNTAGGED ? n.tags.length === 0 : n.tags.includes(tag))),
    [notes, tag],
  )

  const load = () =>
    api.listNotes()
      .then((list) => { setNotes(list); setError('') })
      .catch((e) => { console.error(e); setError('加载失败，请稍后重试') })
      .finally(() => setLoading(false))
  useEffect(() => { void load() }, [])

  // 搜索结果随输入和底层笔记变化（防抖 300ms）
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults(null); return }
    let cancelled = false
    const t = setTimeout(() => {
      api.searchNotes(q)
        .then((r) => { if (!cancelled) { setResults(r.notes); setSearchTotal(r.total) } })
        .catch(() => {})
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query, notes])

  // SSE 增量更新：事件只带 noteId，按需单条拉取并插入到最新位置（列表按 updatedAt 倒序）
  const upsert = useCallback((n: Note) => {
    setNotes((cur) => [n, ...cur.filter((x) => x.id !== n.id)])
  }, [])

  useEffect(() => {
    const fetchOne = (e: MessageEvent) => {
      const evt = JSON.parse(e.data) as { noteId: number }
      api.getNote(evt.noteId).then(upsert).catch(() => {})
    }
    const onDeleted = (e: MessageEvent) => {
      const evt = JSON.parse(e.data) as { noteId: number }
      setNotes((cur) => cur.filter((x) => x.id !== evt.noteId))
    }
    return createEventStream({
      'note-created': fetchOne,
      'note-updated': fetchOne,
      'note-committed': fetchOne,
      'note-deleted': onDeleted,
    })
  }, [upsert])

  const create = async () => {
    const note = await api.createNote(title.trim() || '未命名')
    setTitle('')
    navigate(`/notes/${note.id}`)
  }

  return (
    <Page>
      <SiteTitle title="笔记" />
      <CreateBar>
        <Input
          size="lg"
          className="grow"
          placeholder="新建笔记标题，回车即创建"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <Button size="lg" variant="primary" onClick={create}>新建笔记</Button>
      </CreateBar>

      <Input
        placeholder="搜索标题或正文…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
      />

      {loading && <Loading />}
      {error && !loading && <Empty title={error} />}

      {!loading && !error && results !== null && (
        <>
          <Count>搜索到 {searchTotal} 篇笔记{searchTotal > results.length ? `（显示前 ${results.length} 篇）` : ''}</Count>
          {results.map((r) => (
            <Card key={r.id} to={r.deletedAt ? `/changes/${r.id}` : `/notes/${r.id}`}>
              <span className="icon">{r.deletedAt ? '🗑' : r.hasChanges ? '📄' : '📋'}</span>
              <div className="info">
                <div className="title" style={r.deletedAt ? { textDecoration: 'line-through', color: 'var(--text-secondary)' } : undefined}>
                  {r.title || '(无标题)'}
                </div>
                <div className="meta">
                  #{r.id}{' · '}{new Date(r.updatedAt).toLocaleString('zh-CN')}
                </div>
                {r.snippet && <Snippet>{r.snippet}</Snippet>}
              </div>
              <div className="actions">
                {r.deletedAt
                  ? <Badge variant="danger">待确认删除</Badge>
                  : r.hasChanges && <Badge variant="warning">未提交</Badge>}
              </div>
            </Card>
          ))}
          {results.length === 0 && <Empty title={`没有匹配「${query.trim()}」的笔记`} />}
        </>
      )}

      {!loading && !error && results === null && notes.length > 0 && (
        <ChipRow>
          <Chip $on={!tag} onClick={() => setTag('')}>
            全部<span className="n">{notes.length}</span>
          </Chip>
          {tags.map(([t, n]) => (
            <Chip key={t} $on={tag === t} onClick={() => setTag(tag === t ? '' : t)}>
              #{t}<span className="n">{n}</span>
            </Chip>
          ))}
          {untaggedCount > 0 && (
            <Chip $on={tag === UNTAGGED} onClick={() => setTag(tag === UNTAGGED ? '' : UNTAGGED)}>
              无标签<span className="n">{untaggedCount}</span>
            </Chip>
          )}
        </ChipRow>
      )}

      {!loading && !error && results === null && visible.length > 0 && <Count>共 {visible.length} 篇笔记</Count>}

      {!loading && !error && results === null && visible.map((n) => (
        <Card key={n.id} to={n.deletedAt ? `/changes/${n.id}` : `/notes/${n.id}`}>
          <span className="icon">{n.deletedAt ? '🗑' : n.hasChanges ? '📄' : '📋'}</span>
          <div className="info">
            <div className="title" style={n.deletedAt ? { textDecoration: 'line-through', color: 'var(--text-secondary)' } : undefined}>
              {n.draftTitle || '(无标题)'}
            </div>
            <div className="meta">
              #{n.id}
              {' · '}
              {new Date(n.updatedAt).toLocaleString('zh-CN')}
              {n.tags.length > 0 && (
                <span style={{ marginLeft: 8, display: 'inline-flex', gap: 4 }}>
                  {n.tags.map((t) => <Tag key={t}>#{t}</Tag>)}
                </span>
              )}
            </div>
          </div>
          <div className="actions">
            {n.deletedAt
              ? <Badge variant="danger">待确认删除</Badge>
              : n.hasChanges && <Badge variant="warning">未提交</Badge>}
          </div>
        </Card>
      ))}

      {!loading && !error && results === null && notes.length === 0 && (
        <Empty icon="📝" title="还没有笔记，在上方输入标题并回车创建第一篇" />
      )}
      {!loading && !error && results === null && notes.length > 0 && visible.length === 0 && (
        <Empty title="当前过滤条件下没有笔记" />
      )}
    </Page>
  )
}
