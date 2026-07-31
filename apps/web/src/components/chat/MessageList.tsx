import { useEffect, useRef, type ReactNode } from 'react'
import type { ChatStatus, UIMessage } from 'ai'
import { getToolName, isReasoningUIPart, isTextUIPart, isToolUIPart } from 'ai'
import { Avatar, Messages, Bubble, Thinking, ToolRow, SubagentBlock, MessageRow, MessageContent, toolNames, roleAvatars } from './styles'
import { ReasoningBlock } from './ReasoningBlock'

interface SubagentMessage {
  parts?: UIMessage['parts']
}

function isSubagentOutput(o: unknown): o is SubagentMessage {
  return !!o && typeof o === 'object' && Array.isArray((o as SubagentMessage).parts)
}

function SubagentOutput({ output }: { output: SubagentMessage }) {
  const nodes: ReactNode[] = []
  output.parts?.forEach((part, i) => {
    if (isTextUIPart(part) && part.text) {
      nodes.push(<div key={`s-text-${i}`} className="sub-text">{part.text}</div>)
    } else if (isToolUIPart(part)) {
      const name = toolNames[getToolName(part)] || getToolName(part)
      const running = part.state !== 'output-available' && part.state !== 'output-error'
      nodes.push(
        <div key={`s-tool-${i}`} className={running ? 'sub-tool running' : 'sub-tool'}>
          <span>🔧</span>
          <span>{name}</span>
        </div>,
      )
    }
  })
  return <SubagentBlock>{nodes}</SubagentBlock>
}

function MessageParts({ message }: { message: UIMessage }): ReactNode {
  const nodes: ReactNode[] = []
  let textBuf = ''
  let tbIndex = 0
  const flushText = () => {
    if (!textBuf) return
    const t = textBuf
    textBuf = ''
    nodes.push(<Bubble key={`t-${tbIndex++}`} $role={message.role}>{t}</Bubble>)
  }
  message.parts.forEach((part, i) => {
    if (isTextUIPart(part) && part.text) {
      textBuf += part.text
    } else if (isReasoningUIPart(part) && part.text) {
      flushText()
      const streaming = part.state === 'streaming'
      nodes.push(<ReasoningBlock key={`reason-${i}`} text={part.text} streaming={streaming} />)
    } else if (isToolUIPart(part)) {
      flushText()
      const name = toolNames[getToolName(part)] || getToolName(part)
      const running = part.state !== 'output-available' && part.state !== 'output-error'
      nodes.push(
        <ToolRow key={`tool-${i}`}>
          <div className={running ? 'chip running' : 'chip'}>
            <span className="icon">🔧</span>
            <span>{name}</span>
          </div>
          {part.state === 'output-available' && isSubagentOutput(part.output) && (
            <SubagentOutput output={part.output} />
          )}
        </ToolRow>,
      )
    }
  })
  flushText()
  if (nodes.length === 0) {
    nodes.push(<Bubble key="empty" $role={message.role} />)
  }
  return <>{nodes}</>
}

function MessageItem({ message }: { message: UIMessage }) {
  return (
    <MessageRow $role={message.role}>
      <Avatar $role={message.role}>{roleAvatars[message.role] ?? '?'}</Avatar>
      <MessageContent $role={message.role}>
        <MessageParts message={message} />
      </MessageContent>
    </MessageRow>
  )
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
        <MessageItem key={m.id} message={m} />
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
