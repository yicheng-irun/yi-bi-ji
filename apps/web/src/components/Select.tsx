import { useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

export interface SelectOption {
  value: string
  label: string
}

const Wrap = styled.div`
  position: relative; min-width: 0; flex: 1;
`

const Trigger = styled.button<{ $placeholder: boolean }>`
  width: 100%; height: 34px; display: flex; align-items: center; gap: 6px;
  padding: 0 10px; font-size: 13px; background: var(--bg-card);
  color: ${(p) => (p.$placeholder ? 'var(--text-muted)' : 'var(--text)')};
  border-radius: var(--radius); cursor: pointer;
  transition: border-color .15s, box-shadow .15s;
  &:hover { background: var(--bg-hover); border-color: #d1d5db; }
  &:focus-visible, &[data-open='true'] {
    border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,70,229,.08);
  }
  .label {
    flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; text-align: left;
  }
  .chev {
    flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    color: var(--text-muted); transition: transform .15s;
  }
  &[data-open='true'] .chev { transform: rotate(180deg); }
`

const Menu = styled.ul`
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  margin: 0; padding: 4px; list-style: none;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); box-shadow: var(--shadow);
  max-height: 280px; overflow-y: auto; z-index: 20;
`

const Item = styled.li<{ $active: boolean; $hl: boolean }>`
  padding: 7px 10px; border-radius: 6px; cursor: pointer;
  font-size: 13px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  background: ${(p) => (p.$active ? 'var(--accent-light)' : p.$hl ? 'var(--bg-hover)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--accent)' : 'var(--text)')};
  font-weight: ${(p) => (p.$active ? 600 : 400)};
`

export function Select({ value, onChange, options, placeholder = '' }: {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [hl, setHl] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    const idx = options.findIndex((o) => o.value === value)
    setHl(Math.max(0, idx))
  }, [open, options, value])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setHl((h) =>
          e.key === 'ArrowDown'
            ? Math.min(options.length - 1, h + 1)
            : Math.max(0, h - 1),
        )
        return
      }
      if (e.key === 'Enter' && options[hl]) {
        e.preventDefault()
        onChange(options[hl].value)
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, options, hl, onChange])

  return (
    <Wrap ref={wrapRef}>
      <Trigger
        type="button"
        data-open={open || undefined}
        $placeholder={!selected}
        onClick={() => setOpen((o) => !o)}
        title={selected?.label}
      >
        <span className="label">{selected ? selected.label : placeholder}</span>
        <span className="chev">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </Trigger>
      {open && (
        <Menu>
          {options.map((o, i) => (
            <Item
              key={o.value}
              $active={o.value === value}
              $hl={i === hl}
              onMouseEnter={() => setHl(i)}
              onMouseDown={(e) => { e.preventDefault(); onChange(o.value); setOpen(false) }}
            >
              {o.label}
            </Item>
          ))}
        </Menu>
      )}
    </Wrap>
  )
}
