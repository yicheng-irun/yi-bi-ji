import { useState } from 'react'
import styled from 'styled-components'
import { speakText } from '../../lib/tts'

export const SpeakBtn = styled.button`
  align-self: flex-start;
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; color: var(--text-muted);
  border: 1px solid var(--border); border-radius: 6px;
  background: var(--bg-card); padding: 3px 8px; cursor: pointer;
  &:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
  &:disabled { opacity: .5; cursor: not-allowed; }
`

export function SpeakButton({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false)
  const speak = async () => {
    if (!text.trim()) return
    setSpeaking(true)
    try {
      await speakText(text)
    } catch (e) {
      console.error(e)
    } finally {
      setSpeaking(false)
    }
  }
  return (
    <SpeakBtn onClick={() => void speak()} disabled={speaking}>
      {speaking ? '…' : '🔊'} 朗读
    </SpeakBtn>
  )
}
