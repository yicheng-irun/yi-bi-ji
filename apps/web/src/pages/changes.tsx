import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { api, type ChangeItem } from '../api/client'

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
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  color: inherit;
  &:hover { border-color: #0969da; }
`

export default function ChangesPage() {
  const [changes, setChanges] = useState<ChangeItem[]>([])
  const navigate = useNavigate()

  const load = () => api.listChanges().then(setChanges).catch(console.error)
  useEffect(() => { void load() }, [])

  const commitAll = async () => {
    if (!confirm(`确定提交全部 ${changes.length} 篇笔记的变更？落库后不可还原。`)) return
    await api.commitAll()
    navigate('/')
  }

  return (
    <List>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>未提交的变更（{changes.length}）</h3>
        {changes.length > 0 && (
          <button className="primary" onClick={commitAll}>全部提交落库</button>
        )}
      </div>
      {changes.map((c) => (
        <Row key={c.id} to={`/changes/${c.id}`}>
          <span>
            {c.draftTitle || '(无标题)'}
            {c.draftTitle !== c.committedTitle && c.committedTitle && (
              <span style={{ color: '#57606a', fontSize: 13 }}>（原名：{c.committedTitle}）</span>
            )}
          </span>
          <span style={{ color: '#57606a', fontSize: 13 }}>
            {new Date(c.updatedAt).toLocaleString('zh-CN')}
          </span>
        </Row>
      ))}
      {changes.length === 0 && <p style={{ color: '#57606a' }}>没有待提交的变更。</p>}
    </List>
  )
}
