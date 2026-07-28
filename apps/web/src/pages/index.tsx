import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { api, type Note } from '../api/client'

const List = styled.div`
  max-width: 800px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Row = styled(Link)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  color: inherit;
  &:hover { border-color: #0969da; }
`

const Badge = styled.span`
  background: #fff8c5;
  border: 1px solid #d4a72c;
  color: #7d4e00;
  border-radius: 10px;
  font-size: 12px;
  padding: 1px 8px;
  margin-left: 8px;
`

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [title, setTitle] = useState('')
  const navigate = useNavigate()

  const load = () => api.listNotes().then(setNotes).catch(console.error)
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
    <List>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ flex: 1 }}
          placeholder="新笔记标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <button className="primary" onClick={create}>新建笔记</button>
      </div>
      {notes.map((n) => (
        <Row key={n.id} to={`/notes/${n.id}`}>
          <span>
            {n.draftTitle || '(无标题)'}
            {n.hasChanges && <Badge>未提交</Badge>}
          </span>
          <span style={{ color: '#57606a', fontSize: 13 }}>
            {new Date(n.updatedAt).toLocaleString('zh-CN')}
          </span>
        </Row>
      ))}
      {notes.length === 0 && <p style={{ color: '#57606a' }}>还没有笔记，创建一篇吧。</p>}
    </List>
  )
}
