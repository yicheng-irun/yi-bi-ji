import { useState } from 'react'
import styled from 'styled-components'
import { Avatar, roleAvatars } from './styles'

const ReasoningWrap = styled.div<{ $role: string }>`
  display: flex; gap: 8px; align-items: flex-start;
  flex-direction: ${(p) => (p.$role === 'user' ? 'row-reverse' : 'row')};
  max-width: 100%;
`

const Reasoning = styled.div<{ $open: boolean; $streaming: boolean }>`
  max-width: calc(100% - 50px);
  border-left: 2px solid ${(p) => (p.$streaming ? 'var(--accent)' : 'var(--border)')};
  padding-left: 10px;
  font-size: 12.5px; line-height: 1.55;

  .head {
    display: inline-flex; align-items: center; gap: 5px;
    cursor: pointer; user-select: none; padding: 1px 0;
    color: ${(p) => (p.$streaming ? 'var(--accent)' : 'var(--text-muted)')};
  }
  .head .caret { font-size: 9px; transition: transform .15s;
    ${(p) => (p.$open ? 'transform: rotate(90deg);' : 'transform: rotate(0);')} }
  .body {
    margin-top: 2px;
    max-height: ${(p) => (p.$open ? '360px' : '0')};
    overflow: hidden;
    overflow-y: auto;
    white-space: pre-wrap; word-break: break-word;
    color: var(--text-muted);
  }
`

export function ReasoningBlock({ text, streaming, role }: { text: string; streaming: boolean; role: string }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <ReasoningWrap $role={role}>
      {role === 'assistant' ? (
        <Avatar $role={role}>{roleAvatars[role] ?? '?'}</Avatar>
      ) : (
        <span style={{ width: 30, flexShrink: 0 }} />
      )}
      <Reasoning $open={open} $streaming={streaming}>
        <div className="head" onClick={() => setOpen((o) => !o)}>
          <span className="caret">▶</span>
          <span>💭 思考过程{streaming ? '…' : ''}</span>
        </div>
        <div className="body">{text}</div>
      </Reasoning>
    </ReasoningWrap>
  )
}
