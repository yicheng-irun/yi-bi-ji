import styled, { keyframes } from 'styled-components'

const bounce = keyframes`
  0%, 80%, 100% { transform: translateY(0); opacity: .4; }
  40% { transform: translateY(-6px); opacity: 1; }
`

const Wrap = styled.div`
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 60px 20px; color: var(--text-muted);

  svg circle {
    fill: var(--accent);
    animation: ${bounce} 1.2s ease-in-out infinite;
  }
  svg circle:nth-child(2) { animation-delay: .15s; }
  svg circle:nth-child(3) { animation-delay: .3s; }

  .text { font-size: 13px; }
`

export function Loading({ text = '加载中…' }: { text?: string }) {
  return (
    <Wrap>
      <svg width="48" height="16" viewBox="0 0 48 16">
        <circle cx="10" cy="8" r="4" />
        <circle cx="24" cy="8" r="4" />
        <circle cx="38" cy="8" r="4" />
      </svg>
      <div className="text">{text}</div>
    </Wrap>
  )
}
