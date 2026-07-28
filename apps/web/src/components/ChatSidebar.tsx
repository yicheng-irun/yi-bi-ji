import { useEffect, useRef, useState } from 'react'
import styled, { keyframes } from 'styled-components'
import { api, streamChat, type Thread } from '../api/client'

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
    border-radius: var(--radius); cursor: pointer;
  }
  button { height: 34px; padding: 0 14px; font-size: 12px; }
`

const Messages = styled.div`
  flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 14px;
`

const Avatar = styled.div<{ $role: string }>`
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
  background: ${(p) => (p.$role === 'user' ? 'var(--accent-light)' : '#f3f4f6')};
  color: ${(p) => (p.$role === 'user' ? 'var(--accent)' : 'var(--text-secondary)')};
`

const MessageGroup = styled.div<{ $role: string }>`
  display: flex; gap: 8px; align-items: flex-start;
  flex-direction: ${(p) => (p.$role === 'user' ? 'row-reverse' : 'row')};
  max-width: 100%;
`

const Bubble = styled.div<{ $role: string }>`
  background: ${(p) => (p.$role === 'user' ? 'var(--accent-light)' : '#f9fafb')};
  border-radius: ${(p) =>
    p.$role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px'};
  padding: 10px 14px; font-size: 14px; line-height: 1.55;
  white-space: pre-wrap; word-break: break-word; max-width: calc(100% - 50px);
  color: var(--text);
`

const ToolRow = styled.div`
  display: flex; align-items: center; gap: 6px; padding: 4px 0;
  font-size: 12px; color: var(--text-secondary);

  .chip {
    display: flex; align-items: center; gap: 5px;
    background: #f3f4f6; border: 1px solid var(--border);
    border-radius: 6px; padding: 4px 10px;
  }
  .chip .icon { font-size: 13px; }
`

const blink = keyframes`
  0%,100% { opacity: 1; }
  50% { opacity: .3; }
`

const Thinking = styled.div`
  display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted);
  padding: 2px 0;
  .dots span {
    display: inline-block; width: 5px; height: 5px; border-radius: 50%;
    background: var(--text-muted); margin-right: 3px; animation: ${blink} 1.4s ease infinite;
  }
  .dots span:nth-child(2) { animation-delay: .2s; }
  .dots span:nth-child(3) { animation-delay: .4s; }
`

const InputRow = styled.div`
  display: flex; gap: 8px; padding: 10px 12px;
  border-top: 1px solid var(--border); background: var(--bg-hover);
  textarea {
    flex: 1; height: 44px; resize: none; font-size: 14px; border-radius: var(--radius-lg);
    padding: 10px 14px;
  }
  button {
    width: 44px; height: 44px; border-radius: 50%; padding: 0;
    display: flex; align-items: center; justify-content: center; font-size: 18px;
    flex-shrink: 0;
  }
`

interface DisplayItem {
  role: string
  text: string
  tools: string[]
}

const toolNames: Record<string, string> = {
  list_notes: '列笔记', search_notes: '搜索', read_note: '读取',
  create_note: '新建', write_note: '全量写', replace_in_note: '替换',
  insert_block: '插入',
}

const roleAvatars: Record<string, string> = { user: '我', assistant: 'AI' }

export function ChatSidebar({ currentNoteId }: { currentNoteId?: number }) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [threadId, setThreadId] = useState('')
  const [items, setItems] = useState<DisplayItem[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)

  useEffect(() => {
    api.listThreads().then((res) => {
      const list = Array.isArray(res) ? res : res.threads ?? []
      setThreads(list)
      if (list.length > 0) setThreadId(list[0].id)
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (!threadId) { setItems([]); return }
    if (sendingRef.current) return
    api.getMessages(threadId).then((res) => {
      if (sendingRef.current) return
      setItems(res.messages.map((m) => ({
        role: m.role ?? 'assistant',
        text: m.parts.filter((p) => p.type === 'text').map((p) => p.text ?? '').join(''),
        tools: m.parts.filter((p) => p.type === 'tool').map((p) => p.toolName ?? ''),
      })))
    }).catch(console.error)
  }, [threadId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [items])

  const ensureThread = async () => {
    if (threadId) return threadId
    const t = await api.createThread()
    setThreads((ts) => [t, ...ts])
    setThreadId(t.id)
    return t.id
  }

  const send = async () => {
    const message = input.trim()
    if (!message || streaming) return
    setInput('')
    setStreaming(true)
    setItems((arr) => [...arr, { role: 'user', text: message, tools: [] }, { role: 'assistant', text: '', tools: [] }])
    try {
      const tid = await ensureThread()
      await streamChat(tid, message, currentNoteId, {
        onText: (delta) => {
          setItems((arr) => {
            if (arr.length === 0) return arr
            const next = [...arr]
            const last = { ...next[next.length - 1], tools: [...(next[next.length - 1].tools || [])] }
            last.text += delta
            next[next.length - 1] = last
            return next
          })
        },
        onToolCall: (toolName) => {
          setItems((arr) => {
            if (arr.length === 0) return arr
            const next = [...arr]
            const last = { ...next[next.length - 1], tools: [...(next[next.length - 1].tools || [])] }
            last.tools.push(toolName)
            next[next.length - 1] = last
            return next
          })
        },
        onToolResult: () => {},
        onDone: () => setStreaming(false),
        onError: (msg) => {
          setItems((arr) => {
            const next = [...arr]
            const last = { ...next[next.length - 1] }
            last.text += `\n[错误] ${msg}`
            next[next.length - 1] = last
            return next
          })
          setStreaming(false)
        },
      })
    } catch (err) { console.error(err); setStreaming(false) }
  }

  return (
    <Pane>
      <Header>
        <select value={threadId} onChange={(e) => setThreadId(e.target.value)}>
          <option value="">新对话</option>
          {threads.map((t) => (
            <option key={t.id} value={t.id}>{t.title || t.id}</option>
          ))}
        </select>
        <button onClick={async () => {
          const t = await api.createThread()
          setThreads((ts) => [t, ...ts])
          setThreadId(t.id)
        }}>+</button>
      </Header>
      <Messages>
        {items.map((m, i) => (
          <div key={i} style={{ display: 'contents' }}>
            {m.tools.length > 0 && (
              <ToolRow style={m.role === 'user' ? { flexDirection: 'row-reverse' } : undefined}>
                <div className="chip">
                  <span className="icon">🔧</span>
                  <span>{m.tools.map((t) => toolNames[t] || t).join(' → ')}</span>
                </div>
              </ToolRow>
            )}
            {m.text && (
              <MessageGroup $role={m.role}>
                <Avatar $role={m.role}>{roleAvatars[m.role] ?? '?'}</Avatar>
                <Bubble $role={m.role}>{m.text}</Bubble>
              </MessageGroup>
            )}
          </div>
        ))}
        {streaming && (
          <Thinking>
            <div className="dots"><span /><span /><span /></div>
            思考中…
          </Thinking>
        )}
        <div ref={bottomRef} />
      </Messages>
      <InputRow>
        <textarea
          value={input} placeholder="和 AI 聊聊笔记…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); void send() }
          }}
        />
        <button className="btn-primary" disabled={streaming} onClick={() => void send()}>
          ↑
        </button>
      </InputRow>
    </Pane>
  )
}
