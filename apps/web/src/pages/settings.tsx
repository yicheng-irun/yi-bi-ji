import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import { api, type Settings, REASONING_EFFORT_OPTIONS } from '../api/client'
import { Select } from '../components/Select'
import { Loading } from '../components/Loading'
import { useDocTitle } from '../hooks/use-doc-title'

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
  input {
    height: 36px; font-size: 13px; padding: 0 12px;
    background: var(--bg-card); color: var(--text);
  }
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

const TABS = [
  { key: 'ai', label: '大模型', icon: '🤖' },
  { key: 'backup', label: '数据备份', icon: '💾' },
] as const

const BACKUP_TYPE_OPTIONS = [
  { value: 'sqlite', label: 'SQLite 文件' },
  { value: 'mysql', label: 'MySQL' },
]

type TabKey = typeof TABS[number]['key']

interface Status {
  ok: boolean
  text: string
}

export default function SettingsPage() {
  useDocTitle('设置')

  const [params, setParams] = useSearchParams()
  const tab: TabKey = (params.get('tab') as TabKey) || 'ai'

  const [form, setForm] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [lastCounts, setLastCounts] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    api.getSettings().then(setForm).catch((e) => {
      console.error(e)
      setStatus({ ok: false, text: '加载设置失败' })
    })
  }, [])

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

  return (
    <Page>
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
                <input value={form.aiBaseURL} placeholder="https://api.openai.com/v1" onChange={(e) => set('aiBaseURL', e.target.value)} />
              </Field>
              <Field>
                <label>API Key</label>
                <input type="password" value={form.aiApiKey} placeholder="sk-..." onChange={(e) => set('aiApiKey', e.target.value)} />
              </Field>
              <Field>
                <label>模型</label>
                <input value={form.aiModel} placeholder="gpt-4o-mini" onChange={(e) => set('aiModel', e.target.value)} />
              </Field>
              <Field>
                <label>思考强度</label>
                <div className="select-row">
                  <Select value={form.reasoningEffort} onChange={(v) => set('reasoningEffort', v)} options={REASONING_EFFORT_OPTIONS} />
                  <span className="hint">控制推理模型的思考深度，不支持的模型会忽略此项。</span>
                </div>
              </Field>
              <Actions>
                <button className="btn-primary" onClick={() => void save()} disabled={saving}>
                  {saving ? '保存中…' : '保存'}
                </button>
                <button onClick={() => void testAi()}>测试连接</button>
                {status && <span className={`status ${status.ok ? 'ok' : 'err'}`}>{status.text}</span>}
              </Actions>
            </Card>
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
                  <input value={form.backupPath} placeholder="data/backup.db" onChange={(e) => set('backupPath', e.target.value)} />
                </Field>
              ) : (
                <>
                  <FieldRow>
                    <Field>
                      <label>Host</label>
                      <input value={form.backupHost} placeholder="127.0.0.1" onChange={(e) => set('backupHost', e.target.value)} />
                    </Field>
                    <Field>
                      <label>Port</label>
                      <input value={form.backupPort} placeholder="3306" onChange={(e) => set('backupPort', e.target.value)} />
                    </Field>
                  </FieldRow>
                  <FieldRow>
                    <Field>
                      <label>User</label>
                      <input value={form.backupUser} placeholder="root" onChange={(e) => set('backupUser', e.target.value)} />
                    </Field>
                    <Field>
                      <label>Password</label>
                      <input type="password" value={form.backupPassword} onChange={(e) => set('backupPassword', e.target.value)} />
                    </Field>
                  </FieldRow>
                  <Field>
                    <label>数据库名</label>
                    <input value={form.backupDatabase} placeholder="bi_ji_backup（需预先创建）" onChange={(e) => set('backupDatabase', e.target.value)} />
                  </Field>
                </>
              )}
              <Actions>
                <button className="btn-primary" onClick={() => void save()} disabled={saving}>
                  {saving ? '保存中…' : '保存配置'}
                </button>
                <button onClick={() => void testBackup()} disabled={busy !== null}>
                  {busy === 'test-backup' ? '测试中…' : '测试连接'}
                </button>
                <button className="btn-green" onClick={() => void syncBackup()} disabled={busy !== null}>
                  {busy === 'sync' ? '同步中…' : '一键备份'}
                </button>
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
