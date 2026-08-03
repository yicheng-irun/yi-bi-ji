import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import { api, AGENT_TOOLS, ALL_TOOLS_SENTINEL, SUBAGENT_TOOLS, type AgentToolInfo, type CdpTabInfo, type McpServerDraft, type McpTestResult, parseMcpServers, serializeMcpServers, type Settings, REASONING_EFFORT_OPTIONS, parseVoiceProfiles, serializeVoiceProfiles, type VoiceProfileDraft, type VoiceAsrDraft, type VoiceTtsDraft } from '../api/client'
import { useVoiceRecorder } from '../lib/useVoiceRecorder'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Modal } from '../ui/Modal'
import { Loading } from '../ui/Loading'
import { SiteTitle } from '../ui/SiteTitle'

const Page = styled.div`
  max-width: 860px; margin: 0 auto;
`

const Body = styled.div`
  display: flex; gap: 20px; align-items: flex-start;
`

const Sidebar = styled.nav`
  width: 180px; flex-shrink: 0;
  display: flex; flex-direction: column; gap: 4px;
  position: sticky; top: 0;
`

const TabBtn = styled.button<{ $active: boolean }>`
  display: flex; align-items: center; gap: 8px;
  height: 40px; padding: 0 14px; font-size: 14px;
  border: none; border-radius: var(--radius); text-align: left;
  background: ${(p) => (p.$active ? 'var(--accent-light)' : 'transparent')};
  color: ${(p) => (p.$active ? 'var(--accent)' : 'var(--text-secondary)')};
  font-weight: ${(p) => (p.$active ? 600 : 500)};
  &:hover { background: ${(p) => (p.$active ? 'var(--accent-light)' : 'var(--bg-hover)')}; }
`

const Content = styled.div`
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 16px;
`

const Card = styled.div`
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 18px 20px;
  display: flex; flex-direction: column; gap: 14px;
  h3 { font-size: 15px; font-weight: 700; margin: 0; }
  .hint { font-size: 12px; color: var(--text-muted); }
`

const Field = styled.div`
  display: flex; flex-direction: column; gap: 6px;
  label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
  .select-row { display: flex; align-items: center; gap: 10px; }
  .select-row > div { flex: initial; width: 180px; }
`

const FieldRow = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
`

const Actions = styled.div`
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  .status { font-size: 12.5px; }
  .status.ok { color: var(--green); }
  .status.err { color: var(--red); }
`

const CountGrid = styled.div`
  display: flex; flex-wrap: wrap; gap: 8px;
  .chip {
    font-size: 12px; padding: 4px 10px; border-radius: 6px;
    background: var(--bg-hover); border: 1px solid var(--border);
    font-family: var(--font-mono);
  }
`

const JsonEditor = styled.textarea`
  width: 100%; min-height: 260px; resize: vertical;
  font-family: var(--font-mono); font-size: 12.5px; line-height: 1.6;
  padding: 12px; border-radius: var(--radius);
  border: 1px solid var(--border); background: var(--bg-card);
  color: var(--text); outline: none;
  &:focus { border-color: var(--accent); }
`

const McpList = styled.div`
  display: flex; flex-direction: column; gap: 8px;
`

const McpRow = styled.div<{ $enabled: boolean }>`
  display: flex; align-items: center; gap: 12px;
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 10px 14px; background: var(--bg-card);
  opacity: ${(p) => (p.$enabled ? 1 : .6)};
  transition: opacity .15s, border-color .15s;
  &:hover { border-color: var(--accent); }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .name { font-size: 13px; font-weight: 600; }
  .meta { font-size: 12px; color: var(--text-muted); font-family: var(--font-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .badges { display: flex; gap: 6px; flex-shrink: 0; }
`

const Toggle = styled.button<{ $on: boolean }>`
  width: 38px; height: 21px; border-radius: 11px; border: none; cursor: pointer;
  position: relative; flex-shrink: 0; padding: 0;
  background: ${(p) => (p.$on ? 'var(--green)' : 'var(--border)')};
  transition: background .15s;
  &::after {
    content: ''; position: absolute; top: 2px; left: 2px;
    width: 17px; height: 17px; border-radius: 50%; background: #fff;
    transform: translateX(${(p) => (p.$on ? '17px' : '0')});
    transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.2);
  }
  &:disabled { opacity: .5; cursor: not-allowed; }
`

const McpServers = styled.div`
  display: flex; flex-direction: column; gap: 12px;
  .server {
    border: 1px solid var(--border); border-radius: var(--radius);
    padding: 12px 14px; background: var(--bg-card);
  }
  .server-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .server-name { font-size: 13px; font-weight: 600; }
  .server-error { font-size: 12px; color: var(--red); word-break: break-all; }
  .tools { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .tool-chip {
    font-size: 12px; padding: 3px 9px; border-radius: 6px;
    background: var(--bg-hover); border: 1px solid var(--border);
    font-family: var(--font-mono);
  }
`

const ToolGrid = styled.div`
  display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px;
`

const ToolRow = styled.label<{ $locked?: boolean }>`
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-card); cursor: pointer;
  transition: border-color .15s, background .15s;
  &:hover { border-color: var(--accent); background: var(--bg-hover); }
  input { accent-color: var(--accent); margin-top: 3px; flex-shrink: 0; }
  .info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .name { font-size: 13px; font-weight: 600; color: var(--text); }
  .hint { font-size: 12px; color: var(--text-muted); }
  ${(p) =>
    p.$locked
      ? `opacity: .5; cursor: not-allowed; pointer-events: none;
         border-style: dashed;
         .name { color: var(--text-secondary); }`
      : ''}
`

const ToolGridHeader = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  .toggle-all { font-size: 12px; color: var(--accent); cursor: pointer; border: none; background: none; padding: 0; &:hover { text-decoration: underline; } }
`

const EnableRow = styled.div`
  display: flex; align-items: center; gap: 10px;
  font-size: 13.5px; font-weight: 600; color: var(--text);
`

const CodeBlock = styled.div`
  position: relative; margin-top: 10px;
  pre {
    margin: 0; padding: 14px; border-radius: var(--radius);
    background: #0f1419; color: #d7e0ea; font-family: var(--font-mono);
    font-size: 12.5px; line-height: 1.7; overflow: auto;
    white-space: pre; max-height: 360px;
  }
  .copy {
    position: absolute; top: 8px; right: 8px;
    font-size: 12px; color: #9fb0c3; background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.15); border-radius: 6px;
    padding: 3px 10px; cursor: pointer;
    &:hover { color: #fff; background: rgba(255,255,255,.15); }
  }
`

const Steps = styled.ol`
  margin: 6px 0 0; padding-left: 20px; font-size: 13px; line-height: 1.9; color: var(--text-secondary);
  li > b { color: var(--text); }
  code { font-family: var(--font-mono); font-size: 12px; background: var(--bg-hover); padding: 1px 5px; border-radius: 4px; }
`

const TabList = styled.ul`
  margin: 8px 0 0; padding: 0; list-style: none;
  display: flex; flex-direction: column; gap: 6px;
  li {
    display: flex; align-items: center; gap: 8px;
    font-size: 12.5px; font-family: var(--font-mono);
    border: 1px solid var(--border); border-radius: var(--radius);
    padding: 6px 10px; background: var(--bg-card);
    .idx { color: var(--text-muted); flex-shrink: 0; }
    .ttl { font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%; }
    .url { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  }
`

const WARN = '⚠️'
const WARNING_STYLE = { fontSize: 12.5, color: '#d97706', lineHeight: 1.7 } as const

const TABS = [
  { key: 'ai', label: '大模型', icon: '🤖' },
  { key: 'agent', label: 'Agent 能力', icon: '🧩' },
  { key: 'browser', label: '浏览器控制', icon: '🌐' },
  { key: 'mcp', label: 'MCP 服务器', icon: '🔌' },
  { key: 'voice', label: '语音', icon: '🎙' },
  { key: 'backup', label: '数据备份', icon: '💾' },
] as const

const BACKUP_TYPE_OPTIONS = [
  { value: 'sqlite', label: 'SQLite 文件' },
  { value: 'mysql', label: 'MySQL' },
]

const MCP_TYPE_OPTIONS = [
  { value: 'http', label: 'http（推荐）' },
  { value: 'sse', label: 'sse' },
  { value: 'stdio', label: 'stdio' },
]

const VOICE_ASR_FORMAT_OPTIONS = [
  { value: 'multipart', label: 'multipart（表单上传文件）' },
  { value: 'json', label: 'json（请求体模板）' },
]

const VOICE_TTS_RESPONSE_OPTIONS = [
  { value: 'binary', label: 'binary（响应直接是音频）' },
  { value: 'json', label: 'json（按字段取音频）' },
]

const VOICE_PRESETS = [
  { key: 'aliyun', label: '阿里云百炼（DashScope）' },
  { key: 'local', label: '本地 ASR-TTS 服务' },
] as const

/** 语音配置预设：一键填充整份档案（名称只在当前为空时填入） */
function buildVoicePreset(key: string): VoiceProfileDraft {
  if (key === 'local') {
    return {
      name: '本地 ASR-TTS',
      asr: {
        url: 'http://127.0.0.1:19411/asr',
        format: 'multipart',
        fileField: 'file',
        textPath: 'text',
        timeoutMs: 300000,
      },
      tts: {
        url: 'http://127.0.0.1:19411/tts',
        body: { text: '{{text}}', speed: 1.0 },
        responseType: 'binary',
        timeoutMs: 120000,
      },
    }
  }
  return {
    name: '阿里云百炼',
    asr: {
      url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      method: 'POST',
      headers: { Authorization: 'Bearer {{apiKey}}' },
      format: 'json',
      body: {
        model: 'qwen3-asr-flash',
        messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: '{{audioDataUri}}' } }] }],
        stream: false,
        asr_options: { enable_itn: false, language: 'zh' },
      },
      textPath: 'choices.0.message.content',
      timeoutMs: 120000,
    },
    tts: {
      url: 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer',
      method: 'POST',
      headers: { Authorization: 'Bearer {{apiKey}}' },
      body: {
        model: 'qwen-audio-3.0-tts-flash',
        input: { text: '{{text}}', voice: 'longanhuan_v3.6', format: 'mp3', sample_rate: 48000 },
      },
      responseType: 'json',
      audioPath: 'output.audio.url',
      timeoutMs: 120000,
    },
  }
}

function emptyVoiceProfile(): VoiceProfileDraft {
  return {
    name: '',
    asr: { url: '', format: 'multipart', fileField: 'file', textPath: 'text' },
    tts: { url: '', body: { text: '{{text}}' }, responseType: 'binary' },
  }
}

/** JSON 编辑框：本地暂存文本，解析成功才回写对象，非法时红框提示 */
function JsonField({ value, onChange, placeholder, minHeight }: {
  value: unknown
  onChange: (v: unknown) => void
  placeholder?: string
  minHeight?: number
}) {
  const [text, setText] = useState(() => (value === undefined ? '' : JSON.stringify(value, null, 2)))
  const [invalid, setInvalid] = useState(false)
  return (
    <>
      <JsonEditor
        value={text}
        placeholder={placeholder}
        style={{ minHeight: minHeight ?? 80, ...(invalid ? { borderColor: 'var(--red)' } : {}) }}
        spellCheck={false}
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          if (!v.trim()) { setInvalid(false); onChange(undefined); return }
          try { onChange(JSON.parse(v)); setInvalid(false) } catch { setInvalid(true) }
        }}
      />
      {invalid && <div style={{ fontSize: 12, color: 'var(--red)' }}>JSON 格式不正确，修正后才会生效</div>}
    </>
  )
}

/** 语音接口测试面板：针对使用中的档案（用当前页面配置，未保存的改动也可测） */
function VoiceTestPanel({ profile }: { profile: VoiceProfileDraft | null }) {
  const [ttsText, setTtsText] = useState('你好，这是一段语音合成测试。')
  const [ttsBusy, setTtsBusy] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [ttsResult, setTtsResult] = useState<Status | null>(null)
  const audioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null)
  const [asrBusy, setAsrBusy] = useState(false)
  const [asrResult, setAsrResult] = useState<Status | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const { recording, error: recError, start, stop } = useVoiceRecorder()

  const stopAudio = () => {
    audioRef.current?.audio.pause()
    if (audioRef.current) URL.revokeObjectURL(audioRef.current.url)
    audioRef.current = null
    setPlaying(false)
  }

  useEffect(() => () => stopAudio(), [])

  if (!profile) {
    return <div className="hint" style={{ padding: '4px 0' }}>没有使用中的语音档案，先在上方新增配置。</div>
  }

  const runTts = async () => {
    if (playing) {
      stopAudio()
      setTtsResult(null)
      return
    }
    const text = ttsText.trim()
    if (!text) {
      setTtsResult({ ok: false, text: '请先填写测试文案' })
      return
    }
    setTtsBusy(true)
    setTtsResult(null)
    try {
      const blob = await api.testVoiceSpeech(text, profile)
      stopAudio()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = { audio, url }
      audio.onended = () => stopAudio()
      await audio.play()
      setPlaying(true)
      setTtsResult({ ok: true, text: `合成成功（${(blob.size / 1024).toFixed(1)} KB），播放中…` })
    } catch (e) {
      setTtsResult({ ok: false, text: (e as Error).message || '合成失败' })
    } finally {
      setTtsBusy(false)
    }
  }

  const runAsr = async (blob: Blob) => {
    setAsrBusy(true)
    setAsrResult(null)
    try {
      const text = await api.testVoiceAsr(blob, profile)
      setAsrResult({ ok: true, text: `识别结果：${text || '（空）'}` })
    } catch (e) {
      setAsrResult({ ok: false, text: (e as Error).message || '识别失败' })
    } finally {
      setAsrBusy(false)
    }
  }

  const stopRecording = () => {
    void stop()
      .then((blob) => {
        if (!blob) {
          setAsrResult({ ok: false, text: '没有检测到有效语音（过短或静音）' })
          return
        }
        return runAsr(blob)
      })
      .catch((e) => setAsrResult({ ok: false, text: (e as Error).message }))
  }

  const hasTts = !!profile.tts?.url?.trim()
  const hasAsr = !!profile.asr?.url?.trim()

  return (
    <>
      <div className="hint">
        针对使用中的档案「{profile.name}」，按当前页面里的配置测试（未保存的改动也会生效）。
      </div>
      <Field>
        <label>TTS（文字转语音）</label>
        {hasTts ? (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Input value={ttsText} onChange={(e) => setTtsText(e.target.value)} placeholder="输入一句测试文案" />
              </div>
              <Button variant={playing ? 'danger' : 'primary'} onClick={() => void runTts()} disabled={ttsBusy}>
                {ttsBusy ? '合成中…' : playing ? '⏹ 停止' : '生成并播放'}
              </Button>
            </div>
            {ttsResult && (
              <div style={{ fontSize: 12.5, color: ttsResult.ok ? 'var(--green)' : 'var(--red)' }}>{ttsResult.text}</div>
            )}
          </>
        ) : (
          <div className="hint">该档案未配置 TTS 接口</div>
        )}
      </Field>
      <Field>
        <label>ASR（语音转文字）</label>
        {hasAsr ? (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                variant={recording ? 'danger' : 'default'}
                disabled={asrBusy}
                onPointerDown={() => void start()}
                onPointerUp={stopRecording}
                onPointerLeave={() => { if (recording) stopRecording() }}
              >
                {recording ? '● 录音中，松开识别' : asrBusy ? '识别中…' : '🎙 按住说话'}
              </Button>
              <Button disabled={asrBusy || recording} onClick={() => fileRef.current?.click()}>
                选择音频文件
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.aac,.webm"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) void runAsr(f)
                }}
              />
            </div>
            {recError && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{recError}</div>}
            {asrResult && (
              <div style={{ fontSize: 12.5, color: asrResult.ok ? 'var(--green)' : 'var(--red)', wordBreak: 'break-all' }}>{asrResult.text}</div>
            )}
          </>
        ) : (
          <div className="hint">该档案未配置 ASR 接口</div>
        )}
      </Field>
    </>
  )
}

function VoiceProfileEditorModal({ profile, existingNames, onSave, onClose }: {
  profile: VoiceProfileDraft
  existingNames: string[]
  onSave: (p: VoiceProfileDraft) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<VoiceProfileDraft>(() => JSON.parse(JSON.stringify(profile)) as VoiceProfileDraft)
  const [mode, setMode] = useState<'form' | 'json'>('form')
  const [jsonText, setJsonText] = useState('')
  const [jsonInvalid, setJsonInvalid] = useState(false)
  const [error, setError] = useState('')

  const setAsr = (patch: Partial<VoiceAsrDraft>) =>
    setForm((f) => ({ ...f, asr: { url: '', ...f.asr, ...patch } }))
  const setTts = (patch: Partial<VoiceTtsDraft>) =>
    setForm((f) => ({ ...f, tts: { url: '', ...f.tts, ...patch } }))

  const applyPreset = (key: string) => {
    const p = buildVoicePreset(key)
    setForm((f) => ({ ...p, name: f.name.trim() ? f.name : p.name, apiKey: f.apiKey }))
    setError('')
  }

  const switchMode = (next: 'form' | 'json') => {
    if (next === mode) return
    if (next === 'json') {
      setJsonText(JSON.stringify({ apiKey: form.apiKey, asr: form.asr, tts: form.tts }, null, 2))
      setJsonInvalid(false)
      setMode('json')
      return
    }
    try {
      const parsed = JSON.parse(jsonText) as { apiKey?: string; asr?: VoiceAsrDraft; tts?: VoiceTtsDraft }
      setForm((f) => ({ ...f, apiKey: parsed.apiKey, asr: parsed.asr, tts: parsed.tts }))
      setJsonInvalid(false)
      setError('')
      setMode('form')
    } catch {
      setJsonInvalid(true)
      setError('JSON 格式不正确，修正后才能切回表单')
    }
  }

  const save = () => {
    let draft = form
    if (mode === 'json') {
      try {
        const parsed = JSON.parse(jsonText) as { apiKey?: string; asr?: VoiceAsrDraft; tts?: VoiceTtsDraft }
        draft = { ...form, apiKey: parsed.apiKey, asr: parsed.asr, tts: parsed.tts }
      } catch {
        setError('JSON 格式不正确')
        return
      }
    }
    const name = draft.name.trim()
    if (!name) {
      setError('请填写配置名称')
      return
    }
    if (existingNames.includes(name) && name !== profile.name) {
      setError('该名称已存在')
      return
    }
    if (!draft.asr?.url?.trim() && !draft.tts?.url?.trim()) {
      setError('ASR 与 TTS 至少填写一个接口地址')
      return
    }
    onSave({ ...draft, name })
  }

  const asrFormat = form.asr?.format ?? 'multipart'
  const ttsResponseType = form.tts?.responseType ?? 'binary'

  return (
    <Modal
      title={profile.name ? `编辑语音配置：${profile.name}` : '新增语音配置'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={save}>保存</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field>
          <label>名称（唯一标识）</label>
          <Input value={form.name} placeholder="如 阿里云百炼 / 本地 ASR-TTS" onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </Field>
              <Field>
                <label>{'API Key（供本配置的 {{apiKey}} 占位符使用）'}</label>
                <Input type="password" value={form.apiKey ?? ''} placeholder="该服务的密钥，如 sk-..." onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value || undefined }))} />
                <div className="hint">不同服务的密钥各自填在各自的配置里（如百炼/火山/腾讯）；自建无鉴权服务留空即可。</div>
              </Field>
        <Field>
          <label>快速填充预设（会覆盖下方 ASR/TTS 配置）</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {VOICE_PRESETS.map((p) => (
              <Button key={p.key} size="sm" onClick={() => applyPreset(p.key)}>{p.label}</Button>
            ))}
          </div>
        </Field>
        <Field>
          <label>编辑方式</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant={mode === 'form' ? 'primary' : 'default'} onClick={() => switchMode('form')}>表单</Button>
            <Button size="sm" variant={mode === 'json' ? 'primary' : 'default'} onClick={() => switchMode('json')}>JSON</Button>
          </div>
        </Field>

        {mode === 'json' ? (
          <Field>
            <label>{'整段配置（{ "apiKey": "...", "asr": {...}, "tts": {...} }）'}</label>
            <JsonEditor
              value={jsonText}
              style={{ minHeight: 320, ...(jsonInvalid ? { borderColor: 'var(--red)' } : {}) }}
              spellCheck={false}
              onChange={(e) => {
                const v = e.target.value
                setJsonText(v)
                try { JSON.parse(v); setJsonInvalid(false) } catch { setJsonInvalid(true) }
              }}
            />
            {jsonInvalid && <div style={{ fontSize: 12, color: 'var(--red)' }}>JSON 格式不正确</div>}
            <div className="hint">
              {'可用占位符：{{apiKey}}（上方 API Key）、{{text}}（TTS 文本）、{{audioBase64}} / {{audioDataUri}} / {{mimeType}}（ASR 音频）'}
            </div>
          </Field>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700 }}>ASR（语音转文字）</div>
            <Field>
              <label>接口地址</label>
              <Input value={form.asr?.url ?? ''} placeholder="http://192.168.0.6:19411/asr" onChange={(e) => setAsr({ url: e.target.value })} />
            </Field>
            <FieldRow>
              <Field>
                <label>请求方式</label>
                <div className="select-row">
                  <Select value={asrFormat} onChange={(v) => setAsr({ format: v as VoiceAsrDraft['format'] })} options={VOICE_ASR_FORMAT_OPTIONS} />
                </div>
              </Field>
              {asrFormat === 'multipart' && (
                <Field>
                  <label>文件字段名</label>
                  <Input value={form.asr?.fileField ?? 'file'} onChange={(e) => setAsr({ fileField: e.target.value })} />
                </Field>
              )}
            </FieldRow>
            <Field>
              <label>{asrFormat === 'multipart' ? '额外表单字段（JSON 对象，可选）' : '请求体模板（JSON，支持占位符）'}</label>
              <JsonField
                value={form.asr?.body}
                placeholder={asrFormat === 'multipart' ? '{ "language": "auto" }' : '{ "audio": "{{audioBase64}}" }'}
                onChange={(v) => setAsr({ body: v })}
              />
            </Field>
            <FieldRow>
              <Field>
                <label>结果文本字段（点路径）</label>
                <Input value={form.asr?.textPath ?? 'text'} placeholder="text / choices.0.message.content" onChange={(e) => setAsr({ textPath: e.target.value })} />
              </Field>
              <Field>
                <label>超时（毫秒）</label>
                <Input value={form.asr?.timeoutMs ? String(form.asr.timeoutMs) : ''} placeholder="120000" onChange={(e) => setAsr({ timeoutMs: Number(e.target.value) || undefined })} />
              </Field>
            </FieldRow>
            <Field>
              <label>请求头 headers（JSON 对象，可选）</label>
              <JsonField value={form.asr?.headers} placeholder='{ "Authorization": "Bearer {{apiKey}}" }' onChange={(v) => setAsr({ headers: v as Record<string, string> | undefined })} />
            </Field>

            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>TTS（文字转语音）</div>
            <Field>
              <label>接口地址</label>
              <Input value={form.tts?.url ?? ''} placeholder="http://192.168.0.6:19411/tts" onChange={(e) => setTts({ url: e.target.value })} />
            </Field>
            <Field>
              <label>请求体模板（JSON，支持 {'{{text}}'} 占位符）</label>
              <JsonField value={form.tts?.body} placeholder='{ "text": "{{text}}", "speed": 1.0 }' onChange={(v) => setTts({ body: v })} />
            </Field>
            <FieldRow>
              <Field>
                <label>响应类型</label>
                <div className="select-row">
                  <Select value={ttsResponseType} onChange={(v) => setTts({ responseType: v as VoiceTtsDraft['responseType'] })} options={VOICE_TTS_RESPONSE_OPTIONS} />
                </div>
              </Field>
              {ttsResponseType === 'json' && (
                <Field>
                  <label>音频字段（点路径）</label>
                  <Input value={form.tts?.audioPath ?? ''} placeholder="output.audio.url / data.audio_base64" onChange={(e) => setTts({ audioPath: e.target.value })} />
                  <div className="hint">值为 http(s) 地址则二次下载，否则按 base64 解码</div>
                </Field>
              )}
            </FieldRow>
            <FieldRow>
              <Field>
                <label>超时（毫秒）</label>
                <Input value={form.tts?.timeoutMs ? String(form.tts.timeoutMs) : ''} placeholder="120000" onChange={(e) => setTts({ timeoutMs: Number(e.target.value) || undefined })} />
              </Field>
            </FieldRow>
            <Field>
              <label>请求头 headers（JSON 对象，可选）</label>
              <JsonField value={form.tts?.headers} placeholder='{ "Authorization": "Bearer {{apiKey}}" }' onChange={(v) => setTts({ headers: v as Record<string, string> | undefined })} />
            </Field>
          </>
        )}

        {error && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{error}</div>}
      </div>
    </Modal>
  )
}

type TabKey = typeof TABS[number]['key']

interface Status {
  ok: boolean
  text: string
}

function emptyMcpServer(): McpServerDraft {
  return { name: '', type: 'http', url: '', enabled: true }
}

/** 与仓库 scripts/start-browser-cdp.bat 保持一致（教程展示用；纯 ASCII，避免中文乱码） */
const START_BROWSER_BAT = `@echo off
REM Start Edge/Chrome with CDP debugging for bi-ji browser_* tools.
REM Profile lives in %USERPROFILE%\\.biji-browser (logins persist there).
REM Default listens on 127.0.0.1 only. For remote access set first:
REM   set BIJI_CDP_ADDR=0.0.0.0   (then allow the port in firewall)

set PROFILE=%USERPROFILE%\\.biji-browser
if not exist "%PROFILE%" mkdir "%PROFILE%"

set CDP_ADDR=%BIJI_CDP_ADDR%
if "%CDP_ADDR%"=="" set CDP_ADDR=127.0.0.1

set BROWSER=
if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" set BROWSER="%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" set BROWSER="%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"
if not defined BROWSER if exist "%LocalAppData%\\Microsoft\\Edge\\Application\\msedge.exe" set BROWSER="%LocalAppData%\\Microsoft\\Edge\\Application\\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" set BROWSER="%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"
if not defined BROWSER if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" set BROWSER="%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"

if not defined BROWSER (
  echo [bi-ji] Edge/Chrome not found.
  echo   Start it manually:
  echo   msedge --remote-debugging-port=9222 --user-data-dir="%PROFILE%"
  pause
  exit /b 1
)

start "" %BROWSER% --remote-debugging-port=9222 --remote-debugging-address=%CDP_ADDR% --user-data-dir="%PROFILE%" --no-first-run
echo [bi-ji] Browser started. CDP on port 9222 (listen %CDP_ADDR%). Log in to your sites in that window; keep it open.
pause
`

interface BrowserInfo {
  connected: boolean
  url: string
  version?: string
  tabs?: CdpTabInfo[]
  reason?: string
}

function McpEditorModal({ server, existingNames, onSave, onClose }: {
  server: McpServerDraft
  existingNames: string[]
  onSave: (s: McpServerDraft) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<McpServerDraft>(server)
  const [error, setError] = useState('')

  const set = <K extends keyof McpServerDraft>(key: K, value: McpServerDraft[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const save = () => {
    const name = form.name.trim()
    if (!name) {
      setError('请填写服务器名称')
      return
    }
    if (existingNames.includes(name) && name !== server.name) {
      setError('该名称已存在')
      return
    }
    onSave({ ...form, name })
  }

  return (
    <Modal
      title={server.name ? `编辑 MCP 服务器：${server.name}` : '新增 MCP 服务器'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={save}>保存</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field>
          <label>名称（唯一标识，也是工具名前缀）</label>
          <Input value={form.name} placeholder="如 filesystem / docs" onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field>
          <label>类型</label>
          <div className="select-row">
            <Select value={form.type} onChange={(v) => set('type', v as McpServerDraft['type'])} options={MCP_TYPE_OPTIONS} />
          </div>
        </Field>

        {(form.type === 'http' || form.type === 'sse') && (
          <>
            <Field>
              <label>URL</label>
              <Input value={form.url ?? ''} placeholder="https://example.com/mcp" onChange={(e) => set('url', e.target.value)} />
            </Field>
            <Field>
              <label>请求头 headers（JSON 对象，可选）</label>
              <JsonEditor
                value={form.headers ? JSON.stringify(form.headers, null, 2) : ''}
                placeholder='{ "Authorization": "Bearer xxx" }'
                style={{ minHeight: 90 }}
                spellCheck={false}
                onChange={(e) => {
                  const v = e.target.value.trim()
                  if (!v) { set('headers', undefined); return }
                  try { set('headers', JSON.parse(v)) } catch { /* 暂存非法值给用户继续编辑 */ }
                }}
              />
            </Field>
          </>
        )}

        {form.type === 'stdio' && (
          <>
            <Field>
              <label>启动命令 command</label>
              <Input value={form.command ?? ''} placeholder="npx / node / python" onChange={(e) => set('command', e.target.value)} />
            </Field>
            <Field>
              <label>启动参数 args（JSON 数组，可选）</label>
              <JsonEditor
                value={form.args ? JSON.stringify(form.args, null, 2) : ''}
                placeholder='["-y", "@modelcontextprotocol/server-filesystem", "/path"]'
                style={{ minHeight: 70 }}
                spellCheck={false}
                onChange={(e) => {
                  const v = e.target.value.trim()
                  if (!v) { set('args', undefined); return }
                  try { set('args', JSON.parse(v)) } catch { /* 暂存 */ }
                }}
              />
            </Field>
            <Field>
              <label>环境变量 env（JSON 对象，可选）</label>
              <JsonEditor
                value={form.env ? JSON.stringify(form.env, null, 2) : ''}
                placeholder='{ "API_KEY": "xxx" }'
                style={{ minHeight: 70 }}
                spellCheck={false}
                onChange={(e) => {
                  const v = e.target.value.trim()
                  if (!v) { set('env', undefined); return }
                  try { set('env', JSON.parse(v)) } catch { /* 暂存 */ }
                }}
              />
            </Field>
          </>
        )}

        {error && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{error}</div>}
      </div>
    </Modal>
  )
}

export default function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab: TabKey = (params.get('tab') as TabKey) || 'ai'

  const [form, setForm] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [lastCounts, setLastCounts] = useState<Record<string, number> | null>(null)
  const [mcpTest, setMcpTest] = useState<McpTestResult | null>(null)
  const [mcpEditor, setMcpEditor] = useState<{ index: number; server: McpServerDraft } | null>(null)
  const [voiceEditor, setVoiceEditor] = useState<{ index: number; profile: VoiceProfileDraft } | null>(null)
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api.getSettings().then(setForm).catch((e) => {
      console.error(e)
      setStatus({ ok: false, text: '加载设置失败' })
    })
  }, [])

  useEffect(() => {
    if (tab === 'browser') {
      api.getBrowserStatus().then((r) => {
        setBrowserInfo({ connected: r.connected, url: r.url, version: r.version, tabs: r.tabs, reason: r.reason })
      }).catch(() => {})
    }
  }, [tab])

  if (!form) return <Loading />

  const setTab = (key: TabKey) => setParams({ tab: key })

  const set = (key: keyof Settings, value: string) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  const save = async () => {
    setSaving(true)
    setStatus(null)
    try {
      const s = await api.updateSettings(form)
      setForm(s)
      setStatus({ ok: true, text: '已保存' })
    } catch (e) {
      console.error(e)
      setStatus({ ok: false, text: (e as Error).message || '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  const testAi = async () => {
    setStatus({ ok: true, text: '测试中…' })
    try {
      const r = await api.testSettings()
      setStatus(r.ok ? { ok: true, text: `连接成功：${r.text}` } : { ok: false, text: r.error || '连接失败' })
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message || '连接失败' })
    }
  }

  const testBackup = async () => {
    setStatus(null)
    setBusy('test-backup')
    try {
      const r = await api.testBackup()
      setStatus(r.ok ? { ok: true, text: '连接成功' } : { ok: false, text: r.error || '连接失败' })
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message || '连接失败' })
    } finally {
      setBusy(null)
    }
  }

  const syncBackup = async () => {
    if (!confirm('将清空备份库中的对应表并重新同步全部数据，确认执行？')) return
    setStatus(null)
    setBusy('sync')
    try {
      const r = await api.syncBackup()
      if (r.ok && r.counts) {
        setLastCounts(r.counts)
        setStatus({ ok: true, text: '同步完成' })
      } else {
        setStatus({ ok: false, text: r.error || '同步失败' })
      }
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message || '同步失败' })
    } finally {
      setBusy(null)
    }
  }

  const testMcp = async () => {
    setStatus(null)
    setBusy('test-mcp')
    setMcpTest(null)
    try {
      const r = await api.testMcp(form.mcpServers)
      setMcpTest(r)
      const failed = r.servers.filter((s) => s.error)
      setStatus(
        r.ok
          ? { ok: true, text: failed.length ? '部分服务器连接失败' : '连接成功' }
          : { ok: false, text: failed.map((s) => `${s.name}: ${s.error}`).join('；') || '连接失败' },
      )
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message || '测试失败' })
    } finally {
      setBusy(null)
    }
  }

  const testBrowser = async () => {
    setStatus(null)
    setBusy('test-browser')
    try {
      const r = await api.testBrowser(form.browserCdpUrl)
      setBrowserInfo({ connected: r.ok, url: r.url, version: r.version, tabs: r.tabs, reason: r.reason })
      setStatus(
        r.ok
          ? { ok: true, text: `连接成功（${r.version}），${r.tabs?.length ?? 0} 个标签页` }
          : { ok: false, text: r.reason || '连接失败' },
      )
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message || '测试失败' })
    } finally {
      setBusy(null)
    }
  }

  const disconnectBrowser = async () => {
    setStatus(null)
    try {
      await api.disconnectBrowser()
      setBrowserInfo(null)
      setStatus({ ok: true, text: '已断开（不会关闭你的浏览器，下次操作自动重连）' })
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message || '断开失败' })
    }
  }

  const copyBat = async () => {
    try {
      await navigator.clipboard.writeText(START_BROWSER_BAT)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setStatus({ ok: false, text: '复制失败，请手动选择复制' })
    }
  }

  const mcpServers = parseMcpServers(form.mcpServers)

  const voiceProfiles = parseVoiceProfiles(form.voiceProfiles)
  const activeVoiceProfile = voiceProfiles.some((p) => p.name === form.voiceActiveProfile)
    ? form.voiceActiveProfile
    : voiceProfiles[0]?.name ?? ''

  const setVoiceProfiles = (profiles: VoiceProfileDraft[]) => {
    set('voiceProfiles', serializeVoiceProfiles(profiles))
  }

  const removeVoiceProfile = (index: number) => {
    if (!confirm('删除该语音配置？')) return
    const removed = voiceProfiles[index]
    const next = voiceProfiles.filter((_, i) => i !== index)
    setVoiceProfiles(next)
    if (form.voiceActiveProfile === removed?.name) set('voiceActiveProfile', next[0]?.name ?? '')
  }

  const saveVoiceEditor = (profile: VoiceProfileDraft) => {
    if (voiceEditor) {
      const next = [...voiceProfiles]
      if (voiceEditor.index === -1) next.push(profile)
      else next[voiceEditor.index] = profile
      setVoiceProfiles(next)
      if (!next.some((p) => p.name === form.voiceActiveProfile)) {
        set('voiceActiveProfile', next[0]?.name ?? '')
      }
    }
    setVoiceEditor(null)
  }

  const setMcpServers = (servers: McpServerDraft[]) => {
    set('mcpServers', serializeMcpServers(servers))
  }

  const toggleMcp = (index: number) => {
    const next = mcpServers.map((s, i) => (i === index ? { ...s, enabled: s.enabled !== false ? false : true } : s))
    setMcpServers(next)
  }

  const removeMcp = (index: number) => {
    if (!confirm('删除该 MCP 服务器？')) return
    setMcpServers(mcpServers.filter((_, i) => i !== index))
  }

  const saveMcpEditor = (server: McpServerDraft) => {
    if (mcpEditor) {
      const next = [...mcpServers]
      if (mcpEditor.index === -1) next.push(server)
      else next[mcpEditor.index] = server
      setMcpServers(next)
    }
    setMcpEditor(null)
  }

  const selectedToolSet = (raw: string, all: AgentToolInfo[]) =>
    raw === ALL_TOOLS_SENTINEL || !raw
      ? new Set(all.map((t) => t.name))
      : new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))

  const toggleTool = (key: 'aiTools' | 'aiSubagentTools', name: string, all: AgentToolInfo[]) => {
    const cur = selectedToolSet(form[key], all)
    if (cur.has(name)) cur.delete(name)
    else cur.add(name)
    set(key, cur.size >= all.length ? ALL_TOOLS_SENTINEL : [...cur].join(','))
  }

  const setAllTools = (key: 'aiTools' | 'aiSubagentTools', all: AgentToolInfo[], on: boolean) => {
    set(key, on ? ALL_TOOLS_SENTINEL : '')
  }

  const renderToolGrid = (key: 'aiTools' | 'aiSubagentTools', title: string, hint: string, tools: AgentToolInfo[]) => {
    const selected = selectedToolSet(form[key], tools)
    const allOn = selected.size >= tools.length
    return (
      <Card>
        <ToolGridHeader>
          <h3>{title}</h3>
          <button className="toggle-all" onClick={() => setAllTools(key, tools, !allOn)}>
            {allOn ? '全不选' : '全选'}
          </button>
        </ToolGridHeader>
        <div className="hint">{hint}</div>
        <ToolGrid>
          {tools.map((t) => {
            const locked = t.requires === 'cdp' && form.browserCdpEnabled !== '1'
            return (
              <ToolRow key={t.name} $locked={locked}>
                <input
                  type="checkbox"
                  checked={selected.has(t.name)}
                  disabled={locked}
                  onChange={() => toggleTool(key, t.name, tools)}
                />
                <span className="info">
                  <span className="name">{t.label}</span>
                  <span className="hint">{locked ? `${t.hint}（需先在「浏览器控制」启用）` : t.hint}</span>
                </span>
              </ToolRow>
            )
          })}
        </ToolGrid>
        <Actions>
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
          {status && <span className={`status ${status.ok ? 'ok' : 'err'}`}>{status.text}</span>}
        </Actions>
      </Card>
    )
  }

  return (
    <Page>
      <SiteTitle title="设置" />
      <Body>
        <Sidebar>
          {TABS.map((t) => (
            <TabBtn key={t.key} $active={tab === t.key} onClick={() => setTab(t.key)}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </TabBtn>
          ))}
        </Sidebar>

        <Content>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            {TABS.find((t) => t.key === tab)?.label}
          </h2>

          {tab === 'ai' && (
            <Card>
              <h3>大模型配置</h3>
              <div className="hint">这里的配置会覆盖 .env 里的默认值，保存后对新的对话立即生效。</div>
              <Field>
                <label>Base URL</label>
                <Input value={form.aiBaseURL} placeholder="https://api.openai.com/v1" onChange={(e) => set('aiBaseURL', e.target.value)} />
              </Field>
              <Field>
                <label>API Key</label>
                <Input type="password" value={form.aiApiKey} placeholder="sk-..." onChange={(e) => set('aiApiKey', e.target.value)} />
              </Field>
              <Field>
                <label>模型</label>
                <Input value={form.aiModel} placeholder="gpt-4o-mini" onChange={(e) => set('aiModel', e.target.value)} />
              </Field>
              <Field>
                <label>思考强度</label>
                <div className="select-row">
                  <Select value={form.reasoningEffort} onChange={(v) => set('reasoningEffort', v)} options={REASONING_EFFORT_OPTIONS} />
                  <span className="hint">控制推理模型的思考深度，不支持的模型会忽略此项。</span>
                </div>
              </Field>
              <Actions>
                <Button variant="primary" onClick={() => void save()} disabled={saving}>
                  {saving ? '保存中…' : '保存'}
                </Button>
                <Button onClick={() => void testAi()}>测试连接</Button>
                {status && <span className={`status ${status.ok ? 'ok' : 'err'}`}>{status.text}</span>}
              </Actions>
            </Card>
          )}

          {tab === 'agent' && (
            <>
              {renderToolGrid(
                'aiTools',
                '主代理可用工具',
                '主代理（侧边栏对话）可调用的工具，默认全部勾选。取消勾选的工具将被禁用。browser_* 工具需先在「浏览器控制」启用才可勾选。',
                AGENT_TOOLS,
              )}
              {renderToolGrid(
                'aiSubagentTools',
                '调研子代理可用工具',
                '深度调研子代理可调用的工具（不含 deep_research 本身），默认全部勾选。browser_* 工具需先在「浏览器控制」启用才可勾选。',
                SUBAGENT_TOOLS,
              )}
            </>
          )}

          {tab === 'browser' && (
            <>
              <Card>
                <h3>浏览器控制（CDP）</h3>
                <div className="hint">
                  让笔记 agent 通过 CDP 直接操作已打开的真实浏览器：读取已登录、已过反爬的页面，点击输入，截图存档。
                  浏览器和 bi-ji 服务可以在同一台电脑上，也可以在不同电脑上（这台控制那台）。需先在有浏览器的那台电脑上以调试端口启动浏览器（见下方教程）。未启用时 browser_* 工具不会被挂载。
                </div>
                <EnableRow>
                  <Toggle
                    $on={form.browserCdpEnabled === '1'}
                    title={form.browserCdpEnabled === '1' ? '已启用' : '已停用'}
                    onClick={() => set('browserCdpEnabled', form.browserCdpEnabled === '1' ? '0' : '1')}
                  />
                  <span>启用浏览器控制</span>
                </EnableRow>
                <Field>
                  <label>CDP 调试地址</label>
                  <Input
                    value={form.browserCdpUrl}
                    placeholder="http://127.0.0.1:9222"
                    onChange={(e) => set('browserCdpUrl', e.target.value)}
                  />
                  <div className="hint">
                    同一台电脑：http://127.0.0.1:9222；不在同一台电脑：http://&lt;浏览器所在电脑的 IP&gt;:9222（需在浏览器那台电脑上放开监听并放行防火墙，见教程第 2 步）。
                    也可用环境变量 BROWSER_CDP_URL 配置，设置里填的值优先。
                  </div>
                </Field>
                <Actions>
                  <Button variant="primary" onClick={() => void save()} disabled={saving}>
                    {saving ? '保存中…' : '保存'}
                  </Button>
                  <Button onClick={() => void testBrowser()} disabled={busy !== null}>
                    {busy === 'test-browser' ? '连接中…' : '测试连接'}
                  </Button>
                  <Button onClick={() => void disconnectBrowser()} disabled={busy !== null}>断开连接</Button>
                  {status && <span className={`status ${status.ok ? 'ok' : 'err'}`}>{status.text}</span>}
                </Actions>
              </Card>

              <Card>
                <h3>连接状态</h3>
                <div className="hint">
                  打开本页或点击「测试连接」时刷新；「断开连接」不会关闭你的浏览器，下次操作会自动重连。
                </div>
                {!browserInfo ? (
                  <div className="hint" style={{ padding: '12px 0' }}>尚未检测，点「测试连接」查看。</div>
                ) : (
                  <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      地址：<code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{browserInfo.url}</code>
                    </div>
                    <div>
                      状态：
                      {browserInfo.connected ? (
                        <b style={{ color: 'var(--green)' }}>已连接</b>
                      ) : (
                        <b style={{ color: 'var(--red)' }}>未连接</b>
                      )}
                      {browserInfo.version && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>{browserInfo.version}</span>}
                    </div>
                    {browserInfo.reason && (
                      <div className="hint" style={{ wordBreak: 'break-all' }}>{browserInfo.reason}</div>
                    )}
                    {(browserInfo.tabs?.length ?? 0) > 0 && (
                      <>
                        <div>当前打开的标签页（{browserInfo.tabs?.length}）：</div>
                        <TabList>
                          {browserInfo.tabs?.map((t) => (
                            <li key={t.index}>
                              <span className="idx">#{t.index}</span>
                              <span className="ttl">{t.title}</span>
                              <span className="url">{t.url}</span>
                            </li>
                          ))}
                        </TabList>
                      </>
                    )}
                  </div>
                )}
              </Card>

              <Card>
                <h3>使用教程</h3>
                <div style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--text-secondary)' }}>
                  适用于两种常见情况：浏览器和 bi-ji 服务装在同一台电脑；或者这台电脑跑 bi-ji，控制另一台电脑上的浏览器。
                </div>
                <Steps>
                  <li>
                    <b>在有浏览器的那台电脑上启动调试浏览器。</b>
                    把下面的内容保存为 <code>start-browser-cdp.bat</code> 双击运行（仓库 <code>scripts/start-browser-cdp.bat</code> 已有）。
                    它会用独立配置目录启动 Edge/Chrome，第一次打开时登录你需要的网站，登录态会一直保存在那个窗口里；保持窗口开着即可。
                  </li>
                  <li>
                    <b>让跑 bi-ji 的那台电脑能连上它。</b>
                    浏览器和 bi-ji 在同一台电脑：地址填 <code>http://127.0.0.1:9222</code> 即可。
                    不在同一台电脑：先在 .bat 前面加一行 <code>set BIJI_CDP_ADDR=0.0.0.0</code>（放开局域网监听），再在浏览器那台电脑的防火墙放行 TCP 9222 入站，最后把地址填成 <code>http://&lt;浏览器所在电脑的 IP&gt;:9222</code>。
                  </li>
                  <li>
                    <b>启用并保存。</b>
                    打开上方「启用浏览器控制」→ 填地址 → 「测试连接」确认 → 保存。之后「Agent 能力」里的 browser_* 工具才可勾选，agent 就能读页面 / 点击 / 截图了。
                  </li>
                </Steps>
                <div style={{ fontSize: 12.5, lineHeight: 1.9, color: 'var(--text-secondary)', marginTop: 6 }}>
                  <b>两台电脑互相访问不到（不同网段 / NAT 后面）？</b> 用 SSH 隧道代替：在浏览器那台电脑上执行{' '}
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>ssh -N -R 9222:127.0.0.1:9222 用户@bi-ji所在电脑地址</code>
                  ，然后这里地址填 <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>http://127.0.0.1:9222</code> 即可，
                  不用开防火墙。详细步骤见仓库文档 <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>docs/browser-cdp-ssh.md</code>。
                </div>
                <div style={WARNING_STYLE}>
                  {WARN} 安全提示：CDP 允许任何人完全控制你的浏览器窗口。直接跨机器开启时请只在可信内网使用，建议用 <code>BIJI_CDP_ADDR</code> 只绑定到 bi-ji 服务的 IP；用 SSH 隧道则无需开放监听和防火墙。
                </div>
                <CodeBlock>
                  <button className="copy" onClick={() => void copyBat()}>{copied ? '已复制 ✓' : '复制'}</button>
                  <pre>{START_BROWSER_BAT}</pre>
                </CodeBlock>
              </Card>
            </>
          )}

          {tab === 'mcp' && (
            <>
              <Card>
                <h3>MCP 服务器</h3>
                <div className="hint">
                  通过 MCP（Model Context Protocol）扩展 Agent 能力：把外部 MCP 服务器的工具挂载给主代理和调研子代理。
                  可新增/编辑服务器，每行可开关启用；下方可预览每个服务器提供的工具。保存后新对话生效。
                </div>
                {mcpServers.length === 0 ? (
                  <div className="hint" style={{ padding: '12px 0' }}>尚未配置任何 MCP 服务器</div>
                ) : (
                  <McpList>
                    {mcpServers.map((s, i) => (
                      <McpRow key={`${s.name}-${i}`} $enabled={s.enabled !== false}>
                        <Toggle
                          $on={s.enabled !== false}
                          title={s.enabled !== false ? '已启用' : '已停用'}
                          onClick={() => toggleMcp(i)}
                        />
                        <span className="info">
                          <span className="name">{s.name}</span>
                          <span className="meta">
                            {s.type} · {s.type === 'stdio' ? s.command ?? '-' : s.url ?? '-'}
                          </span>
                        </span>
                        <span className="badges">
                          <Button size="sm" onClick={() => setMcpEditor({ index: i, server: s })}>编辑</Button>
                          <Button size="sm" variant="danger" onClick={() => removeMcp(i)}>删除</Button>
                        </span>
                      </McpRow>
                    ))}
                  </McpList>
                )}
                <Actions>
                  <Button variant="primary" onClick={() => setMcpEditor({ index: -1, server: emptyMcpServer() })}>
                    ＋ 新增服务器
                  </Button>
                  <Button variant="success" onClick={() => void save()} disabled={saving}>
                    {saving ? '保存中…' : '保存配置'}
                  </Button>
                  {status && <span className={`status ${status.ok ? 'ok' : 'err'}`}>{status.text}</span>}
                </Actions>
              </Card>

              <Card>
                <ToolGridHeader>
                  <h3>工具预览</h3>
                  <button className="toggle-all" onClick={() => void testMcp()}>
                    {busy === 'test-mcp' ? '连接中…' : '刷新预览'}
                  </button>
                </ToolGridHeader>
                <div className="hint">
                  连接到各 MCP 服务器并列出其提供的工具（未启用的服务器也会显示，方便预览后再开启）。点击「刷新预览」更新。
                </div>
                {!mcpTest ? (
                  <div className="hint" style={{ padding: '12px 0' }}>尚未预览，点击右上角「刷新预览」查看各服务器提供的工具。</div>
                ) : mcpTest.servers.length === 0 ? (
                  <div className="hint" style={{ padding: '12px 0' }}>没有可预览的服务器。</div>
                ) : (
                  <McpServers>
                    {mcpTest.servers.map((s) => (
                      <div className="server" key={s.name}>
                        <div className="server-head">
                          <span className="server-name">{s.name}</span>
                          <span className="hint">{s.tools.length} 个工具</span>
                        </div>
                        {s.error && <div className="server-error">{s.error}</div>}
                        <div className="tools">
                          {s.tools.map((t) => (
                            <span className="tool-chip" key={t.key} title={t.description || t.name}>{t.name}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </McpServers>
                )}
              </Card>

              {mcpEditor && (
                <McpEditorModal
                  server={mcpEditor.server}
                  existingNames={mcpServers.map((s) => s.name)}
                  onClose={() => setMcpEditor(null)}
                  onSave={(s) => saveMcpEditor(s)}
                />
              )}
            </>
          )}

          {tab === 'voice' && (
            <>
            <Card>
              <h3>语音服务</h3>
              <div className="hint">
                语音输入（按住说话转文字发送）与 AI 回复朗读。支持多份配置档案、随时切换：每份档案自由定义接口地址、
                请求字段（body 模板 / 表单字段）、响应字段（点路径取值）与自己的 API Key，兼容阿里云百炼与各类自建 ASR/TTS 服务。
                使用中的档案 ASR 可用时，聊天输入框会出现麦克风按钮。
              </div>
              {voiceProfiles.length === 0 ? (
                <div className="hint" style={{ padding: '12px 0' }}>尚未配置任何语音档案，点击下方「＋ 新增配置」</div>
              ) : (
                <McpList>
                  {voiceProfiles.map((p, i) => {
                    const active = p.name === activeVoiceProfile
                    return (
                      <McpRow key={`${p.name}-${i}`} $enabled={active}>
                        <Toggle
                          $on={active}
                          title={active ? '使用中' : '点击切换为使用中'}
                          disabled={active}
                          onClick={() => set('voiceActiveProfile', p.name)}
                        />
                        <span className="info">
                          <span className="name">{p.name}{active ? '（使用中）' : ''}</span>
                          <span className="meta">ASR {p.asr?.url || '—'} · TTS {p.tts?.url || '—'}</span>
                        </span>
                        <span className="badges">
                          <Button size="sm" onClick={() => setVoiceEditor({ index: i, profile: p })}>编辑</Button>
                          <Button size="sm" variant="danger" onClick={() => removeVoiceProfile(i)}>删除</Button>
                        </span>
                      </McpRow>
                    )
                  })}
                </McpList>
              )}
              <EnableRow>
                <Toggle
                  $on={form.voiceAutoSpeak === '1'}
                  title={form.voiceAutoSpeak === '1' ? '已启用' : '已停用'}
                  onClick={() => set('voiceAutoSpeak', form.voiceAutoSpeak === '1' ? '0' : '1')}
                />
                <span>AI 回复自动朗读</span>
              </EnableRow>
              <EnableRow>
                <Toggle
                  $on={form.voiceAutoSend === '1'}
                  title={form.voiceAutoSend === '1' ? '已启用' : '已停用'}
                  onClick={() => set('voiceAutoSend', form.voiceAutoSend === '1' ? '0' : '1')}
                />
                <span>按住说话松开即发送（关闭则转文字填入输入框待编辑）</span>
              </EnableRow>
              <Actions>
                <Button variant="primary" onClick={() => void save()} disabled={saving}>
                  {saving ? '保存中…' : '保存'}
                </Button>
                <Button onClick={() => setVoiceEditor({ index: -1, profile: emptyVoiceProfile() })}>＋ 新增配置</Button>
                {status && <span className={`status ${status.ok ? 'ok' : 'err'}`}>{status.text}</span>}
              </Actions>
            </Card>

            <Card>
              <h3>接口测试</h3>
              <VoiceTestPanel profile={voiceProfiles.find((p) => p.name === activeVoiceProfile) ?? null} />
            </Card>

            {voiceEditor && (
              <VoiceProfileEditorModal
                profile={voiceEditor.profile}
                existingNames={voiceProfiles.map((p) => p.name)}
                onClose={() => setVoiceEditor(null)}
                onSave={(p) => saveVoiceEditor(p)}
              />
            )}
            </>
          )}

          {tab === 'backup' && (
            <Card>
              <h3>数据库备份</h3>
              <div className="hint">
                选择备份类型：SQLite 文件（指定路径即可，自动创建）或 MySQL（需预先建库）。「一键备份」在备份库中自动建表并同步全部数据（笔记 / 会话 / AI 修改记录 / 设置）。
              </div>
              <Field>
                <label>备份类型</label>
                <div className="select-row">
                  <Select value={form.backupType} onChange={(v) => set('backupType', v)} options={BACKUP_TYPE_OPTIONS} />
                </div>
              </Field>
              {form.backupType === 'sqlite' ? (
                <Field>
                  <label>备份文件路径</label>
                  <Input value={form.backupPath} placeholder="data/backup.db" onChange={(e) => set('backupPath', e.target.value)} />
                </Field>
              ) : (
                <>
                  <FieldRow>
                    <Field>
                      <label>Host</label>
                      <Input value={form.backupHost} placeholder="127.0.0.1" onChange={(e) => set('backupHost', e.target.value)} />
                    </Field>
                    <Field>
                      <label>Port</label>
                      <Input value={form.backupPort} placeholder="3306" onChange={(e) => set('backupPort', e.target.value)} />
                    </Field>
                  </FieldRow>
                  <FieldRow>
                    <Field>
                      <label>User</label>
                      <Input value={form.backupUser} placeholder="root" onChange={(e) => set('backupUser', e.target.value)} />
                    </Field>
                    <Field>
                      <label>Password</label>
                      <Input type="password" value={form.backupPassword} onChange={(e) => set('backupPassword', e.target.value)} />
                    </Field>
                  </FieldRow>
                  <Field>
                    <label>数据库名</label>
                    <Input value={form.backupDatabase} placeholder="bi_ji_backup（需预先创建）" onChange={(e) => set('backupDatabase', e.target.value)} />
                  </Field>
                </>
              )}
              <Actions>
                <Button variant="primary" onClick={() => void save()} disabled={saving}>
                  {saving ? '保存中…' : '保存配置'}
                </Button>
                <Button onClick={() => void testBackup()} disabled={busy !== null}>
                  {busy === 'test-backup' ? '测试中…' : '测试连接'}
                </Button>
                <Button variant="success" onClick={() => void syncBackup()} disabled={busy !== null}>
                  {busy === 'sync' ? '同步中…' : '一键备份'}
                </Button>
                {status && <span className={`status ${status.ok ? 'ok' : 'err'}`}>{status.text}</span>}
              </Actions>
              {lastCounts && (
                <CountGrid>
                  {Object.entries(lastCounts).map(([table, n]) => (
                    <span className="chip" key={table}>{table}: {n}</span>
                  ))}
                </CountGrid>
              )}
            </Card>
          )}
        </Content>
      </Body>
    </Page>
  )
}
