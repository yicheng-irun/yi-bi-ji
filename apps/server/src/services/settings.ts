import { AppSetting } from '../db/models.js'
import { env } from '../env.js'

export interface Settings {
  aiBaseURL: string
  aiApiKey: string
  aiModel: string
  reasoningEffort: string
  backupType: string
  backupHost: string
  backupPort: string
  backupUser: string
  backupPassword: string
  backupDatabase: string
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
    backupType: cache.backupType ?? 'mysql',
    backupHost: cache.backupHost ?? '',
    backupPort: cache.backupPort ?? '3306',
    backupUser: cache.backupUser ?? '',
    backupPassword: cache.backupPassword ?? '',
    backupDatabase: cache.backupDatabase ?? '',
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
