import type { ReactNode } from 'react'
import styled, { css } from 'styled-components'

const Wrap = styled.div<{ $compact: boolean }>`
  text-align: center; color: var(--text-secondary);
  ${(p) =>
    p.$compact
      ? css` padding: 40px 0; font-size: 13px; color: var(--text-muted); `
      : css` padding: 60px 20px; font-size: 15px; `}
  .icon { font-size: 48px; margin-bottom: 12px; }
  p { font-size: inherit; }
`

export interface EmptyProps {
  icon?: ReactNode
  title?: ReactNode
  children?: ReactNode
  /** 紧凑样式（用于局部小区域，如 diff 内空状态） */
  compact?: boolean
}

export function Empty({ icon, title, children, compact = false }: EmptyProps) {
  return (
    <Wrap $compact={compact}>
      {icon && <div className="icon">{icon}</div>}
      {title && <p>{title}</p>}
      {children}
    </Wrap>
  )
}
