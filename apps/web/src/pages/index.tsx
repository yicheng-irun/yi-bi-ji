import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { api, type Note } from '../api/client'
import { Loading } from '../components/Loading'

const Page = styled.div`
  max-width: 760px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 16px;
`

const CreateBar = styled.div`
  display: flex; gap: 10px; align-items: center;
  input { flex: 1; height: 42px; font-size: 15px; }
  button { height: 42px; padding: 0 20px; }
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

const Badge = styled.span`
  font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
  background: var(--orange-bg); color: var(--orange); border: 1px solid #fcd34d;
`

const Empty = styled.div`
  text-align: center; padding: 60px 20px; color: var(--text-secondary);
  .icon { font-size: 48px; margin-bottom: 12px; }
  p { font-size: 15px; }
`

const Count = styled.div`
  font-size: 13px; color: var(--text-secondary); padding: 0 2px;
`

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const navigate = useNavigate()

  const load = () =>
    api.listNotes()
      .then((list) => { setNotes(list); setError('') })
      .catch((e) => { console.error(e); setError('加载失败，请稍后重试') })
      .finally(() => setLoading(false))
  useEffect(() => { void load() }, [])

  useEffect(() => {
    const es = new EventSource('/api/events')
    es.addEventListener('note-created', load)
    es.addEventListener('note-deleted', load)
    es.addEventListener('note-committed', load)
    es.addEventListener('note-updated', load)
    return () => es.close()
  }, [])

  const create = async () => {
    const note = await api.createNote(title.trim() || '未命名')
    setTitle('')
    navigate(`/notes/${note.id}`)
  }

  return (
    <Page>
      <CreateBar>
        <input
          placeholder="新建笔记标题，回车即创建"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button className="btn-primary" onClick={create}>新建笔记</button>
      </CreateBar>

      {loading && <Loading />}
      {error && !loading && <Empty><p>{error}</p></Empty>}

      {!loading && !error && notes.length > 0 && <Count>共 {notes.length} 篇笔记</Count>}

      {!loading && !error && notes.map((n) => (
        <Card key={n.id} to={`/notes/${n.id}`}>
          <span className="icon">{n.hasChanges ? '📄' : '📋'}</span>
          <div className="info">
            <div className="title">{n.draftTitle || '(无标题)'}</div>
            <div className="meta">{new Date(n.updatedAt).toLocaleString('zh-CN')}</div>
          </div>
          <div className="actions">
            {n.hasChanges && <Badge>未提交</Badge>}
          </div>
        </Card>
      ))}

      {!loading && !error && notes.length === 0 && (
        <Empty>
          <div className="icon">📝</div>
          <p>还没有笔记，在上方输入标题并回车创建第一篇</p>
        </Empty>
      )}
    </Page>
  )
}
