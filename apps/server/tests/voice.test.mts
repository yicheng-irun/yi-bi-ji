import { Hono } from 'hono'
import { serve, type ServerType } from '@hono/node-server'
import { api, check, section, BASE } from './helpers.mts'

const MOCK_PORT = 15412
const MOCK_BASE = `http://127.0.0.1:${MOCK_PORT}`

//  minimal WAV 字节（内容不重要，只验证透传）
const WAV_BYTES = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
  0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x80, 0x3e, 0x00, 0x00, 0x00, 0x7d, 0x00, 0x00,
  0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00,
])

/** 起一个 mock ASR/TTS 服务，验证通用语音适配器的各种配置形态 */
function startMockVoiceServer(): ServerType {
  const app = new Hono()

  // multipart ASR：自定义文件字段名 audio + 额外表单字段 language，嵌套响应 result.text
  app.post('/asr', async (c) => {
    const form = await c.req.formData().catch(() => null)
    if (!form) return c.json({ detail: 'bad form' }, 400)
    const file = form.get('audio')
    if (!file || typeof file === 'string') return c.json({ detail: 'missing field audio' }, 400)
    const lang = form.get('language') ?? 'none'
    return c.json({ result: { text: `mock识别(${lang}):${file.name}` } })
  })

  // json ASR：校验 Authorization 头（档案级 API Key），响应 content 为数组（自动拼接）
  app.post('/asr-json', async (c) => {
    if (c.req.header('authorization') !== 'Bearer profile-key-1') {
      return c.json({ detail: 'unauthorized' }, 401)
    }
    const body = await c.req.json<{ audio?: string }>().catch(() => ({}) as { audio?: string })
    if (!body.audio) return c.json({ detail: 'missing audio' }, 400)
    return c.json({ choices: [{ message: { content: [{ type: 'text', text: '数组' }, { type: 'text', text: '拼接' }] } }] })
  })

  // TTS：直接返回音频二进制（带调用计数，验证覆盖测试时跳过缓存）
  let binaryHits = 0
  let lastTtsText = ''
  app.post('/tts-binary', async (c) => {
    const body = await c.req.json<{ text?: string }>().catch(() => ({}) as { text?: string })
    if (!body.text) return c.json({ detail: 'empty text' }, 400)
    binaryHits++
    lastTtsText = body.text
    return new Response(new Uint8Array(WAV_BYTES), {
      headers: { 'Content-Type': 'audio/wav', 'X-Hits': String(binaryHits) },
    })
  })

  app.get('/tts-hits', () => new Response(JSON.stringify({ hits: binaryHits }), { headers: { 'Content-Type': 'application/json' } }))
  app.get('/tts-last-text', () => new Response(JSON.stringify({ text: lastTtsText }), { headers: { 'Content-Type': 'application/json' } }))

  // TTS：返回 JSON，音频字段是 URL（二次下载）
  app.post('/tts-json-url', async (c) => {
    const body = await c.req.json<{ text?: string }>().catch(() => ({}) as { text?: string })
    if (!body.text) return c.json({ detail: 'empty text' }, 400)
    return c.json({ data: { audio: `${MOCK_BASE}/mock-audio.wav` } })
  })

  // TTS：返回 JSON，音频字段是 base64
  app.post('/tts-json-b64', async (c) => {
    const body = await c.req.json<{ text?: string }>().catch(() => ({}) as { text?: string })
    if (!body.text) return c.json({ detail: 'empty text' }, 400)
    return c.json({ data: { audio_b64: WAV_BYTES.toString('base64') } })
  })

  app.get('/mock-audio.wav', () =>
    new Response(new Uint8Array(WAV_BYTES), { headers: { 'Content-Type': 'audio/wav' } }),
  )

  return serve({ fetch: app.fetch, port: MOCK_PORT })
}

interface VoiceSettings {
  voiceProfiles: string
  voiceActiveProfile: string
  voiceEnabled: string
  voiceAutoSend: string
  voiceAutoSpeak: string
}

function profileWithTts(ttsUrl: string, extra: Record<string, unknown>) {
  return [
    {
      name: 'mock语音',
      asr: {
        url: `${MOCK_BASE}/asr`,
        format: 'multipart',
        fileField: 'audio',
        body: { language: 'auto' },
        textPath: 'result.text',
      },
      tts: { url: ttsUrl, body: { text: '{{text}}' }, ...extra },
    },
  ]
}

export async function runVoiceTests() {
  section('语音服务')

  const mock = startMockVoiceServer()
  await new Promise((r) => setTimeout(r, 300))

  try {
    const cfg = (await api('/api/settings')).body as unknown as VoiceSettings

    // 启动迁移：旧库无 voiceProfiles 时自动生成「阿里云百炼」档案并激活
    let migrated: { name?: string; asr?: { url?: string } }[] = []
    try { migrated = JSON.parse(cfg.voiceProfiles) } catch { /* ignore */ }
    check(
      '启动迁移生成百炼档案并激活',
      migrated.length === 1 && migrated[0].name === '阿里云百炼' && cfg.voiceActiveProfile === '阿里云百炼'
        && typeof migrated[0].asr?.url === 'string' && migrated[0].asr.url.includes('chat/completions'),
      { profiles: cfg.voiceProfiles, active: cfg.voiceActiveProfile },
    )
    check('未配 Key 时 voiceEnabled=0', cfg.voiceEnabled === '0', cfg)

    const transcribeEmpty = await api('/api/voice/transcribe', {
      method: 'POST',
      body: new Uint8Array([1, 2, 3]),
    })
    check('百炼档案缺 Key 时 transcribe 返回 400', transcribeEmpty.status === 400, transcribeEmpty.body)

    const speechNoText = await api('/api/voice/speech', { method: 'POST', body: JSON.stringify({}) })
    check(
      'speech 缺 text 返回 400',
      speechNoText.status === 400 && String((speechNoText.body as { error?: string }).error).includes('text is required'),
      speechNoText.body,
    )

    const testUnconfigured = await api('/api/voice/test', { method: 'POST', body: '{}' })
    check('未配置时 test 返回 400', testUnconfigured.status === 400 && (testUnconfigured.body as { ok?: boolean }).ok === false, testUnconfigured.body)

    check('设置默认值（voiceAutoSend=1）', cfg.voiceAutoSend === '1', cfg)

    // 新增 mock 档案并切换激活：multipart ASR（自定义文件字段 + 嵌套 textPath）+ binary TTS
    const put = await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        voiceProfiles: JSON.stringify(profileWithTts(`${MOCK_BASE}/tts-binary`, { responseType: 'binary' })),
        voiceActiveProfile: 'mock语音',
      }),
    })
    const after = put.body as unknown as VoiceSettings
    check('保存并激活 mock 档案', after.voiceActiveProfile === 'mock语音', after)
    check('自定义档案可用时 voiceEnabled=1', after.voiceEnabled === '1', after)

    const tr = await api('/api/voice/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: new Uint8Array(WAV_BYTES),
    })
    check(
      'multipart ASR：自定义文件字段 + 额外表单字段 + 嵌套 textPath',
      tr.status === 200 && (tr.body as { text?: string }).text === 'mock识别(auto):audio.wav',
      tr.body,
    )

    const speechBinary = await fetch(`${BASE}/api/voice/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '你好，二进制测试' }),
    })
    const speechBinaryBuf = Buffer.from(await speechBinary.arrayBuffer())
    check(
      'binary TTS：响应直接是音频',
      speechBinary.status === 200 && speechBinaryBuf.equals(WAV_BYTES)
        && (speechBinary.headers.get('content-type') ?? '').includes('audio/wav'),
      { status: speechBinary.status, len: speechBinaryBuf.byteLength },
    )

    const testOk = await api('/api/voice/test', { method: 'POST', body: '{}' })
    check('test 合成成功', testOk.status === 200 && (testOk.body as { ok?: boolean }).ok === true, testOk.body)

    // 切换 TTS 为 json + URL 二次下载
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        voiceProfiles: JSON.stringify(profileWithTts(`${MOCK_BASE}/tts-json-url`, { responseType: 'json', audioPath: 'data.audio' })),
      }),
    })
    const speechUrl = await fetch(`${BASE}/api/voice/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '你好，URL 下载测试' }),
    })
    const speechUrlBuf = Buffer.from(await speechUrl.arrayBuffer())
    check('json TTS：audioPath 取 URL 二次下载', speechUrl.status === 200 && speechUrlBuf.equals(WAV_BYTES), { status: speechUrl.status })

    // 切换 TTS 为 json + base64
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        voiceProfiles: JSON.stringify(profileWithTts(`${MOCK_BASE}/tts-json-b64`, { responseType: 'json', audioPath: 'data.audio_b64' })),
      }),
    })
    const speechB64 = await fetch(`${BASE}/api/voice/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '你好，base64 测试' }),
    })
    const speechB64Buf = Buffer.from(await speechB64.arrayBuffer())
    check('json TTS：audioPath 取 base64 解码', speechB64.status === 200 && speechB64Buf.equals(WAV_BYTES), { status: speechB64.status })

    // 档案级 API Key：json ASR，{{apiKey}} 取自档案自身
    const keyedProfile = (apiKey?: string) => [
      {
        name: 'mock带Key',
        ...(apiKey ? { apiKey } : {}),
        asr: {
          url: `${MOCK_BASE}/asr-json`,
          format: 'json',
          headers: { Authorization: 'Bearer {{apiKey}}' },
          body: { audio: '{{audioBase64}}' },
          textPath: 'choices.0.message.content',
        },
      },
    ]
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ voiceProfiles: JSON.stringify(keyedProfile('profile-key-1')), voiceActiveProfile: 'mock带Key' }),
    })
    const trKeyed = await api('/api/voice/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: new Uint8Array(WAV_BYTES),
    })
    check(
      '档案级 API Key 注入 {{apiKey}}（json ASR + 数组 content 拼接）',
      trKeyed.status === 200 && (trKeyed.body as { text?: string }).text === '数组拼接',
      trKeyed.body,
    )

    // 档案没填 Key 但模板引用了 {{apiKey}} → 400 提示
    await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ voiceProfiles: JSON.stringify(keyedProfile()) }),
    })
    const trNoKey = await api('/api/voice/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: new Uint8Array(WAV_BYTES),
    })
    check('模板引用 {{apiKey}} 但无 Key 时返回 400', trNoKey.status === 400 && String((trNoKey.body as { error?: string }).error).includes('API Key'), trNoKey.body)

    // profile 覆盖（设置页测试未保存的配置）：transcribe 走 JSON 形式
    const adhocProfile = {
      name: '临时测试',
      asr: {
        url: `${MOCK_BASE}/asr`,
        format: 'multipart',
        fileField: 'audio',
        body: { language: 'yue' },
        textPath: 'result.text',
      },
      tts: { url: `${MOCK_BASE}/tts-binary`, body: { text: '{{text}}' }, responseType: 'binary' },
    }
    const trAdhoc = await api('/api/voice/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64: WAV_BYTES.toString('base64'), mimeType: 'audio/wav', profile: adhocProfile }),
    })
    check(
      'profile 覆盖识别（JSON 形式上传）',
      trAdhoc.status === 200 && (trAdhoc.body as { text?: string }).text === 'mock识别(yue):audio.wav',
      trAdhoc.body,
    )

    // profile 覆盖合成：跳过缓存，同文本两次都真实调用
    const speechAdhoc = () =>
      fetch(`${BASE}/api/voice/speech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '覆盖缓存测试', profile: adhocProfile }),
      })
    const adhoc1 = await speechAdhoc()
    const adhoc1Buf = Buffer.from(await adhoc1.arrayBuffer())
    const hits1 = ((await (await fetch(`${MOCK_BASE}/tts-hits`)).json()) as { hits: number }).hits
    const adhoc2 = await speechAdhoc()
    const hits2 = ((await (await fetch(`${MOCK_BASE}/tts-hits`)).json()) as { hits: number }).hits
    check(
      'profile 覆盖合成跳过缓存（两次都真实调用）',
      adhoc1.status === 200 && adhoc1Buf.equals(WAV_BYTES) && hits2 === hits1 + 1,
      { hits1, hits2, status: adhoc1.status },
    )

    // 合成前剔除英文双引号
    const quoteRes = await fetch(`${BASE}/api/voice/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '他说"你好"，"世界"很大', profile: adhocProfile }),
    })
    const lastText = ((await (await fetch(`${MOCK_BASE}/tts-last-text`)).json()) as { text: string }).text
    check('合成文本剔除英文双引号', quoteRes.status === 200 && lastText === '他说你好，世界很大', { lastText })

    // 还原设置
    const reset = await api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({
        voiceProfiles: cfg.voiceProfiles,
        voiceActiveProfile: cfg.voiceActiveProfile,
        voiceAutoSpeak: '0',
      }),
    })
    check('还原语音配置', (reset.body as unknown as VoiceSettings).voiceActiveProfile === cfg.voiceActiveProfile, reset.body)
  } finally {
    mock.close()
  }
}
