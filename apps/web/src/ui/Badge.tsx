import type { HTMLAttributes } from 'react'
import styled, { css } from 'styled-components'

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
export type BadgeShape = 'pill' | 'sm'

const variants: Record<BadgeVariant, ReturnType<typeof css>> = {
  neutral: css` background: var(--bg-hover); color: var(--text-muted); border-color: var(--border); `,
  accent: css` background: var(--accent-light); color: var(--accent); border-color: transparent; `,
  success: css` background: var(--green-bg); color: var(--green); border-color: transparent; `,
  warning: css` background: var(--orange-bg); color: var(--orange); border-color: #fcd34d; `,
  danger: css` background: #fef2f2; color: var(--red); border-color: #fecaca; `,
}

const shapes: Record<BadgeShape, ReturnType<typeof css>> = {
  pill: css` border-radius: 20px; `,
  sm: css` border-radius: 4px; `,
}

const StyledBadge = styled.span<{ $variant: BadgeVariant; $shape: BadgeShape }>`
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; padding: 2px 8px;
  border: 1px solid; white-space: nowrap; flex-shrink: 0;
  ${(p) => variants[p.$variant]}
  ${(p) => shapes[p.$shape]}
`

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  shape?: BadgeShape
}

export function Badge({ variant = 'neutral', shape = 'pill', ...rest }: BadgeProps) {
  return <StyledBadge $variant={variant} $shape={shape} {...rest} />
}
