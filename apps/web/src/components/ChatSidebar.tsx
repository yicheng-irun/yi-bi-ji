import { useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { api, type Thread } from '../api/client'
import { ChatPanel } from './ChatPanel'

const Pane = styled.aside`
  width: 400px; flex-shrink: 0; height: 100%;
  display: flex; flex-direction: column;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);
`

const Header = styled.div`
  display: flex; gap: 8px; padding: 10px 12px;
  border-bottom: 1px solid var(--border); background: var(--bg-hover); align-items: center;

  select {
    flex: 1; height: 34px; font-size: 13px; background: var(--bg-card);
    border-radius: var(--radius); cursor: pointer; min-width: 0;
  }
  button { height: 34px; padding: 0 14px; font-size: 12px; flex-shrink: 0; }
`

const FilterToggle = styled.div`
  display: flex; border: 1px solid var(--border); border-radius: var(--radius);
  overflow: hidden; flex-shrink: 0;

  button {
    height: 26px; padding: 0 8px; font-size: 11px; border: none; border-radius: 0;
    background: transparent; color: var(--text-secondary);
    &.on { background: var(--accent-light); color: var(--accent); font-weight: 600; }
  }
`

export function ChatSidebar({ currentNoteId }: { currentNoteId?: number }) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [threadId, setThreadId] = useState('')
  const [scope, setScope] = useState<'note' | 'all'>(currentNoteId ? 'note' : 'all')

  useEffect(() => {
    api.listThreads().then((res) => {
      const list = Array.isArray(res) ? res : res.threads ?? []
      setThreads(list)
    }).catch(console.error)
  }, [])

  const visible = useMemo(
    () => (scope === 'note' && currentNoteId
      ? threads.filter((t) => t.metadata?.originNoteId === currentNoteId)
      : threads),
    [threads, scope, currentNoteId],
  )

  const threadLabel = (t: Thread) => {
    const origin = t.metadata?.originNoteId
    return (scope === 'all' && origin ? `#${origin} ` : '') + (t.title || t.id)
  }

  return (
    <Pane>
      <Header>
        <select value={threadId} onChange={(e) => setThreadId(e.target.value)}>
          <option value="">新对话</option>
          {visible.map((t) => (
            <option key={t.id} value={t.id}>{threadLabel(t)}</option>
          ))}
        </select>
        {currentNoteId !== undefined && (
          <FilterToggle>
            <button className={scope === 'note' ? 'on' : ''} onClick={() => { setScope('note'); setThreadId('') }}>本笔记</button>
            <button className={scope === 'all' ? 'on' : ''} onClick={() => { setScope('all'); setThreadId('') }}>全部</button>
          </FilterToggle>
        )}
        <button onClick={() => setThreadId('')}>+</button>
      </Header>
      <ChatPanel
        threadId={threadId}
        currentNoteId={currentNoteId}
        onThreadCreated={(t) => {
          setThreads((ts) => [t, ...ts])
          setThreadId(t.id)
        }}
      />
    </Pane>
  )
}
