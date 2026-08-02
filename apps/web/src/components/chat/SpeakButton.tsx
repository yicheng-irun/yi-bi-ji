import { useCallback } from 'react'
import { useSyncExternalStore } from 'react'
import styled from 'styled-components'
import { getPlayingText, speakText, stopSpeech, subscribeSpeech } from '../../lib/tts'

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
  // 全局播放状态驱动：谁的文本在播（含自动朗读），谁就显示 ⏹ 停止
  const speaking = useSyncExternalStore(
    subscribeSpeech,
    useCallback(() => getPlayingText() === text, [text]),
  )
  const onClick = () => {
    if (speaking) {
      stopSpeech()
      return
    }
    void speakText(text).catch((e) => console.error(e))
  }
  return <SpeakBtn onClick={onClick}>{speaking ? '⏹ 停止' : '🔊 朗读'}</SpeakBtn>
}
