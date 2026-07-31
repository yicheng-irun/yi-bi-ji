import { useEffect, useRef, type ReactNode } from 'react'
import type { ChatStatus, UIMessage } from 'ai'
import { getToolName, isReasoningUIPart, isTextUIPart, isToolUIPart } from 'ai'
import { Avatar, Messages, MessageGroup, Bubble, Thinking, ToolRow, toolNames, roleAvatars } from './styles'
import { ReasoningBlock } from './ReasoningBlock'

function renderMessageParts(m: UIMessage) {
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
    } else if (isReasoningUIPart(part) && part.text) {
      flushText()
      const streaming = part.state === 'streaming'
      nodes.push(
        <ReasoningBlock
          key={`reason-${i}`}
          text={part.text}
          streaming={streaming}
          role={m.role}
        />,
      )
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

interface MessageListProps {
  messages: UIMessage[]
  streaming: boolean
  status: ChatStatus
  error?: Error | null
}

export function MessageList({ messages, streaming, status, error }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
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
  )
}
