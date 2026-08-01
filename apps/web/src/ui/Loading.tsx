import styled, { keyframes } from 'styled-components'

const breathe = keyframes`
  0%, 100% { transform: translateY(0) scale(.4); opacity: .45; }
  40% { transform: translateY(-8px) scale(1.35); opacity: 1; }
  80% { transform: translateY(0) scale(.4); opacity: .45; }
`

const Wrap = styled.div`
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 60px 20px; color: var(--text-muted);

  svg circle {
    fill: var(--accent);
    transform-box: fill-box;
    transform-origin: center;
    transform: translateY(0) scale(.4);
    opacity: .45;
    animation: ${breathe} 1.8s ease-in-out infinite backwards;
  }
  svg circle:nth-child(2) { animation-delay: .3s; }
  svg circle:nth-child(3) { animation-delay: .6s; }

  .text { font-size: 13px; }
`

export function Loading({ text = '加载中…' }: { text?: string }) {
  return (
    <Wrap>
      <svg width="48" height="24" viewBox="0 0 48 24">
        <circle cx="10" cy="18" r="4" />
        <circle cx="24" cy="18" r="4" />
        <circle cx="38" cy="18" r="4" />
      </svg>
      <div className="text">{text}</div>
    </Wrap>
  )
}
