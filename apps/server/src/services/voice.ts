import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { getSettings } from './settings.js'
import { env } from '../env.js'
import {
  getByPath,
  profileAsrEndpoint,
  profileTtsEndpoint,
  renderTemplate,
  resolveAsrEndpoint,
  resolveTtsEndpoint,
  VoiceError,
  type VoiceAsrConfig,
  type VoiceProfile,
  type VoiceTtsConfig,
  type VoiceVars,
} from './voice-config.js'

export { VoiceError }

const MIME_EXT: Record<string, string> = {
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/flac': 'flac',
  'audio/aac': 'aac',
  'audio/pcm': 'pcm',
}

function extFromContentType(ct: string): string {
  const base = ct.split(';')[0].trim().toLowerCase()
  return MIME_EXT[base] ?? 'audio'
}

function audioVars(vars: VoiceVars): VoiceVars {
  return vars
}

function baseHeaders(cfg: { headers?: Record<string, string> }, vars: VoiceVars): Record<string, string> {
  return (renderTemplate(cfg.headers ?? {}, vars) ?? {}) as Record<string, string>
}

async function assertOk(res: Response, what: string): Promise<void> {
  if (res.ok) return
  const errText = (await res.text()).slice(0, 500)
  throw new VoiceError(`${what}失败（${res.status}）：${errText}`)
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map((p) => {
        if (typeof p === 'string') return p
        if (p && typeof p === 'object' && typeof (p as { text?: unknown }).text === 'string') {
          return (p as { text: string }).text
        }
        return ''
      })
      .join('')
  }
  return ''
}

/** 语音识别核心：按给定 ASR 端点配置，把音频（base64 + mime）转成文字 */
async function transcribeCore(cfg: VoiceAsrConfig, apiKey: string, audioBase64: string, mimeType: string): Promise<string> {
  const vars = audioVars({
    apiKey,
    audioBase64,
    mimeType,
    audioDataUri: `data:${mimeType};base64,${audioBase64}`,
  })
  const method = cfg.method ?? 'POST'
  const timeout = AbortSignal.timeout(cfg.timeoutMs ?? 120000)

  let res: Response
  if ((cfg.format ?? 'multipart') === 'multipart') {
    const form = new FormData()
    const bytes = new Uint8Array(Buffer.from(audioBase64, 'base64'))
    const ext = extFromContentType(mimeType)
    form.append(cfg.fileField ?? 'file', new Blob([bytes], { type: mimeType }), `audio.${ext}`)
    const extra = renderTemplate(cfg.body ?? {}, vars)
    if (extra && typeof extra === 'object') {
      for (const [k, v] of Object.entries(extra)) {
        if (v === undefined || v === null) continue
        form.append(k, typeof v === 'string' ? v : JSON.stringify(v))
      }
    }
    res = await fetch(cfg.url, { method, headers: baseHeaders(cfg, vars), body: form, signal: timeout })
  } else {
    const body = renderTemplate(cfg.body ?? {}, vars)
    res = await fetch(cfg.url, {
      method,
      headers: { 'Content-Type': 'application/json', ...baseHeaders(cfg, vars) },
      body: JSON.stringify(body),
      signal: timeout,
    })
  }
  await assertOk(res, '语音识别')
  const json = (await res.json().catch(() => null)) as unknown
  const text = extractText(getByPath(json, cfg.textPath ?? 'text')).trim()
  if (!text) throw new VoiceError('语音识别返回为空，请重试或检查音频格式与 textPath 配置')
  return text
}

/** 语音识别：默认用激活档案；传 profileOverride 则用指定档案（设置页测试未保存的配置） */
export async function transcribeAudio(audioBase64: string, mimeType: string, profileOverride?: VoiceProfile): Promise<string> {
  const { cfg, apiKey } = profileOverride
    ? profileAsrEndpoint(profileOverride)
    : resolveAsrEndpoint(getSettings())
  return transcribeCore(cfg, apiKey, audioBase64, mimeType)
}

const EXT_CONTENT_TYPE: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  flac: 'audio/flac',
  aac: 'audio/aac',
  pcm: 'audio/pcm',
}

/** 语音合成缓存：按 文本+TTS 端点配置 哈希，同内容只合成一次，落盘到 dataDir/voice-cache/ */
function ttsCacheLookup(text: string, cfg: VoiceTtsConfig): { hit?: { data: Buffer; contentType: string }; write: (data: Buffer, contentType: string) => void } {
  const key = crypto
    .createHash('sha256')
    .update([text, JSON.stringify(cfg)].join('|'))
    .digest('hex')
  const dir = path.join(env.dataDir, 'voice-cache')
  let cached: { data: Buffer; contentType: string } | undefined
  try {
    const hit = fs.readdirSync(dir).find((f) => f.startsWith(`${key}.`))
    if (hit) {
      const data = fs.readFileSync(path.join(dir, hit))
      if (data.byteLength > 0) {
        const ext = hit.slice(key.length + 1)
        cached = { data, contentType: EXT_CONTENT_TYPE[ext] ?? 'audio/mpeg' }
      }
    }
  } catch {
    /* 缓存未命中 */
  }
  return {
    hit: cached,
    write: (data, contentType) => {
      try {
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, `${key}.${extFromContentType(contentType)}`), data)
      } catch (e) {
        console.error('写入语音缓存失败', (e as Error).message)
      }
    },
  }
}

/** 语音合成核心：按给定 TTS 端点配置，把文字转成音频二进制（剔除英文双引号，避免被读出） */
async function synthesizeCore(cfg: VoiceTtsConfig, apiKey: string, text: string, useCache: boolean): Promise<{ data: Buffer; contentType: string }> {
  const clean = text.replace(/"/g, '').trim()
  if (!clean) throw new VoiceError('文本为空')
  const cache = ttsCacheLookup(clean, cfg)
  if (useCache && cache.hit) return cache.hit

  const vars: VoiceVars = { apiKey, text: clean }
  const body = renderTemplate(cfg.body ?? { text: '{{text}}' }, vars)
  const res = await fetch(cfg.url, {
    method: cfg.method ?? 'POST',
    headers: { 'Content-Type': 'application/json', ...baseHeaders(cfg, vars) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(cfg.timeoutMs ?? 120000),
  })
  await assertOk(res, '语音合成')

  let data: Buffer
  let contentType: string
  if ((cfg.responseType ?? 'binary') === 'binary') {
    data = Buffer.from(await res.arrayBuffer())
    contentType = res.headers.get('content-type') ?? 'audio/wav'
  } else {
    const json = (await res.json().catch(() => null)) as unknown
    const value = getByPath(json, cfg.audioPath ?? '')
    if (typeof value !== 'string' || !value) {
      throw new VoiceError('语音合成返回中没有音频字段，请检查 audioPath 配置')
    }
    if (/^https?:\/\//.test(value)) {
      const audioRes = await fetch(value, { signal: AbortSignal.timeout(cfg.timeoutMs ?? 120000) })
      if (!audioRes.ok) throw new VoiceError(`下载音频失败（${audioRes.status}）`)
      data = Buffer.from(await audioRes.arrayBuffer())
      contentType = audioRes.headers.get('content-type') ?? 'audio/mpeg'
    } else {
      data = Buffer.from(value.replace(/^data:[^,]*,/, ''), 'base64')
      contentType = 'audio/wav'
    }
  }
  if (data.byteLength === 0) throw new VoiceError('语音合成返回为空')
  if (useCache) cache.write(data, contentType)
  return { data, contentType }
}

/** 语音合成：默认用激活档案（带磁盘缓存）；传 profileOverride 则用指定档案且跳过缓存（设置页测试未保存的配置） */
export async function synthesizeSpeech(text: string, profileOverride?: VoiceProfile): Promise<{ data: Buffer; contentType: string }> {
  const { cfg, apiKey } = profileOverride
    ? profileTtsEndpoint(profileOverride)
    : resolveTtsEndpoint(getSettings())
  return synthesizeCore(cfg, apiKey, text, !profileOverride)
}
