import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import styled from 'styled-components'

const Box = styled.div`
  position: relative;
  flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  min-height: 32px; font-size: 12px; padding: 3px 8px;
  background: transparent; border: 1px solid transparent; border-radius: var(--radius);
  color: var(--text-secondary); cursor: text;
  &:hover { border-color: var(--border); background: var(--bg-card); }
  &:focus-within { border-color: var(--accent); background: var(--bg-card); box-shadow: 0 0 0 3px rgba(79,70,229,.08); }
`

const Tag = styled.span`
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; line-height: 1.4; font-weight: 500;
  color: var(--accent-hover); background: var(--accent-light);
  border-radius: 6px; padding: 3px 8px; max-width: 100%;

  .x {
    cursor: pointer; opacity: 1; transition: color .12s;
    border: none; background: none; color: var(--accent);
    font-size: 14px; line-height: 1; padding: 0 1px;
    &:hover { color: var(--red); }
  }
`

const Input = styled.input`
  flex: 1; min-width: 80px; border: none; outline: none; background: transparent;
  font-size: 12px; color: var(--text-secondary); padding: 4px 0;
  box-shadow: none;
  &:focus { box-shadow: none; }
  &::placeholder { color: var(--text-muted); }
`

const Dropdown = styled.ul`
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; margin: 0; padding: 4px;
  list-style: none; background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow); z-index: 50;
  max-height: 220px; overflow-y: auto;
`

const Option = styled.li<{ $active: boolean }>`
  padding: 7px 10px; font-size: 13px; border-radius: 6px; cursor: pointer;
  color: ${(p) => (p.$active ? 'var(--accent-hover)' : 'var(--text-secondary)')};
  background: ${(p) => (p.$active ? 'var(--accent-light)' : 'transparent')};
  &:hover { background: var(--accent-light); color: var(--accent-hover); }
`

export interface TagInputProps {
  value: string[]
  onChange: (tags: string[]) => void
  /** 可选的标签候选项（如全站已有标签），输入框聚焦时以下拉建议展示 */
  suggestions?: string[]
  placeholder?: string
}

export function TagInput({ value, onChange, suggestions = [], placeholder = '输入标签，回车确认' }: TagInputProps) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  // 始终持有最新的 value，避免快速增删时父组件尚未重渲染导致的竞态丢标签
  const valueRef = useRef(value)
  valueRef.current = value

  const q = input.trim().toLowerCase()
  const shown = suggestions.filter((s) => !valueRef.current.includes(s))
  const suggestionsList = q ? shown.filter((s) => s.toLowerCase().includes(q)) : shown

  const addTag = (raw: string) => {
    const tag = raw.trim()
    if (!tag) return
    if (valueRef.current.includes(tag)) { setInput(''); return }
    onChange([...valueRef.current, tag])
    setInput('')
    setHighlight(0)
  }

  const removeAt = (idx: number) => {
    onChange(valueRef.current.filter((_, i) => i !== idx))
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 输入法组词过程中不拦截按键，避免误提交
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
      e.preventDefault()
      if (open && suggestionsList.length > 0) {
        const idx = Math.min(highlight, suggestionsList.length - 1)
        addTag(suggestionsList[idx])
      } else {
        addTag(input)
      }
    } else if (e.key === 'Backspace' && input === '' && valueRef.current.length > 0) {
      e.preventDefault()
      removeAt(valueRef.current.length - 1)
    } else if (e.key === 'ArrowDown') {
      if (suggestionsList.length === 0) return
      e.preventDefault()
      setOpen(true)
      setHighlight((h) => Math.min(suggestionsList.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      if (suggestionsList.length === 0) return
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const onFocus = () => { setOpen(true); setHighlight(0) }

  const commitOnBlur = () => {
    if (input.trim()) addTag(input)
    setOpen(false)
  }

  // 点击组件外部时关闭下拉
  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  return (
    <Box ref={boxRef} onClick={() => inputRef.current?.focus()}>
      {value.map((t, i) => (
        <Tag key={`${t}-${i}`}>
          <span>{t}</span>
          <button
            type="button"
            className="x"
            aria-label={`删除标签 ${t}`}
            onClick={(e) => { e.stopPropagation(); removeAt(i) }}
          >×</button>
        </Tag>
      ))}
      <Input
        ref={inputRef}
        value={input}
        placeholder={value.length === 0 ? placeholder : ''}
        onChange={(e) => { setInput(e.target.value); setOpen(true); setHighlight(0) }}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={commitOnBlur}
      />
      {open && suggestionsList.length > 0 && (
        <Dropdown>
          {suggestionsList.map((s, i) => (
            <Option
              key={s}
              $active={i === highlight}
              onMouseDown={(e) => { e.preventDefault(); addTag(s) }}
              onMouseEnter={() => setHighlight(i)}
            >{s}</Option>
          ))}
        </Dropdown>
      )}
    </Box>
  )
}
