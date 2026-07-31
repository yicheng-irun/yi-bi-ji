import styled, { keyframes } from 'styled-components'

export const MAX_TEXTAREA_HEIGHT = 132

export const Messages = styled.div`
  flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 14px;
`

export const Avatar = styled.div<{ $role: string }>`
  width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700;
  background: ${(p) => (p.$role === 'user' ? 'var(--accent-light)' : '#f3f4f6')};
  color: ${(p) => (p.$role === 'user' ? 'var(--accent)' : 'var(--text-secondary)')};
`

export const Bubble = styled.div<{ $role: string }>`
  background: ${(p) => (p.$role === 'user' ? 'var(--accent-light)' : '#f9fafb')};
  border-radius: ${(p) =>
    p.$role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px'};
  padding: 10px 14px; font-size: 14px; line-height: 1.55;
  white-space: pre-wrap; word-break: break-word; max-width: 100%;
  color: var(--text);
`

const blink = keyframes`
  0%,100% { opacity: 1; }
  50% { opacity: .3; }
`

export const ToolRow = styled.div`
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

export const Thinking = styled.div`
  display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted);
  padding: 2px 0;
  .dots span {
    display: inline-block; width: 5px; height: 5px; border-radius: 50%;
    background: var(--text-muted); margin-right: 3px; animation: ${blink} 1.4s ease infinite;
  }
  .dots span:nth-child(2) { animation-delay: .2s; }
  .dots span:nth-child(3) { animation-delay: .4s; }
`

export const InputRow = styled.div`
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

export const SendButton = styled.button`
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

export const ContextBar = styled.div`
  display: flex; justify-content: flex-end; padding: 2px 14px;
  font-size: 11px; color: var(--text-muted); background: var(--bg-hover);
  border-top: 1px solid var(--border);
`


export const MessageRow = styled.div<{ $role: string }>`
  display: flex; gap: 8px; align-items: flex-start;
  flex-direction: ${(p) => (p.$role === 'user' ? 'row-reverse' : 'row')};
  max-width: 100%;
`

export const MessageContent = styled.div<{ $role: string }>`
  display: flex; flex-direction: column; gap: 12px;
  flex: 1; min-width: 0;
  align-items: ${(p) => (p.$role === 'user' ? 'flex-end' : 'flex-start')};
`

export const toolNames: Record<string, string> = {
  list_notes: '列笔记', search_notes: '搜索', read_note: '读取',
  create_note: '新建', write_note: '全量写', replace_in_note: '替换',
  insert_block: '插入', set_note_tags: '打标签', web_search: '联网搜索', web_fetch: '打开网页',
}

export const roleAvatars: Record<string, string> = { user: '我', assistant: 'AI' }
