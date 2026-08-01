import { useEffect, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { InputRow, SendButton, MAX_TEXTAREA_HEIGHT } from './styles'
import { useVoiceRecorder } from '../../lib/useVoiceRecorder'

interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSend: (text?: string) => void
  disabled: boolean
  voiceEnabled: boolean
  voiceAutoSend: boolean
  transcribeAudio: (blob: Blob) => Promise<string>
}

const pulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
`

const MicButton = styled.button<{ $recording?: boolean; $busy?: boolean }>`
  width: 36px; height: 36px; border-radius: 50%; padding: 0;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border); background: var(--bg-card); color: var(--text-secondary);
  cursor: pointer; transition: background .15s, color .15s, border-color .15s, transform .1s;
  svg { width: 17px; height: 17px; }
  &:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  &:disabled { opacity: .5; cursor: not-allowed; }
  ${(p) =>
    p.$recording
      ? css`
          background: var(--red);
          border-color: var(--red);
          color: #fff;
          animation: ${pulse} 1s ease infinite;
        `
      : ''}
  ${(p) => (p.$busy ? 'opacity: .6; cursor: wait;' : '')}
`

const Tip = styled.div`
  font-size: 12px; color: var(--red); padding: 0 12px 4px;
`

export function ChatInput({ value, onChange, onSend, disabled, voiceEnabled, voiceAutoSend, transcribeAudio }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [micBusy, setMicBusy] = useState(false)
  const [micError, setMicError] = useState('')
  const rec = useVoiceRecorder()

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [value])

  const onMicDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || micBusy || rec.recording) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setMicError('')
    void rec.start()
  }

  const onMicUp = async () => {
    if (!rec.recording || micBusy) return
    setMicBusy(true)
    try {
      const blob = await rec.stop()
      const text = await transcribeAudio(blob)
      if (text) {
        if (voiceAutoSend) onSend(text)
        else onChange(text)
      }
    } catch (e) {
      setMicError((e as Error).message || '识别失败')
    } finally {
      setMicBusy(false)
    }
  }

  return (
    <>
      {micError && <Tip>🎙 {micError}</Tip>}
      <InputRow>
        <textarea
          ref={textareaRef}
          value={value}
          placeholder="和 AI 聊聊笔记…"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
              e.preventDefault()
              onSend()
            }
          }}
        />
        {voiceEnabled && (
          <MicButton
            $recording={rec.recording}
            $busy={micBusy}
            disabled={disabled || micBusy}
            onPointerDown={onMicDown}
            onPointerUp={() => void onMicUp()}
            onPointerCancel={() => void onMicUp()}
            aria-label={rec.recording ? '松开发送' : '按住说话'}
            title={voiceAutoSend ? '按住说话，松开即发送' : '按住说话，松开填入输入框'}
          >
            {rec.recording ? (
              <svg viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            )}
          </MicButton>
        )}
        <SendButton disabled={disabled} onClick={() => onSend()} aria-label="发送">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </SendButton>
      </InputRow>
    </>
  )
}
