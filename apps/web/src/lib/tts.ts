import { api } from '../api/client'
import { isTextUIPart, type UIMessage } from 'ai'

/**
 * 从一段文本中提取朗读片段：优先取 AI 用 ```朗读 代码块标记的内容（可多个），
 * 没有标记时回退为整段文本。
 */
export function extractSpeakSegments(text: string): string[] {
  const segs: string[] = []
  const re = /```朗读[^\S\n]*\n?([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const s = m[1].trim()
    if (s) segs.push(s)
  }
  return segs.length > 0 ? segs : [text]
}

/** 提取消息中可朗读的文本（只取正文文本部分，跳过工具卡片/思考过程） */
export function extractSpeakableText(message: UIMessage): string {
  return message.parts
    .filter((p) => isTextUIPart(p) && p.text)
    .flatMap((p) => extractSpeakSegments((p as { text: string }).text))
    .join('\n')
}

interface Current {
  audio: HTMLAudioElement
  url: string
}

let current: Current | null = null

/** 会话内内存缓存：同一段文本的合成音频只请求一次（对象 URL），LRU 上限避免内存膨胀 */
const urlCache = new Map<string, string>()
const MAX_URL_CACHE = 60

function cachedUrl(text: string): string | null {
  const hit = urlCache.get(text)
  if (hit) {
    urlCache.delete(text)
    urlCache.set(text, hit)
    return hit
  }
  return null
}

function rememberUrl(text: string, url: string) {
  urlCache.set(text, url)
  while (urlCache.size > MAX_URL_CACHE) {
    const oldest = urlCache.keys().next().value
    if (oldest === undefined) break
    const oldUrl = urlCache.get(oldest)
    urlCache.delete(oldest)
    if (oldUrl) URL.revokeObjectURL(oldUrl)
  }
}

function cleanup() {
  // 对象 URL 由缓存统一管理（LRU 淘汰时回收），播放结束不 revoke，避免缓存失效
  current = null
}

/** 停止当前朗读（如果有） */
export function stopSpeech() {
  if (current) {
    current.audio.pause()
    cleanup()
  }
}

/** 朗读文字：优先用缓存，否则调用 /api/voice/speech 合成 MP3 并播放，Promise 在播放结束时 resolve。 */
export async function speakText(text: string): Promise<void> {
  stopSpeech()
  let url = cachedUrl(text)
  if (!url) {
    const blob = await api.speech(text)
    url = URL.createObjectURL(blob)
    rememberUrl(text, url)
  }
  const audio = new Audio(url)
  current = { audio, url }
  await new Promise<void>((resolve) => {
    const done = () => {
      cleanup()
      resolve()
    }
    audio.onended = done
    audio.onerror = () => {
      cleanup()
      resolve()
    }
    audio.play().catch(() => {
      cleanup()
      resolve()
    })
  })
}
