import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styled from 'styled-components'
import { Button } from './Button'

const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 100;
  background: rgba(15, 17, 30, .45);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
`

const Panel = styled.div`
  width: 560px; max-width: 100%;
  max-height: min(85vh, 720px);
  display: flex; flex-direction: column;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); box-shadow: var(--shadow);
`

const Header = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px; border-bottom: 1px solid var(--border);
  h3 { font-size: 15px; font-weight: 700; margin: 0; }
  .close {
    border: none; background: none; cursor: pointer;
    color: var(--text-muted); font-size: 18px; line-height: 1;
    padding: 4px; border-radius: 6px;
    &:hover { background: var(--bg-hover); color: var(--text); }
  }
`

const Body = styled.div`
  flex: 1; min-height: 0; overflow-y: auto;
  padding: 16px 18px;
`

const Footer = styled.div`
  display: flex; align-items: center; justify-content: flex-end; gap: 10px;
  padding: 12px 18px; border-top: 1px solid var(--border);
`

export interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function Modal({ title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return createPortal(
    <Overlay onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <Panel role="dialog" aria-modal="true" aria-label={title}>
        <Header>
          <h3>{title}</h3>
          <button className="close" onClick={onClose} aria-label="关闭">×</button>
        </Header>
        <Body>{children}</Body>
        {footer && <Footer>{footer}</Footer>}
      </Panel>
    </Overlay>,
    document.body,
  )
}

export function ModalFooterCancel({ onClose }: { onClose: () => void }) {
  return <Button onClick={onClose}>取消</Button>
}
