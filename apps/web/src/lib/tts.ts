import { api } from '../api/client'
import { isTextUIPart, type UIMessage } from 'ai'

/** 只取 ```朗读 代码块标记的内容（可多个），没有标记返回空数组；未闭合的块按渲染规则取到文末 */
export function markedSpeakSegments(text: string): string[] {
  const segs: string[] = []
  const re = /```朗读[^\S\n]*\n?([\s\S]*?)(?:```|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const s = m[1].trim()
    if (s) segs.push(s)
  }
  return segs
}

/** 自动朗读用：只取 ```朗读 标记的内容，没标记返回 ''（不朗读） */
export function extractSpeakableText(message: UIMessage): string {
  return message.parts
    .filter((p) => isTextUIPart(p) && p.text)
    .flatMap((p) => markedSpeakSegments((p as { text: string }).text))
    .join('\n')
}

interface Current {
  audio: HTMLAudioElement
  url: string
  /** 结束播放并 resolve 等待中的 Promise（停止/自然结束/出错共用） */
  finish: () => void
}

let current: Current | null = null
/** 代数计数：每次停止/新朗读都递增，慢合成返回后若已被取代则放弃播放（防双音频并发） */
let epoch = 0

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

/** 全局朗读状态：正在朗读（含合成等待中）的文本，驱动所有朗读按钮的 ⏹/🔊 显示 */
let playingText: string | null = null
type Listener = () => void
const listeners = new Set<Listener>()

function setPlaying(text: string | null) {
  playingText = text
  listeners.forEach((l) => l())
}

export function subscribeSpeech(l: Listener): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export function getPlayingText(): string | null {
  return playingText
}

/** 停止当前朗读（如果有），等待中的 speakText Promise 一并 resolve */
export function stopSpeech() {
  epoch++
  setPlaying(null)
  current?.finish()
}

/** 朗读文字：优先用缓存，否则调用 /api/voice/speech 合成 MP3 并播放，Promise 在播放结束或被停止时 resolve。 */
export async function speakText(text: string): Promise<void> {
  stopSpeech()
  const my = epoch
  setPlaying(text)
  let url = cachedUrl(text)
  if (!url) {
    let blob: Blob
    try {
      blob = await api.speech(text)
    } catch (e) {
      if (my === epoch) setPlaying(null)
      throw e
    }
    if (my !== epoch) return
    url = URL.createObjectURL(blob)
    rememberUrl(text, url)
  }
  const audio = new Audio(url)
  await new Promise<void>((resolve) => {
    const done = () => {
      audio.pause()
      if (current?.finish === done) {
        cleanup()
        setPlaying(null)
      }
      resolve()
    }
    current = { audio, url: url!, finish: done }
    audio.onended = done
    audio.onerror = done
    audio.play().catch(done)
  })
}
