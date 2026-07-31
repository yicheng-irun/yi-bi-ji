import { useState } from 'react'
import styled from 'styled-components'

const Reasoning = styled.div<{ $open: boolean; $streaming: boolean }>`
  max-width: 100%;
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

export function ReasoningBlock({ text, streaming }: { text: string; streaming: boolean }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <Reasoning $open={open} $streaming={streaming}>
      <div className="head" onClick={() => setOpen((o) => !o)}>
        <span className="caret">▶</span>
        <span>💭 思考过程{streaming ? '…' : ''}</span>
      </div>
      <div className="body">{text}</div>
    </Reasoning>
  )
}
