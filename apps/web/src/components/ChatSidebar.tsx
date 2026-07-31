import { useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { api, type Thread } from '../api/client'
import { ChatPanel } from './ChatPanel'

const DEFAULT_WIDTH = 600
const MIN_WIDTH = 320
const MAX_WIDTH = 800

const Container = styled.div`
  flex-shrink: 0; height: 100%; position: relative;
`

const Pane = styled.aside`
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm);
`

const ResizeHandle = styled.div`
  /* 向左移动半个间隙(20/2=10px)，使中心线落在笔记与聊天之间的空白处正中 */
  position: absolute; left: -10px; top: 0; bottom: 0; width: 12px;
  transform: translateX(-50%);
  cursor: col-resize; z-index: 3;
  display: flex; align-items: center; justify-content: center;
  &::before {
    content: ''; position: absolute; top: 0; bottom: 0; left: 50%;
    width: 2px; transform: translateX(-50%);
    background: transparent; transition: background .15s;
  }
  &:hover::before { background: var(--accent); }
  .grip {
    opacity: 0; transition: opacity .15s; pointer-events: none;
    color: var(--accent); font-size: 14px; line-height: 1;
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: 4px; padding: 6px 1px;
  }
  &:hover .grip { opacity: 1; }
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
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)
  // 记录每个「笔记+范围」上下文是否已自动选中过最近会话，避免反复覆盖用户的手动选择
  const autoSelected = useRef<Set<string>>(new Set())
  const ctxKey = useRef<string | null>(null)

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startW: width }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startW + (dragRef.current.startX - ev.clientX)))
      setWidth(next)
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    api.listThreads().then((res) => setThreads(res.threads)).catch(console.error)
  }, [])

  // 打开笔记（或切换笔记/切换范围）时，自动选中最近的一条会话，而非新会话
  useEffect(() => {
    const key = `${scope}:${currentNoteId ?? 'none'}`
    if (ctxKey.current !== key) {
      ctxKey.current = key
      autoSelected.current.delete(key)
      setThreadId('') // 上下文变化时先清空，避免残留上一个笔记的会话
    }
    if (autoSelected.current.has(key)) return
    const latest =
      scope === 'note' && currentNoteId !== undefined
        ? threads.find((t) => t.metadata?.originNoteId === currentNoteId)
        : threads[0]
    if (latest) {
      setThreadId(latest.id)
      autoSelected.current.add(key)
    }
  }, [threads, currentNoteId, scope])

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
    <Container style={{ width }}>
      <ResizeHandle onMouseDown={onResizeStart} title="拖动调整宽度">
        <span className="grip">⋮</span>
      </ResizeHandle>
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
          {threadId && (
            <button
              title="删除当前会话"
              style={{ color: 'var(--red)', fontSize: 16, padding: '0 10px' }}
              onClick={async () => {
                const t = threads.find((x) => x.id === threadId)
                if (!confirm(`确定删除会话「${t?.title || '对话'}」？消息记录将一并删除。`)) return
                await api.deleteThread(threadId)
                setThreads((ts) => ts.filter((x) => x.id !== threadId))
                setThreadId('')
              }}
            >🗑</button>
          )}
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
    </Container>
  )
}
