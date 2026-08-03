import { Hono } from 'hono'
import { synthesizeSpeech, transcribeAudio, VoiceError } from '../services/voice.js'
import type { VoiceProfile } from '../services/voice-config.js'

export const voiceRoutes = new Hono()

const errorJson = (e: unknown) => ({ error: e instanceof VoiceError ? e.message : (e as Error).message })

voiceRoutes.post('/transcribe', async (c) => {
  const contentType = c.req.header('content-type') || 'audio/wav'
  try {
    // JSON 形式：{ audioBase64, mimeType, profile? }，profile 用于设置页测试指定档案（含未保存的改动）
    if (contentType.includes('application/json')) {
      const body = await c.req
        .json<{ audioBase64?: string; mimeType?: string; profile?: VoiceProfile }>()
        .catch(() => null)
      if (!body?.audioBase64) return c.json({ error: '空音频' }, 400)
      const text = await transcribeAudio(body.audioBase64, body.mimeType || 'audio/wav', body.profile)
      return c.json({ text })
    }
    const buf = await c.req.arrayBuffer()
    if (!buf.byteLength) return c.json({ error: '空音频' }, 400)
    const text = await transcribeAudio(Buffer.from(buf).toString('base64'), contentType)
    return c.json({ text })
  } catch (e) {
    return c.json(errorJson(e), 400)
  }
})

voiceRoutes.post('/speech', async (c) => {
  const body = await c.req
    .json<{ text?: string; profile?: VoiceProfile }>()
    .catch(() => ({}) as { text?: string; profile?: VoiceProfile })
  const text = body.text?.trim()
  if (!text) return c.json({ error: 'text is required' }, 400)
  try {
    const { data, contentType } = await synthesizeSpeech(text, body.profile)
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
