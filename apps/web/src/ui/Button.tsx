import { forwardRef, type ButtonHTMLAttributes } from 'react'
import styled, { css } from 'styled-components'

export type ButtonVariant = 'default' | 'primary' | 'success' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variants: Record<ButtonVariant, ReturnType<typeof css>> = {
  default: css`
    background: var(--bg-card); color: var(--text); border-color: var(--border);
    &:hover:not(:disabled) { background: var(--bg-hover); border-color: #d1d5db; }
  `,
  primary: css`
    background: var(--accent); color: #fff; border-color: var(--accent);
    &:hover:not(:disabled) { background: var(--accent-hover); border-color: var(--accent-hover); }
  `,
  success: css`
    background: var(--green); color: #fff; border-color: var(--green);
    &:hover:not(:disabled) { background: var(--green-hover); border-color: var(--green-hover); }
  `,
  danger: css`
    color: var(--red); border-color: transparent; background: transparent;
    &:hover:not(:disabled) { background: #fef2f2; color: var(--red-hover); }
  `,
  ghost: css`
    background: transparent; border-color: transparent;
    &:hover:not(:disabled) { background: var(--bg-hover); }
  `,
}

const sizes: Record<ButtonSize, ReturnType<typeof css>> = {
  sm: css` padding: 3px 10px; font-size: 12px; border-radius: 6px; `,
  md: css` padding: 6px 14px; font-size: 13px; `,
  lg: css` height: 42px; padding: 0 20px; font-size: 14px; `,
}

const StyledButton = styled.button<{ $variant: ButtonVariant; $size: ButtonSize }>`
  font: inherit; cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  border: 1px solid; border-radius: var(--radius);
  font-weight: 500; white-space: nowrap;
  transition: all .15s;
  ${(p) => variants[p.$variant]}
  ${(p) => sizes[p.$size]}
  &:active { transform: scale(.98); }
  &:disabled { opacity: .5; cursor: not-allowed; transform: none; }
`

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', type = 'button', ...rest },
  ref,
) {
  return <StyledButton ref={ref} type={type} $variant={variant} $size={size} {...rest} />
})
