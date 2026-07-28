import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { api, type ChatMessage, type Thread } from '../api/client'

const Wrap = styled.div`
  max-width: 960px; margin: 0 auto;
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

  .t-title { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .t-time { font-size: 11px; color: var(--text-muted); margin-top: 3px; }
`

const MsgPane = styled.div`
  flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 12px;
  padding: 4px 0;
`

const MsgGroup = styled.div<{ $role: string }>`
  display: flex; gap: 10px; align-items: flex-start;
  flex-direction: ${(p) => (p.$role === 'user' ? 'row-reverse' : 'row')};
  max-width: 100%;
`

const Avatar = styled.div<{ $role: string }>`
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
  background: ${(p) => (p.$role === 'user' ? 'var(--accent-light)' : '#f3f4f6')};
  color: ${(p) => (p.$role === 'user' ? 'var(--accent)' : 'var(--text-secondary)')};
`

const MsgBubble = styled.div<{ $role: string }>`
  background: ${(p) => (p.$role === 'user' ? 'var(--accent-light)' : '#f9fafb')};
  border-radius: ${(p) => (p.$role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px')};
  padding: 10px 14px; font-size: 14px; line-height: 1.55;
  white-space: pre-wrap; word-break: break-word; max-width: 75%;
  color: var(--text);
`

const ToolChip = styled.div`
  align-self: flex-start; font-size: 12px; color: var(--text-secondary);
  background: #f3f4f6; border: 1px solid var(--border);
  border-radius: 6px; padding: 4px 10px; display: flex; align-items: center; gap: 5px;
`

const Empty = styled.div`
  text-align: center; padding: 60px 20px; color: var(--text-secondary);
  flex: 1;
`

const toolNames: Record<string, string> = {
  list_notes: '列出笔记', search_notes: '搜索笔记', read_note: '读取笔记',
  create_note: '创建笔记', write_note: '全量写', replace_in_note: '替换文本',
  insert_block: '插入区块',
}

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
        <button onClick={async () => {
          const t = await api.createThread()
          setThreads((ts) => [t, ...ts])
          setActiveId(t.id)
        }}>+ 新建对话</button>

        {threads.map((t) => (
          <ThreadItem key={t.id} $active={t.id === activeId} onClick={() => setActiveId(t.id)}>
            <div className="t-title">{t.title || '对话'}</div>
            <div className="t-time">{new Date(t.updatedAt).toLocaleString('zh-CN')}</div>
          </ThreadItem>
        ))}
        {threads.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 8 }}>暂无会话</p>}
      </ThreadList>

      {activeId ? (
        <MsgPane>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'contents' }}>
              {m.parts.filter((p) => p.type === 'tool').map((p, j) => (
                <ToolChip key={j}>
                  🔧 {toolNames[p.toolName ?? ''] || p.toolName}
                </ToolChip>
              ))}
              {m.parts.some((p) => p.type === 'text' && p.text) && (
                <MsgGroup $role={m.role}>
                  <Avatar $role={m.role}>{m.role === 'user' ? '我' : 'AI'}</Avatar>
                  <MsgBubble $role={m.role}>
                    {m.parts.filter((p) => p.type === 'text').map((p) => p.text).join('')}
                  </MsgBubble>
                </MsgGroup>
              )}
            </div>
          ))}
        </MsgPane>
      ) : (
        <Empty>
          <p>选择左侧的对话查看消息记录</p>
        </Empty>
      )}
    </Wrap>
  )
}
