import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { api, type Settings, REASONING_EFFORT_OPTIONS } from '../api/client'
import { Select } from '../components/Select'
import { Loading } from '../components/Loading'
import { useDocTitle } from '../hooks/use-doc-title'

const Page = styled.div`
  max-width: 640px; margin: 0 auto;
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
  input {
    height: 36px; font-size: 13px; padding: 0 12px;
    background: var(--bg-card); color: var(--text);
  }
  .select-row { display: flex; align-items: center; gap: 10px; }
  .select-row > div { flex: initial; width: 180px; }
`

const Actions = styled.div`
  display: flex; align-items: center; gap: 10px;
  .status { font-size: 12.5px; }
  .status.ok { color: var(--green); }
  .status.err { color: var(--red); }
`

export default function SettingsPage() {
  useDocTitle('设置')

  const [form, setForm] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    api.getSettings().then(setForm).catch((e) => {
      console.error(e)
      setStatus({ ok: false, text: '加载设置失败' })
    })
  }, [])

  if (!form) return <Loading />

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

  const test = async () => {
    setStatus({ ok: true, text: '测试中…' })
    try {
      const r = await api.testSettings()
      setStatus(r.ok ? { ok: true, text: `连接成功：${r.text}` } : { ok: false, text: r.error || '连接失败' })
    } catch (e) {
      setStatus({ ok: false, text: (e as Error).message || '连接失败' })
    }
  }

  return (
    <Page>
      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>设置</h2>

      <Card>
        <h3>大模型配置</h3>
        <div className="hint">这里的配置会覆盖 .env 里的默认值，保存后对新的对话立即生效。</div>
        <Field>
          <label>Base URL</label>
          <input
            value={form.aiBaseURL}
            placeholder="https://api.openai.com/v1"
            onChange={(e) => set('aiBaseURL', e.target.value)}
          />
        </Field>
        <Field>
          <label>API Key</label>
          <input
            type="password"
            value={form.aiApiKey}
            placeholder="sk-..."
            onChange={(e) => set('aiApiKey', e.target.value)}
          />
        </Field>
        <Field>
          <label>模型</label>
          <input
            value={form.aiModel}
            placeholder="gpt-4o-mini"
            onChange={(e) => set('aiModel', e.target.value)}
          />
        </Field>
        <Field>
          <label>思考强度</label>
          <div className="select-row">
            <Select
              value={form.reasoningEffort}
              onChange={(v) => set('reasoningEffort', v)}
              options={REASONING_EFFORT_OPTIONS}
            />
            <span className="hint">控制推理模型的思考深度，不支持的模型会忽略此项。</span>
          </div>
        </Field>
        <Actions>
          <button className="btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
          <button onClick={() => void test()}>测试连接</button>
          {status && <span className={`status ${status.ok ? 'ok' : 'err'}`}>{status.text}</span>}
        </Actions>
      </Card>
    </Page>
  )
}
