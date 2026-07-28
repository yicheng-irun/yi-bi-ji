import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { api, type ChangeItem } from '../../api/client'

const Page = styled.div`
  max-width: 760px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 16px;
`

const Header = styled.div`
  display: flex; align-items: center; gap: 12px;
  h2 { font-size: 18px; font-weight: 700; }
  .count { color: var(--text-secondary); font-size: 13px; }
  .spacer { flex: 1; }
`

const Card = styled(Link)`
  display: flex; align-items: center; gap: 14px;
  padding: 14px 18px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  color: inherit; box-shadow: var(--shadow-sm);
  transition: box-shadow .15s, border-color .15s;

  &:hover { box-shadow: var(--shadow); border-color: var(--accent); }

  .indicator {
    width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
    background: var(--orange-bg); color: var(--orange);
    display: flex; align-items: center; justify-content: center; font-size: 16px;
  }
  .info { flex: 1; min-width: 0; }
  .title { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
`

const Empty = styled.div`
  text-align: center; padding: 60px 20px; color: var(--text-secondary);
  .icon { font-size: 40px; margin-bottom: 8px; }
  p { font-size: 15px; }
`

export default function ChangesPage() {
  const [changes, setChanges] = useState<ChangeItem[]>([])
  const navigate = useNavigate()

  useEffect(() => { void (() => api.listChanges().then(setChanges).catch(console.error))() }, [])

  const commitAll = async () => {
    if (!confirm(`确定提交全部 ${changes.length} 篇笔记的变更？落库后不可还原。`)) return
    await api.commitAll()
    navigate('/')
  }

  return (
    <Page>
      <Header>
        <h2>未提交的变更</h2>
        <span className="count">{changes.length} 篇</span>
        <div className="spacer" />
        {changes.length > 0 && <button className="btn-green" onClick={commitAll}>全部提交</button>}
      </Header>

      {changes.map((c) => (
        <Card key={c.id} to={`/changes/${c.id}`}>
          <div className="indicator">△</div>
          <div className="info">
            <div className="title">{c.draftTitle || '(无标题)'}</div>
            <div className="sub">
              {c.draftTitle !== c.committedTitle && c.committedTitle
                ? `标题已改：${c.committedTitle} → ${c.draftTitle}`
                : `${new Date(c.updatedAt).toLocaleString('zh-CN')}`}
            </div>
          </div>
        </Card>
      ))}

      {changes.length === 0 && (
        <Empty>
          <div className="icon">✔</div>
          <p>所有笔记均已提交，没有待处理的变更</p>
        </Empty>
      )}
    </Page>
  )
}
