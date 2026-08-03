import { AppSetting } from '../db/models.js'
import { env } from '../env.js'
import { aliyunVoiceProfile, isVoiceEnabled, type VoiceProfile } from './voice-config.js'

export interface Settings {
  aiBaseURL: string
  aiApiKey: string
  aiModel: string
  reasoningEffort: string
  /** 主代理可用工具，逗号分隔；'*' 或不配置 = 全部可用 */
  aiTools: string
  /** 调研子代理可用工具，逗号分隔；'*' 或不配置 = 全部可用 */
  aiSubagentTools: string
  /** MCP 服务器配置 JSON（数组），用于扩展 agent 工具能力 */
  mcpServers: string
  /** 浏览器控制（CDP）：是否启用 browser_* 工具，'1' 启用 / '0' 或空禁用 */
  browserCdpEnabled: string
  /** 浏览器控制（CDP）：本机/远程浏览器调试地址，如 http://192.168.1.10:9222 */
  browserCdpUrl: string
  backupType: string
  backupPath: string
  backupHost: string
  backupPort: string
  backupUser: string
  backupPassword: string
  backupDatabase: string
  /** 语音服务：后端类型（aliyun=阿里云百炼 DashScope；已被 voiceProfiles 取代，仅旧库兼容读取） */
  voiceProvider: string
  /** 语音服务：配置档案列表 JSON（VoiceProfile[]，每份含 name + 可选 apiKey + asr/tts 端点配置） */
  voiceProfiles: string
  /** 语音服务：当前激活的档案名 */
  voiceActiveProfile: string
  /** 语音服务：ASR 是否可用（计算字段，不落库），'1' 可用 */
  voiceEnabled: string
  /** 语音服务：ASR 接口地址（OpenAI 兼容 chat/completions 的 base，如 DashScope compatible-mode） */
  voiceAsrUrl: string
  /** 语音服务：ASR 模型名，如 qwen3-asr-flash */
  voiceAsrModel: string
  /** 语音服务：TTS 接口地址（如 DashScope CosyVoice text2audio generation） */
  voiceTtsUrl: string
  /** 语音服务：TTS 模型名，如 cosyvoice-v2 */
  voiceTtsModel: string
  /** 语音服务：TTS 音色名，如 longxiaochun_pub */
  voiceTtsVoice: string
  /** 语音服务：识别语种，如 zh */
  voiceLang: string
  /** 语音服务：AI 回复自动朗读，'1' 启用 / '0' 关闭 */
  voiceAutoSpeak: string
  /** 语音服务：推按说话松开后是否直接发送（'1' 直发 / '0' 填入输入框待编辑） */
  voiceAutoSend: string
}

const cache: Record<string, string> = {}

export async function initSettingsCache() {
  const rows = await AppSetting.findAll()
  for (const r of rows) cache[r.key] = r.value
  // 全局 voiceApiKey（含旧 .env VOICE_API_KEY）已废弃：挪入引用了 {{apiKey}} 但还没填 Key 的档案，随后删除
  const legacyKey = (cache.voiceApiKey ?? process.env.VOICE_API_KEY ?? '').trim()
  if (cache.voiceProfiles === undefined) {
    // 旧库迁移：没有 voiceProfiles 时，把当前生效的百炼（旧 voice* 字段）配置推导成一份档案落库
    const profile = aliyunVoiceProfile(getSettings())
    if (legacyKey) profile.apiKey = legacyKey
    await updateSettings({
      voiceProfiles: JSON.stringify([profile], null, 2),
      voiceActiveProfile: profile.name,
    })
  } else if (legacyKey) {
    try {
      const profiles = JSON.parse(cache.voiceProfiles) as VoiceProfile[]
      let changed = false
      for (const p of profiles) {
        if (p && typeof p === 'object' && !p.apiKey?.trim() && JSON.stringify(p).includes('{{apiKey}}')) {
          p.apiKey = legacyKey
          changed = true
        }
      }
      if (changed) await updateSettings({ voiceProfiles: JSON.stringify(profiles, null, 2) })
    } catch {
      /* 非法 JSON 跳过 */
    }
  }
  if (cache.voiceApiKey !== undefined) await clearSettingsKey('voiceApiKey')
}

export function getSettings(): Settings {
  const s: Omit<Settings, 'voiceEnabled'> = {
    aiBaseURL: cache.aiBaseURL ?? env.aiBaseURL,
    aiApiKey: cache.aiApiKey ?? env.aiApiKey,
    aiModel: cache.aiModel ?? env.aiModel,
    reasoningEffort: cache.reasoningEffort ?? '',
    aiTools: cache.aiTools ?? '*',
    aiSubagentTools: cache.aiSubagentTools ?? '*',
    mcpServers: cache.mcpServers ?? '',
    browserCdpEnabled: cache.browserCdpEnabled ?? (env.browserCdpUrl ? '1' : '0'),
    browserCdpUrl: cache.browserCdpUrl ?? env.browserCdpUrl ?? 'http://127.0.0.1:9222',
    backupType: cache.backupType ?? 'sqlite',
    backupPath: cache.backupPath ?? '',
    backupHost: cache.backupHost ?? '',
    backupPort: cache.backupPort ?? '3306',
    backupUser: cache.backupUser ?? '',
    backupPassword: cache.backupPassword ?? '',
    backupDatabase: cache.backupDatabase ?? '',
    voiceProvider: cache.voiceProvider ?? 'aliyun',
    voiceProfiles: cache.voiceProfiles ?? '',
    voiceActiveProfile: cache.voiceActiveProfile ?? '',
    voiceAsrUrl:
      cache.voiceAsrUrl ??
      (env.voiceWorkspaceId
        ? `https://${env.voiceWorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
        : 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
    voiceAsrModel: cache.voiceAsrModel ?? 'qwen3-asr-flash',
    voiceTtsUrl:
      cache.voiceTtsUrl ??
      (env.voiceWorkspaceId
        ? `https://${env.voiceWorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer`
        : 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer'),
    voiceTtsModel: cache.voiceTtsModel ?? 'qwen-audio-3.0-tts-flash',
    voiceTtsVoice: cache.voiceTtsVoice ?? 'longanhuan_v3.6',
    voiceLang: cache.voiceLang ?? 'zh',
    voiceAutoSpeak: cache.voiceAutoSpeak ?? '0',
    voiceAutoSend: cache.voiceAutoSend ?? '1',
  }
  return { ...s, voiceEnabled: isVoiceEnabled(s as Settings) ? '1' : '0' }
}

export async function updateSettings(partial: Partial<Settings>) {
  for (const [key, value] of Object.entries(partial)) {
    if (value === undefined) continue
    cache[key] = value
    const row = await AppSetting.findByPk(key)
    if (row) {
      row.value = value
      await row.save()
    } else {
      await AppSetting.create({ key, value })
    }
  }
  return getSettings()
}

export async function clearSettingsKey(key: string) {
  delete cache[key]
  await AppSetting.destroy({ where: { key } })
  return getSettings()
}
