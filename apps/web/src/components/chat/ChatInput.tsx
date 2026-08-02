import { useEffect, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { InputRow, SendButton, MAX_TEXTAREA_HEIGHT } from './styles'
import { useVoiceRecorder } from '../../lib/useVoiceRecorder'

const CANCEL_DRAG_PX = 60

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

const MicWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`

const MicButton = styled.button<{ $recording?: boolean; $cancel?: boolean; $busy?: boolean }>`
  width: 36px; height: 36px; border-radius: 50%; padding: 0;
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border); background: var(--bg-card); color: var(--text-secondary);
  cursor: pointer; transition: background .15s, color .15s, border-color .15s, transform .1s;
  svg { width: 17px; height: 17px; }
  &:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  &:disabled { opacity: .5; cursor: not-allowed; }
  ${(p) =>
    p.$recording && !p.$cancel
      ? css`
          background: var(--red);
          border-color: var(--red);
          color: #fff;
          animation: ${pulse} 1s ease infinite;
        `
      : ''}
  ${(p) => (p.$recording && p.$cancel ? 'background: #b91c1c; border-color: #b91c1c; color: #fff;' : '')}
  ${(p) => (p.$busy ? 'opacity: .6; cursor: wait;' : '')}
`

const RecordHint = styled.div<{ $cancel?: boolean }>`
  position: absolute; left: 50%; bottom: calc(100% + 10px);
  transform: translateX(-50%);
  white-space: nowrap; font-size: 12px; font-weight: 600;
  padding: 6px 12px; border-radius: 8px;
  color: ${(p) => (p.$cancel ? '#fff' : 'var(--text)')};
  background: ${(p) => (p.$cancel ? 'var(--red)' : 'var(--bg-card)')};
  border: 1px solid ${(p) => (p.$cancel ? 'transparent' : 'var(--border)')};
  box-shadow: var(--shadow-sm);
  z-index: 10;
  &::after {
    content: ''; position: absolute; top: 100%; left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: ${(p) => (p.$cancel ? 'var(--red)' : 'var(--border)')};
  }
`

const Tip = styled.div`
  font-size: 12px; color: var(--text-secondary); padding: 0 12px 4px;
`

export function ChatInput({ value, onChange, onSend, disabled, voiceEnabled, voiceAutoSend, transcribeAudio }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [micBusy, setMicBusy] = useState(false)
  const [tip, setTip] = useState('')
  const [hint, setHint] = useState(false)
  const [cancelHint, setCancelHint] = useState(false)
  const rec = useVoiceRecorder()

  // 取消/处理中 的同步标记，避免 pointerup + pointercancel 连发或 HMR 残留导致重复处理
  const cancelRef = useRef(false)
  const handlingRef = useRef(false)
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showTip = (msg: string) => {
    setTip(msg)
    if (tipTimer.current) clearTimeout(tipTimer.current)
    tipTimer.current = setTimeout(() => setTip(''), 3000)
  }

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [value])

  useEffect(() => {
    return () => {
      if (tipTimer.current) clearTimeout(tipTimer.current)
    }
  }, [])

  const onMicDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled || micBusy || rec.recording || handlingRef.current) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    cancelRef.current = false
    setHint(true)
    setCancelHint(false)
    setTip('')
    void rec.start()
  }

  const onMicMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!rec.recording) return
    const cancelZone = e.currentTarget.getBoundingClientRect().top - e.clientY > CANCEL_DRAG_PX
    if (cancelZone !== cancelRef.current) {
      cancelRef.current = cancelZone
      setCancelHint(cancelZone)
    }
  }

  const finishRecording = (cancelled: boolean) => {
    setHint(false)
    setCancelHint(false)
    cancelRef.current = false
    if (handlingRef.current) return
    handlingRef.current = true
    if (cancelled) {
      // 滑动取消：丢弃录音，不识别不发送
      void rec.stop().catch(() => {}).finally(() => { handlingRef.current = false })
      showTip('已取消发送')
      return
    }
    setMicBusy(true)
    void (async () => {
      try {
        const blob = await rec.stop()
        if (!blob) {
          showTip('没有听到声音，请重新说话')
          return
        }
        const text = await transcribeAudio(blob)
        if (text) {
          if (voiceAutoSend) onSend(text)
          else onChange(text)
        } else {
          showTip('没有识别到内容，请重试')
        }
      } catch (e) {
        showTip((e as Error).message || '识别失败')
      } finally {
        handlingRef.current = false
        setMicBusy(false)
      }
    })()
  }

  const onMicUp = () => {
    if (!rec.recording || micBusy) return
    finishRecording(cancelRef.current)
  }

  const onMicCancel = () => {
    // 系统打断（pointercancel）：静默丢弃，不触发识别
    if (!rec.recording) return
    setHint(false)
    setCancelHint(false)
    cancelRef.current = false
    void rec.stop().catch(() => {})
  }

  return (
    <>
      {tip && <Tip>🎙 {tip}</Tip>}
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
          <MicWrap>
            <MicButton
              $recording={rec.recording}
              $cancel={cancelHint}
              $busy={micBusy}
              disabled={disabled || micBusy}
              onPointerDown={onMicDown}
              onPointerMove={onMicMove}
              onPointerUp={onMicUp}
              onPointerCancel={onMicCancel}
              aria-label={rec.recording ? '松开发送，上滑取消' : '按住说话'}
              title={voiceAutoSend ? '按住说话，上滑取消' : '按住说话，上滑取消，松开填入输入框'}
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
            {hint && (
              <RecordHint $cancel={cancelHint}>
                {cancelHint ? '松开取消' : '松开发送 · 上滑取消'}
              </RecordHint>
            )}
          </MicWrap>
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
