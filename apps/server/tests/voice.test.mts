import { api, check, section } from './helpers.mts'

export async function runVoiceTests() {
  section('语音服务')

  const cfg = (await api('/api/settings')).body as { voiceApiKey: string; voiceAutoSend: string }
  const hasKey = !!cfg.voiceApiKey.trim()
  console.log(hasKey ? '  - 已配置语音 Key（走空输入校验）' : '  - 未配置语音 Key（走 400 拦截）')

  const transcribe = await api('/api/voice/transcribe', {
    method: 'POST',
    body: new Uint8Array([1, 2, 3]),
  })
  check('transcribe 空音频返回 400', transcribe.status === 400, transcribe.body)

  const speech = await api('/api/voice/speech', { method: 'POST', body: JSON.stringify({}) })
  check(
    'speech 缺 text 返回 400',
    speech.status === 400 && String((speech.body as { error?: string }).error).includes('text is required'),
    speech.body,
  )

  if (!hasKey) {
    const test = await api('/api/voice/test', { method: 'POST', body: '{}' })
    check('未配置时 test 返回 400', test.status === 400 && (test.body as { ok?: boolean }).ok === false, test.body)
  }

  check('设置默认值（voiceAutoSend=1）', cfg.voiceAutoSend === '1', cfg)

  const put = await api('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ voiceApiKey: 'test-key-123', voiceAutoSpeak: '1' }),
  })
  const after = put.body as { voiceApiKey: string; voiceAutoSpeak: string }
  check('保存语音配置', after.voiceApiKey === 'test-key-123' && after.voiceAutoSpeak === '1', after)

  const reset = await api('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ voiceApiKey: cfg.voiceApiKey, voiceAutoSpeak: '0' }),
  })
  check('还原语音配置', (reset.body as { voiceAutoSpeak: string }).voiceAutoSpeak === '0', reset.body)
}
