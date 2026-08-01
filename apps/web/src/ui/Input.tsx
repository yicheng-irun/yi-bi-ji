import { forwardRef, type InputHTMLAttributes } from 'react'
import styled, { css } from 'styled-components'

export type InputSize = 'md' | 'lg'

const sizes: Record<InputSize, ReturnType<typeof css>> = {
  md: css` height: 36px; font-size: 13px; `,
  lg: css` height: 42px; font-size: 15px; `,
}

const StyledInput = styled.input<{ $size: InputSize }>`
  font: inherit;
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 0 12px;
  background: var(--bg-card); color: var(--text);
  transition: border-color .15s, box-shadow .15s;
  outline: none;
  ${(p) => sizes[p.$size]}
  &:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,70,229,.1); }
  &::placeholder { color: var(--text-muted); }
`

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', ...rest },
  ref,
) {
  return <StyledInput ref={ref} $size={size} {...rest} />
})
