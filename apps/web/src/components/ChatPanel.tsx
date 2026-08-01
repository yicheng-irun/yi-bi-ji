import { useEffect, useMemo, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { api, type Thread } from '../api/client'
import { ContextBar } from './chat/styles'
import { MessageList } from './chat/MessageList'
import { ChatInput } from './chat/ChatInput'
import { extractSpeakableText, speakText } from '../lib/tts'

interface ChatPanelProps {
  threadId: string
  currentNoteId?: number
  onThreadCreated?: (thread: Thread) => void
}

export function ChatPanel({ threadId, currentNoteId, onThreadCreated }: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [contextInfo, setContextInfo] = useState<{ messageCount: number; estimatedTokens: number } | null>(null)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceAutoSend, setVoiceAutoSend] = useState(true)
  const [voiceAutoSpeak, setVoiceAutoSpeak] = useState(false)

  const threadIdRef = useRef(threadId)
  threadIdRef.current = threadId
  const noteIdRef = useRef(currentNoteId)
  noteIdRef.current = currentNoteId
  const onThreadCreatedRef = useRef(onThreadCreated)
  onThreadCreatedRef.current = onThreadCreated
  const voiceAutoSpeakRef = useRef(voiceAutoSpeak)
  voiceAutoSpeakRef.current = voiceAutoSpeak
  const autoSpeakTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.getSettings().then((s) => {
      setVoiceEnabled(!!s.voiceApiKey.trim())
      setVoiceAutoSend(s.voiceAutoSend !== '0')
      setVoiceAutoSpeak(s.voiceAutoSpeak === '1')
    }).catch(() => {})
  }, [])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat/threads',
        prepareSendMessagesRequest: async ({ messages, headers, credentials }) => {
          let tid = threadIdRef.current
          if (!tid) {
            const t = await api.createThread(undefined, noteIdRef.current)
            tid = t.id
            threadIdRef.current = t.id
            onThreadCreatedRef.current?.(t)
          }
          return {
            api: `/api/chat/threads/${tid}/stream`,
            headers,
            credentials,
            body: { messages: messages.slice(-1) },
          }
        },
      }),
    [],
  )

  const refreshContext = (tid: string) => {
    if (!tid) { setContextInfo(null); return }
    api.getContext(tid)
      .then((c) => { if (threadIdRef.current === tid) setContextInfo(c) })
      .catch(() => {})
  }

  const { messages, sendMessage, setMessages, status, error } = useChat({
    transport,
    onFinish: ({ message }) => {
      refreshContext(threadIdRef.current)
      if (!voiceAutoSpeakRef.current || !message) return
      // agent 按步骤产出多条 assistant 消息，只朗读最终回复（用防抖只留最后一条）
      const text = extractSpeakableText(message)
      if (!text.trim()) return
      if (autoSpeakTimer.current) clearTimeout(autoSpeakTimer.current)
      autoSpeakTimer.current = setTimeout(() => {
        autoSpeakTimer.current = null
        void speakText(text).catch(() => {})
      }, 600)
    },
    onError: (e) => console.error(e),
  })

  const streaming = status === 'submitted' || status === 'streaming'
  const streamingRef = useRef(streaming)
  streamingRef.current = streaming

  useEffect(() => {
    refreshContext(threadId)
    if (!threadId) { setMessages([]); return }
    if (streamingRef.current) return
    api.getMessages(threadId).then((res) => {
      if (streamingRef.current) return
      setMessages(res.messages)
    }).catch(console.error)
  }, [threadId, setMessages])

  const send = (text?: string) => {
    const t = (text ?? input).trim()
    if (!t || streaming) return
    setInput('')
    if (text !== undefined) {
      void sendMessage({ text: t, metadata: { inputMethod: 'voice' } })
    } else {
      void sendMessage({ text: t })
    }
  }

  return (
    <>
      <MessageList messages={messages} streaming={streaming} status={status} error={error} />
      {contextInfo && (
        <ContextBar>
          上下文 ~{contextInfo.estimatedTokens >= 1000
            ? `${(contextInfo.estimatedTokens / 1000).toFixed(1)}k`
            : contextInfo.estimatedTokens} tokens · {contextInfo.messageCount} 条消息
        </ContextBar>
      )}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={send}
        disabled={streaming}
        voiceEnabled={voiceEnabled}
        voiceAutoSend={voiceAutoSend}
        transcribeAudio={api.transcribeAudio}
      />
    </>
  )
}
