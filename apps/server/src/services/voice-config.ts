import type { Settings } from './settings.js'

/** 通用语音接口配置：ASR（语音转文字）端点 */
export interface VoiceAsrConfig {
  url: string
  method?: string
  /** 请求头，值支持 {{apiKey}} 等占位符 */
  headers?: Record<string, string>
  /** multipart=表单文件上传（默认）；json=body 模板 */
  format?: 'multipart' | 'json'
  /** multipart 时的文件字段名，默认 file */
  fileField?: string
  /** json 格式时为 body 模板（支持占位符）；multipart 时为额外表单字段 */
  body?: unknown
  /** 从 JSON 响应取识别文本的点路径，默认 text；取到数组时拼接各项 text */
  textPath?: string
  timeoutMs?: number
}

/** 通用语音接口配置：TTS（文字转语音）端点 */
export interface VoiceTtsConfig {
  url: string
  method?: string
  headers?: Record<string, string>
  /** body 模板，支持 {{text}} {{apiKey}} 占位符 */
  body?: unknown
  /** binary=响应直接是音频（默认）；json=需按 audioPath 取字段 */
  responseType?: 'binary' | 'json'
  /** responseType=json 时音频字段点路径；值以 http(s):// 开头则二次下载，否则按 base64 解码 */
  audioPath?: string
  timeoutMs?: number
}

/** 一份语音配置档案：名字唯一，ASR/TTS 可只配其一；apiKey 供 {{apiKey}} 占位符，无鉴权服务不填 */
export interface VoiceProfile {
  name: string
  apiKey?: string
  asr?: VoiceAsrConfig
  tts?: VoiceTtsConfig
}

export class VoiceError extends Error {}

/** 把阿里云百炼（DashScope）的旧字段配置推导成一份档案（启动迁移写入 voiceProfiles 的内容） */
export function aliyunVoiceProfile(s: Settings): VoiceProfile {
  const asrBase = s.voiceAsrUrl.replace(/\/+$/, '')
  return {
    name: '阿里云百炼',
    asr: {
      url: `${asrBase}/chat/completions`,
      method: 'POST',
      headers: { Authorization: 'Bearer {{apiKey}}' },
      format: 'json',
      body: {
        model: s.voiceAsrModel || 'qwen3-asr-flash',
        messages: [
          { role: 'user', content: [{ type: 'input_audio', input_audio: { data: '{{audioDataUri}}' } }] },
        ],
        stream: false,
        asr_options: {
          enable_itn: false,
          ...(s.voiceLang ? { language: s.voiceLang } : {}),
        },
      },
      textPath: 'choices.0.message.content',
      timeoutMs: 120000,
    },
    tts: {
      url: s.voiceTtsUrl,
      method: 'POST',
      headers: { Authorization: 'Bearer {{apiKey}}' },
      body: {
        model: s.voiceTtsModel || 'qwen-audio-3.0-tts-flash',
        input: {
          text: '{{text}}',
          voice: s.voiceTtsVoice || 'longanhuan_v3.6',
          format: 'mp3',
          sample_rate: 48000,
        },
      },
      responseType: 'json',
      audioPath: 'output.audio.url',
      timeoutMs: 120000,
    },
  }
}

export function parseVoiceProfiles(raw: string): VoiceProfile[] {
  if (!raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((p): p is VoiceProfile => !!p && typeof p === 'object' && typeof p.name === 'string')
  } catch {
    throw new VoiceError('语音配置档案不是合法 JSON（设置 → 语音）')
  }
}

/** 当前激活的档案：按 voiceActiveProfile 名字匹配，落空时取第一份 */
function pickActiveProfile(s: Settings): VoiceProfile {
  const profiles = parseVoiceProfiles(s.voiceProfiles)
  if (!profiles.length) throw new VoiceError('未配置语音服务（设置 → 语音）')
  return profiles.find((p) => p.name === s.voiceActiveProfile) ?? profiles[0]
}

function checkKey(p: VoiceProfile, endpointJson: string): string {
  const apiKey = p.apiKey?.trim() ?? ''
  if (endpointJson.includes('{{apiKey}}') && !apiKey) {
    throw new VoiceError(`语音配置「${p.name}」需要 API Key（设置 → 语音 → 编辑该配置）`)
  }
  return apiKey
}

/** 取某份档案的 ASR 端点配置与 API Key；未配置时抛 VoiceError */
export function profileAsrEndpoint(p: VoiceProfile): { cfg: VoiceAsrConfig; apiKey: string } {
  if (!p.asr?.url?.trim()) throw new VoiceError(`语音配置「${p.name}」未配置 ASR 接口（设置 → 语音）`)
  return { cfg: p.asr, apiKey: checkKey(p, JSON.stringify(p.asr)) }
}

/** 取某份档案的 TTS 端点配置与 API Key；未配置时抛 VoiceError */
export function profileTtsEndpoint(p: VoiceProfile): { cfg: VoiceTtsConfig; apiKey: string } {
  if (!p.tts?.url?.trim()) throw new VoiceError(`语音配置「${p.name}」未配置 TTS 接口（设置 → 语音）`)
  return { cfg: p.tts, apiKey: checkKey(p, JSON.stringify(p.tts)) }
}

/** 解析当前生效（激活档案）的 ASR 端点配置与 API Key；未配置时抛 VoiceError */
export function resolveAsrEndpoint(s: Settings): { cfg: VoiceAsrConfig; apiKey: string } {
  return profileAsrEndpoint(pickActiveProfile(s))
}

/** 解析当前生效（激活档案）的 TTS 端点配置与 API Key；未配置时抛 VoiceError */
export function resolveTtsEndpoint(s: Settings): { cfg: VoiceTtsConfig; apiKey: string } {
  return profileTtsEndpoint(pickActiveProfile(s))
}

/** 语音输入（ASR）是否可用：决定聊天框是否显示麦克风按钮 */
export function isVoiceEnabled(s: Settings): boolean {
  try {
    return !!resolveAsrEndpoint(s).cfg.url
  } catch {
    return false
  }
}

export type VoiceVars = Record<string, string>

/** 深度渲染模板：字符串中的 {{var}} 占位符替换为变量值 */
export function renderTemplate(tpl: unknown, vars: VoiceVars): unknown {
  if (typeof tpl === 'string') {
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, name: string) => vars[name] ?? '')
  }
  if (Array.isArray(tpl)) return tpl.map((v) => renderTemplate(v, vars))
  if (tpl && typeof tpl === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(tpl)) out[k] = renderTemplate(v, vars)
    return out
  }
  return tpl
}

/** 按点路径从对象取值（支持数字下标），取不到返回 undefined */
export function getByPath(obj: unknown, path: string): unknown {
  if (!path) return undefined
  let cur = obj
  for (const key of path.split('.')) {
    if (cur === null || cur === undefined) return undefined
    cur = Array.isArray(cur) ? cur[Number(key)] : (cur as Record<string, unknown>)[key]
  }
  return cur
}
