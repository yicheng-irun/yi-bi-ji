import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { api, type Thread } from '../api/client'
import { ChatPanel } from '../components/ChatPanel'
import { Loading } from '../components/Loading'

const Wrap = styled.div`
  max-width: 1100px; margin: 0 auto;
  display: flex; gap: 20px; height: 100%;
`

const ThreadList = styled.div`
  width: 260px; flex-shrink: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 4px;

  button { height: 36px; margin-bottom: 4px; }
`

const ThreadItem = styled.div<{ $active: boolean }>`
  padding: 12px 14px; border-radius: var(--radius); cursor: pointer;
  background: ${(p) => (p.$active ? 'var(--accent-light)' : 'transparent')};
  border: 1px solid ${(p) => (p.$active ? 'var(--accent)' : 'transparent')};
  transition: all .15s;

  &:hover { background: ${(p) => (p.$active ? 'var(--accent-light)' : 'var(--bg-hover)')}; }

  .t-title { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
  .t-head { display: flex; align-items: center; gap: 6px; }
  .t-sub { font-size: 11px; color: var(--text-muted); margin-top: 3px; display: flex; gap: 6px; align-items: center; }
  .t-origin {
    background: var(--orange-bg); color: var(--orange);
    border-radius: 4px; padding: 0 5px; font-size: 10px;
  }
  .t-del {
    border: none; background: transparent; padding: 4px 8px; font-size: 16px;
    color: var(--text-muted); opacity: 0; transition: opacity .15s; flex-shrink: 0;
    border-radius: var(--radius); cursor: pointer;
    &:hover { color: var(--red); background: var(--bg-hover); }
  }
  &:hover .t-del { opacity: 1; }
`

const ChatArea = styled.div`
  flex: 1; min-width: 0; display: flex; flex-direction: column;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);
`

const ChatHeader = styled.div`
  padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--bg-hover);
  font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 10px;
  .origin { font-size: 12px; font-weight: 400; color: var(--text-secondary); }
`

export default function ConversationsPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    api.listThreads().then((res) => {
      const list = Array.isArray(res) ? res : res.threads ?? []
      setThreads(list)
      if (list.length > 0) setActiveId(list[0].id)
    }).catch((e) => {
      console.error(e)
      setError('加载失败，请稍后重试')
    }).finally(() => setLoading(false))
  }, [])

  const active = threads.find((t) => t.id === activeId)
  const originNoteId = active?.metadata?.originNoteId

  const removeThread = async (t: Thread) => {
    if (!confirm(`确定删除会话「${t.title || '对话'}」？消息记录将一并删除。`)) return
    await api.deleteThread(t.id)
    setThreads((ts) => {
      const next = ts.filter((x) => x.id !== t.id)
      if (activeId === t.id) setActiveId(next[0]?.id ?? '')
      return next
    })
  }

  return (
    <Wrap>
      <ThreadList>
        <button onClick={() => setActiveId('')}>+ 新建全局对话</button>

        {loading && <Loading />}
        {error && !loading && <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 8 }}>{error}</p>}
        {!loading && !error && threads.map((t) => (
          <ThreadItem key={t.id} $active={t.id === activeId} onClick={() => setActiveId(t.id)}>
            <div className="t-head">
              <div className="t-title">{t.title || '对话'}</div>
              <button
                className="t-del"
                title="删除会话"
                onClick={(e) => { e.stopPropagation(); void removeThread(t) }}
              >🗑</button>
            </div>
            <div className="t-sub">
              {t.metadata?.originNoteId
                ? <span className="t-origin">笔记 #{t.metadata.originNoteId}</span>
                : <span className="t-origin" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>全局</span>}
              <span>{new Date(t.updatedAt).toLocaleString('zh-CN')}</span>
            </div>
          </ThreadItem>
        ))}
        {!loading && !error && threads.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 8 }}>暂无会话</p>}
      </ThreadList>

      <ChatArea>
        <ChatHeader>
          {active ? (active.title || '对话') : '新对话'}
          {originNoteId && (
            <span className="origin">
              关联 <Link to={`/notes/${originNoteId}`}>笔记 #{originNoteId}</Link>
            </span>
          )}
        </ChatHeader>
        <ChatPanel
          key={activeId || 'new'}
          threadId={activeId}
          onThreadCreated={(t) => {
            setThreads((ts) => [t, ...ts])
            setActiveId(t.id)
          }}
        />
      </ChatArea>
    </Wrap>
  )
}
