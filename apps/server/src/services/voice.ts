import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { getSettings } from './settings.js'
import { env } from '../env.js'

export class VoiceError extends Error {}

interface DashScopeChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>
  }
}

function extractText(content: string | Array<{ type?: string; text?: string }> | undefined): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text as string)
      .join('')
  }
  return ''
}

/** 语音识别：把音频（base64 + mime）转成文字。当前实现走阿里云百炼 DashScope OpenAI 兼容接口。 */
export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const s = getSettings()
  if (!s.voiceApiKey) throw new VoiceError('未配置语音 API Key（设置 → 语音）')
  const base = s.voiceAsrUrl.replace(/\/+$/, '')
  const dataUri = `data:${mimeType};base64,${audioBase64}`
  const url = `${base}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.voiceApiKey}`,
    },
    body: JSON.stringify({
      model: s.voiceAsrModel || 'qwen3-asr-flash',
      messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: dataUri } }] }],
      stream: false,
      asr_options: {
        enable_itn: false,
        ...(s.voiceLang ? { language: s.voiceLang } : {}),
      },
    }),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 500)
    throw new VoiceError(
      `语音识别失败（${res.status}）：${errText}。若提示 url error / InvalidParameter，请确认「设置 → 语音」里的 ASR 地址用的是百炼控制台展示的工作空间地址（形如 https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1），当前为 ${base}`,
    )
  }
  const json = (await res.json()) as { choices?: DashScopeChoice[] }
  const text = extractText(json.choices?.[0]?.message?.content).trim()
  if (!text) throw new VoiceError('语音识别返回为空，请重试或检查音频格式')
  return text
}

/** 语音合成缓存文件路径：按 文本+模型+音色 哈希，同内容只合成一次，落盘到 dataDir/voice-cache/ */
function ttsCachePath(text: string): string | null {
  const s = getSettings()
  const key = crypto
    .createHash('sha256')
    .update([text, s.voiceTtsModel, s.voiceTtsVoice].join('|'))
    .digest('hex')
  return path.join(env.dataDir, 'voice-cache', `${key}.mp3`)
}

/** 语音合成：把文字转成音频（返回 MP3 二进制与 Content-Type）。走 DashScope 非实时语音合成 HTTP API，带磁盘缓存。 */
export async function synthesizeSpeech(text: string): Promise<{ data: Buffer; contentType: string }> {
  const s = getSettings()
  if (!s.voiceApiKey) throw new VoiceError('未配置语音 API Key（设置 → 语音）')

  const cachePath = ttsCachePath(text)
  if (cachePath) {
    try {
      const cached = fs.readFileSync(cachePath)
      if (cached.byteLength > 0) return { data: cached, contentType: 'audio/mpeg' }
    } catch {
      /* 缓存未命中 */
    }
  }

  const url = s.voiceTtsUrl
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${s.voiceApiKey}`,
    },
    body: JSON.stringify({
      model: s.voiceTtsModel || 'qwen-audio-3.0-tts-flash',
      input: {
        text,
        voice: s.voiceTtsVoice || 'longanhuan_v3.6',
        format: 'mp3',
        sample_rate: 48000,
      },
    }),
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 500)
    throw new VoiceError(
      `语音合成失败（${res.status}）：${errText}。若提示 url error / InvalidParameter：确认 TTS 地址是完整接口（.../api/v1/services/audio/tts/SpeechSynthesizer）、模型名在 cosyvoice-v2 / qwen-audio-3.0-tts-flash 等列表内、音色与控制台列表一致`,
    )
  }
  const json = (await res.json().catch(() => null)) as { output?: { audio?: { url?: string } } } | null
  const audioUrl = json?.output?.audio?.url
  if (!audioUrl) throw new VoiceError('语音合成返回中没有音频地址，请检查响应')
  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) throw new VoiceError(`下载音频失败（${audioRes.status}）`)
  const data = Buffer.from(await audioRes.arrayBuffer())
  if (data.byteLength === 0) throw new VoiceError('语音合成返回为空')
  if (cachePath) {
    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true })
      fs.writeFileSync(cachePath, data)
    } catch (e) {
      console.error('写入语音缓存失败', (e as Error).message)
    }
  }
  const contentType = audioRes.headers.get('content-type') ?? 'audio/mpeg'
  return { data, contentType }
}
