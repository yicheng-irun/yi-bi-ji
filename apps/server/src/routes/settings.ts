import { Hono } from 'hono'
import { generateText } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { getSettings, updateSettings } from '../services/settings.js'

export const settingsRoutes = new Hono()

settingsRoutes.get('/', async (c) => c.json(getSettings()))

settingsRoutes.put('/', async (c) => {
  const body = await c.req.json<{
    aiBaseURL?: string
    aiApiKey?: string
    aiModel?: string
    reasoningEffort?: string
  }>()
  const clean: Record<string, string> = {}
  if (typeof body.aiBaseURL === 'string' && body.aiBaseURL.trim()) clean.aiBaseURL = body.aiBaseURL.trim()
  if (typeof body.aiApiKey === 'string') clean.aiApiKey = body.aiApiKey.trim()
  if (typeof body.aiModel === 'string' && body.aiModel.trim()) clean.aiModel = body.aiModel.trim()
  if (typeof body.reasoningEffort === 'string') clean.reasoningEffort = body.reasoningEffort.trim()
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
