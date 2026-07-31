import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ChatStatus, UIMessage } from 'ai'
import { getToolName, isReasoningUIPart, isTextUIPart, isToolUIPart } from 'ai'
import { Avatar, Messages, Bubble, MarkdownBubble, Thinking, ToolCard as ToolCardBox, SubagentBlock, MessageRow, MessageContent, toolNames, roleAvatars } from './styles'
import { ReasoningBlock } from './ReasoningBlock'
import { ChatMarkdown } from './ChatMarkdown'

interface SubagentMessage {
  parts?: UIMessage['parts']
}

function isSubagentOutput(o: unknown): o is SubagentMessage {
  return !!o && typeof o === 'object' && Array.isArray((o as SubagentMessage).parts)
}

function isSubagentRunning(output: SubagentMessage): boolean {
  return (
    output.parts?.some(
      (p) => isToolUIPart(p) && p.state !== 'output-available' && p.state !== 'output-error',
    ) ?? false
  )
}

type ToolPart = Parameters<typeof isToolUIPart>[0]

function SubagentOutput({ output }: { output: SubagentMessage }) {
  const nodes: ReactNode[] = []
  output.parts?.forEach((part, i) => {
    if (isTextUIPart(part) && part.text) {
      nodes.push(<div key={`s-text-${i}`} className="sub-text">{part.text}</div>)
    } else if (isToolUIPart(part)) {
      nodes.push(<ToolCard key={`s-tool-${i}`} part={part} />)
    }
  })
  return <SubagentBlock>{nodes}</SubagentBlock>
}

function ToolCard({ part }: { part: ToolPart }) {
  if (!isToolUIPart(part)) return null
  const name = toolNames[getToolName(part)] || getToolName(part)
  const subOut = isSubagentOutput(part.output)
  const running = subOut ? isSubagentRunning(part.output as SubagentMessage) : part.state !== 'output-available' && part.state !== 'output-error'
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (subOut && running) setOpen(true)
  }, [subOut, running])

  const input = part.input
  const output = part.output
  const hasError = part.state === 'output-error'

  return (
    <ToolCardBox>
      <div className={open ? 'head open' : 'head'} onClick={() => setOpen((o) => !o)}>
        <span className="icon">🔧</span>
        <span className="name">{name}</span>
        {running && <span className="status">执行中…</span>}
        {!running && hasError && <span className="status err">失败</span>}
        <span className="caret">▸</span>
      </div>
      {open && (
        <div className="body">
          {input != null && (
            <div className="sec">
              <div className="label">参数</div>
              <pre className="json">{JSON.stringify(input, null, 2)}</pre>
            </div>
          )}
          {hasError && part.errorText && (
            <div className="sec">
              <div className="label">错误</div>
              <pre className="error">{part.errorText}</pre>
            </div>
          )}
          {part.state === 'output-available' && output !== undefined && (
            <div className="sec">
              <div className="label">{subOut ? '子代理过程' : '结果'}</div>
              {subOut ? (
                <SubagentOutput output={output as SubagentMessage} />
              ) : typeof output === 'string' ? (
                <pre className="text">{output}</pre>
              ) : output == null ? (
                <span className="muted">(无输出)</span>
              ) : (
                <pre className="json">{JSON.stringify(output, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
      )}
    </ToolCardBox>
  )
}

function MessageParts({ message }: { message: UIMessage }): ReactNode {
  const nodes: ReactNode[] = []
  let textBuf = ''
  let tbIndex = 0
  const flushText = () => {
    if (!textBuf) return
    const t = textBuf
    textBuf = ''
    if (message.role === 'assistant') {
      nodes.push(
        <MarkdownBubble key={`t-${tbIndex++}`} $role={message.role}>
          <ChatMarkdown content={t} />
        </MarkdownBubble>,
      )
    } else {
      nodes.push(<Bubble key={`t-${tbIndex++}`} $role={message.role}>{t}</Bubble>)
    }
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
      nodes.push(<ToolCard key={`tool-${i}`} part={part} />)
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
