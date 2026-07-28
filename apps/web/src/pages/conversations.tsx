import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { api, type ChatMessage, type Thread } from '../api/client'

const Wrap = styled.div`
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  gap: 16px;
  height: 100%;
`

const ThreadList = styled.div`
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
`

const ThreadItem = styled.button<{ $active: boolean }>`
  text-align: left;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${(p) => (p.$active ? '#ddf4ff' : '#fff')};
  border: 1px solid ${(p) => (p.$active ? '#0969da' : '#d0d7de')};
`

const MsgPane = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Msg = styled.div<{ $role: string }>`
  background: ${(p) => (p.$role === 'user' ? '#ddf4ff' : '#fff')};
  border: 1px solid #d0d7de;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  white-space: pre-wrap;
  word-break: break-word;
`

const ToolLine = styled.div`
  font-size: 12px;
  color: #57606a;
  background: #eaeef2;
  border-radius: 6px;
  padding: 3px 8px;
  align-self: flex-start;
`

export default function ConversationsPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeId, setActiveId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    api.listThreads().then((res) => {
      const list = Array.isArray(res) ? res : res.threads ?? []
      setThreads(list)
      if (list.length > 0) setActiveId(list[0].id)
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (!activeId) return
    api.getMessages(activeId).then((res) => setMessages(res.messages)).catch(console.error)
  }, [activeId])

  return (
    <Wrap>
      <ThreadList>
        {threads.map((t) => (
          <ThreadItem key={t.id} $active={t.id === activeId} onClick={() => setActiveId(t.id)}>
            <div>{t.title || t.id}</div>
            <div style={{ fontSize: 12, color: '#57606a' }}>
              {new Date(t.updatedAt).toLocaleString('zh-CN')}
            </div>
          </ThreadItem>
        ))}
        {threads.length === 0 && <p style={{ color: '#57606a' }}>暂无会话。</p>}
      </ThreadList>
      <MsgPane>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'contents' }}>
            {m.parts.filter((p) => p.type === 'tool').map((p, j) => (
              <ToolLine key={j}>
                工具：{p.toolName}（{p.state}）{p.args ? ` ${JSON.stringify(p.args).slice(0, 120)}` : ''}
              </ToolLine>
            ))}
            {m.parts.some((p) => p.type === 'text' && p.text) && (
              <Msg $role={m.role}>
                {m.parts.filter((p) => p.type === 'text').map((p) => p.text).join('')}
              </Msg>
            )}
          </div>
        ))}
      </MsgPane>
    </Wrap>
  )
}
