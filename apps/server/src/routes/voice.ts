import { Hono } from 'hono'
import { synthesizeSpeech, transcribeAudio, VoiceError } from '../services/voice.js'
import { getSettings } from '../services/settings.js'

export const voiceRoutes = new Hono()

const errorJson = (e: unknown) => ({ error: e instanceof VoiceError ? e.message : (e as Error).message })

voiceRoutes.post('/transcribe', async (c) => {
  const s = getSettings()
  if (!s.voiceApiKey) return c.json({ error: '未配置语音服务（设置 → 语音）' }, 400)
  const buf = await c.req.arrayBuffer()
  if (!buf.byteLength) return c.json({ error: '空音频' }, 400)
  const contentType = c.req.header('content-type') || 'audio/wav'
  try {
    const text = await transcribeAudio(Buffer.from(buf).toString('base64'), contentType)
    return c.json({ text })
  } catch (e) {
    return c.json(errorJson(e), 400)
  }
})

voiceRoutes.post('/speech', async (c) => {
  const body = await c.req.json<{ text?: string }>().catch(() => ({}) as { text?: string })
  const text = body.text?.trim()
  if (!text) return c.json({ error: 'text is required' }, 400)
  try {
    const { data, contentType } = await synthesizeSpeech(text)
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': contentType, 'Content-Length': String(data.byteLength) },
    })
  } catch (e) {
    return c.json(errorJson(e), 400)
  }
})

voiceRoutes.post('/test', async (c) => {
  try {
    await synthesizeSpeech('语音连接测试')
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ ok: false, error: e instanceof VoiceError ? e.message : (e as Error).message }, 400)
  }
})
