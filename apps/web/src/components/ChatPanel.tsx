import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import styled, { keyframes } from 'styled-components'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, getToolName, isTextUIPart, isToolUIPart, type UIMessage } from 'ai'
import { api, type Thread } from '../api/client'

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

const blink = keyframes`
  0%,100% { opacity: 1; }
  50% { opacity: .3; }
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
  .chip.running .icon { animation: ${blink} 1.2s ease infinite; }
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

const MAX_TEXTAREA_HEIGHT = 132

const InputRow = styled.div`
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  border-top: 1px solid var(--border); background: var(--bg-hover);
  textarea {
    flex: 1; min-height: 44px; max-height: ${MAX_TEXTAREA_HEIGHT}px; resize: none;
    font-size: 14px; line-height: 1.4; box-sizing: border-box; overflow-y: auto;
    border-radius: var(--radius-lg);
    padding: 10px 14px;
    &:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,70,229,.08); }
  }
`

const SendButton = styled.button`
  width: 36px; height: 36px; border-radius: 50%; padding: 0;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: var(--accent); color: #fff; border: none; cursor: pointer;
  box-shadow: 0 2px 6px rgba(79,70,229,.25);
  transition: background .15s, transform .1s, box-shadow .15s;
  svg { width: 17px; height: 17px; }

  &:hover:not(:disabled) { background: var(--accent-hover); }
  &:active:not(:disabled) { transform: scale(.92); }
  &:disabled { background: var(--border); color: var(--text-muted); cursor: not-allowed; box-shadow: none; }
`

const ContextBar = styled.div`
  display: flex; justify-content: flex-end; padding: 2px 14px;
  font-size: 11px; color: var(--text-muted); background: var(--bg-hover);
  border-top: 1px solid var(--border);
`

export const toolNames: Record<string, string> = {
  list_notes: '列笔记', search_notes: '搜索', read_note: '读取',
  create_note: '新建', write_note: '全量写', replace_in_note: '替换',
  insert_block: '插入', set_note_tags: '打标签', web_search: '联网搜索', web_fetch: '打开网页',
}

const roleAvatars: Record<string, string> = { user: '我', assistant: 'AI' }

interface ChatPanelProps {
  threadId: string
  currentNoteId?: number
  onThreadCreated?: (thread: Thread) => void
}

function renderMessageParts(m: UIMessage): ReactNode[] {
  const nodes: ReactNode[] = []
  let textBuf = ''
  let firstBubble = true
  let tbIndex = 0
  const flushText = () => {
    if (!textBuf) return
    const t = textBuf
    textBuf = ''
    const key = `t-${tbIndex++}`
    nodes.push(
      <MessageGroup key={key} $role={m.role}>
        {firstBubble ? (
          <Avatar $role={m.role}>{roleAvatars[m.role] ?? '?'}</Avatar>
        ) : (
          <span style={{ width: 30, flexShrink: 0 }} />
        )}
        <Bubble $role={m.role}>{t}</Bubble>
      </MessageGroup>,
    )
    firstBubble = false
  }
  m.parts.forEach((part, i) => {
    if (isTextUIPart(part) && part.text) {
      textBuf += part.text
    } else if (isToolUIPart(part)) {
      flushText()
      const name = toolNames[getToolName(part)] || getToolName(part)
      const running = part.state !== 'output-available' && part.state !== 'output-error'
      nodes.push(
        <ToolRow key={`tool-${i}`} style={m.role === 'user' ? { flexDirection: 'row-reverse' } : undefined}>
          <div className={running ? 'chip running' : 'chip'}>
            <span className="icon">🔧</span>
            <span>{name}</span>
          </div>
        </ToolRow>,
      )
    }
  })
  flushText()
  if (nodes.length === 0) {
    nodes.push(
      <MessageGroup key="empty" $role={m.role}>
        {firstBubble ? (
          <Avatar $role={m.role}>{roleAvatars[m.role] ?? '?'}</Avatar>
        ) : (
          <span style={{ width: 30, flexShrink: 0 }} />
        )}
        <Bubble $role={m.role} />,
      </MessageGroup>,
    )
  }
  return nodes
}

export function ChatPanel({ threadId, currentNoteId, onThreadCreated }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [contextInfo, setContextInfo] = useState<{ messageCount: number; estimatedTokens: number } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const threadIdRef = useRef(threadId)
  threadIdRef.current = threadId
  const noteIdRef = useRef(currentNoteId)
  noteIdRef.current = currentNoteId
  const onThreadCreatedRef = useRef(onThreadCreated)
  onThreadCreatedRef.current = onThreadCreated

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat/threads',
        prepareSendMessagesRequest: async ({ messages, headers, credentials }) => {
          let tid = threadIdRef.current
          if (!tid) {
            const t = await api.createThread(undefined, noteIdRef.current)
            tid = t.id
            threadIdRef.current = t.id
            onThreadCreatedRef.current?.(t)
          }
          return {
            api: `/api/chat/threads/${tid}/stream`,
            headers,
            credentials,
            body: { messages: messages.slice(-1), currentNoteId: noteIdRef.current },
          }
        },
      }),
    [],
  )

  const refreshContext = (tid: string) => {
    if (!tid) { setContextInfo(null); return }
    api.getContext(tid)
      .then((c) => { if (threadIdRef.current === tid) setContextInfo(c) })
      .catch(() => {})
  }

  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
    onFinish: () => refreshContext(threadIdRef.current),
    onError: (e) => console.error(e),
  })

  const streaming = status === 'submitted' || status === 'streaming'
  const streamingRef = useRef(streaming)
  streamingRef.current = streaming

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [input])

  useEffect(() => {
    refreshContext(threadId)
    if (!threadId) { setMessages([]); return }
    if (streamingRef.current) return
    api.getMessages(threadId).then((res) => {
      if (streamingRef.current) return
      setMessages(res.messages)
    }).catch(console.error)
  }, [threadId, setMessages])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = () => {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')
    void sendMessage({ text })
  }

  return (
    <>
      <Messages>
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'contents' }}>
            {renderMessageParts(m)}
          </div>
        ))}
        {streaming && (
          <Thinking>
            <div className="dots"><span /><span /><span /></div>
            思考中…
          </Thinking>
        )}
        {status === 'error' && (
          <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center' }}>
            [错误] {error?.message ?? '请求失败'}
          </p>
        )}
        {messages.length === 0 && !streaming && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
            发送消息开始对话
          </p>
        )}
        <div ref={bottomRef} />
      </Messages>
      {contextInfo && (
        <ContextBar>
          上下文 ~{contextInfo.estimatedTokens >= 1000
            ? `${(contextInfo.estimatedTokens / 1000).toFixed(1)}k`
            : contextInfo.estimatedTokens} tokens · {contextInfo.messageCount} 条消息
        </ContextBar>
      )}
      <InputRow>
        <textarea
          ref={textareaRef}
          value={input} placeholder="和 AI 聊聊笔记…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); send() }
          }}
        />
        <SendButton disabled={streaming} onClick={send} aria-label="发送">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </SendButton>
      </InputRow>
    </>
  )
}
