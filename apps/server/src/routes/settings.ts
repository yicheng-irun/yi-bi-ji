import { Hono } from 'hono'
import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { getSettings, updateSettings, type Settings } from '../services/settings.js'

export const settingsRoutes = new Hono()

settingsRoutes.get('/', async (c) => c.json(getSettings()))

settingsRoutes.put('/', async (c) => {
  const body = await c.req.json<Partial<Settings>>()
  const clean: Record<string, string> = {}
  const keys: (keyof Settings)[] = [
    'aiBaseURL', 'aiApiKey', 'aiModel', 'reasoningEffort', 'aiTools', 'aiSubagentTools',
    'backupType', 'backupPath', 'backupHost', 'backupPort', 'backupUser', 'backupPassword', 'backupDatabase',
  ]
  for (const key of keys) {
    const v = body[key]
    if (typeof v === 'string') clean[key] = v.trim()
  }
  return c.json(await updateSettings(clean))
})

settingsRoutes.post('/test', async (c) => {
  const s = getSettings()
  if (!s.aiBaseURL) return c.json({ ok: false, error: '未配置 Base URL' }, 400)
  const provider = createOpenAICompatible({ name: 'custom', baseURL: s.aiBaseURL, apiKey: s.aiApiKey })
  try {
    const r = await generateText({ model: provider(s.aiModel), prompt: 'ping', maxOutputTokens: 8 })
    return c.json({ ok: true, text: r.text.trim() || '(空响应)' })
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message }, 400)
  }
})
