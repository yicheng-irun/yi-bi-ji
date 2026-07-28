import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'
import { api, streamChat, type Thread } from '../api/client'

const Pane = styled.div`
  width: 380px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #d0d7de;
  border-radius: 8px;
  overflow: hidden;
`

const Header = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid #eaeef2;
  select { flex: 1; font: inherit; }
`

const Messages = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`

const Bubble = styled.div<{ $role: string }>`
  max-width: 90%;
  align-self: ${(p) => (p.$role === 'user' ? 'flex-end' : 'flex-start')};
  background: ${(p) => (p.$role === 'user' ? '#ddf4ff' : '#f6f8fa')};
  border: 1px solid #d0d7de;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
`

const ToolChip = styled.div`
  align-self: flex-start;
  font-size: 12px;
  color: #57606a;
  background: #eaeef2;
  border-radius: 6px;
  padding: 3px 8px;
`

const InputRow = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px;
  border-top: 1px solid #eaeef2;
  textarea {
    flex: 1;
    resize: none;
    height: 60px;
  }
`

interface DisplayItem {
  role: string
  text: string
  tools: string[]
}

export function ChatSidebar({ currentNoteId }: { currentNoteId?: number }) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [threadId, setThreadId] = useState('')
  const [items, setItems] = useState<DisplayItem[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.listThreads().then((res) => {
      const list = Array.isArray(res) ? res : res.threads ?? []
      setThreads(list)
      if (list.length > 0) setThreadId(list[0].id)
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (!threadId) {
      setItems([])
      return
    }
    api.getMessages(threadId).then((res) => {
      setItems(
        res.messages.map((m) => ({
          role: m.role ?? 'assistant',
          text: m.parts.filter((p) => p.type === 'text').map((p) => p.text ?? '').join(''),
          tools: m.parts.filter((p) => p.type === 'tool').map((p) => p.toolName ?? ''),
        })),
      )
    }).catch(console.error)
  }, [threadId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [items])

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
            const next = [...arr]
            const last = { ...next[next.length - 1] }
            last.text += delta
            next[next.length - 1] = last
            return next
          })
        },
        onToolCall: (toolName) => {
          setItems((arr) => {
            const next = [...arr]
            const last = { ...next[next.length - 1], tools: [...next[next.length - 1].tools] }
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
    } catch (err) {
      console.error(err)
      setStreaming(false)
    }
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
        <button
          onClick={async () => {
            const t = await api.createThread()
            setThreads((ts) => [t, ...ts])
            setThreadId(t.id)
          }}
        >
          新建
        </button>
      </Header>
      <Messages>
        {items.map((m, i) => (
          <div key={i} style={{ display: 'contents' }}>
            {m.tools.map((t, j) => (
              <ToolChip key={j}>调用工具：{t}</ToolChip>
            ))}
            {m.text && <Bubble $role={m.role}>{m.text}</Bubble>}
          </div>
        ))}
        {streaming && <ToolChip>思考中…</ToolChip>}
        <div ref={bottomRef} />
      </Messages>
      <InputRow>
        <textarea
          value={input}
          placeholder="和 AI 聊聊笔记…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void send()
          }}
        />
        <button className="primary" disabled={streaming} onClick={() => void send()}>
          发送
        </button>
      </InputRow>
    </Pane>
  )
}
