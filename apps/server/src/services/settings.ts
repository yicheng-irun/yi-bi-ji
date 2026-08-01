import { AppSetting } from '../db/models.js'
import { env } from '../env.js'

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
  /** 语音服务：后端类型（aliyun=阿里云百炼 DashScope，默认） */
  voiceProvider: string
  /** 语音服务：API Key（DashScope 的 DASHSCOPE_API_KEY） */
  voiceApiKey: string
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
}

export function getSettings(): Settings {
  return {
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
    voiceApiKey: cache.voiceApiKey ?? env.voiceApiKey ?? '',
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
