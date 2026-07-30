import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { api, type ChangeItem } from '../../api/client'
import { Loading } from '../../components/Loading'
import { useDocTitle } from '../../hooks/use-doc-title'

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
  .indicator.del { background: #fef2f2; color: var(--red); }
  .del-badge {
    font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px;
    background: #fef2f2; color: var(--red); border: 1px solid #fecaca; flex-shrink: 0;
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useDocTitle('变更')

  useEffect(() => {
    api.listChanges()
      .then(setChanges)
      .catch((e) => { console.error(e); setError('加载失败，请稍后重试') })
      .finally(() => setLoading(false))
  }, [])

  const commitAll = async () => {
    const delCount = changes.filter((c) => c.deletedAt).length
    const delHint = delCount > 0 ? `其中 ${delCount} 篇将被永久删除。` : ''
    if (!confirm(`确定提交全部 ${changes.length} 篇笔记的变更？${delHint}落库后不可还原。`)) return
    await api.commitAll()
    navigate('/')
  }

  return (
    <Page>
      <Header>
        <h2>未提交的变更</h2>
        {!loading && <span className="count">{changes.length} 篇</span>}
        <div className="spacer" />
        {!loading && changes.length > 0 && <button className="btn-green" onClick={commitAll}>全部提交</button>}
      </Header>

      {loading && <Loading />}
      {error && !loading && <Empty><p>{error}</p></Empty>}

      {!loading && !error && changes.map((c) => (
        <Card key={c.id} to={`/changes/${c.id}`}>
          <div className={c.deletedAt ? 'indicator del' : 'indicator'}>{c.deletedAt ? '🗑' : '△'}</div>
          <div className="info">
            <div className="title" style={c.deletedAt ? { textDecoration: 'line-through', color: 'var(--text-secondary)' } : undefined}>
              {c.draftTitle || '(无标题)'}
            </div>
            <div className="sub">
              {c.deletedAt
                ? `标记删除于 ${new Date(c.deletedAt).toLocaleString('zh-CN')}`
                : c.draftTitle !== c.committedTitle && c.committedTitle
                  ? `标题已改：${c.committedTitle} → ${c.draftTitle}`
                  : `${new Date(c.updatedAt).toLocaleString('zh-CN')}`}
            </div>
          </div>
          {c.deletedAt && <span className="del-badge">待确认删除</span>}
        </Card>
      ))}

      {!loading && !error && changes.length === 0 && (
        <Empty>
          <div className="icon">✔</div>
          <p>所有笔记均已提交，没有待处理的变更</p>
        </Empty>
      )}
    </Page>
  )
}
