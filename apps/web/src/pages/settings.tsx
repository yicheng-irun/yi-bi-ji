import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import { api, AGENT_TOOLS, ALL_TOOLS_SENTINEL, SUBAGENT_TOOLS, type AgentToolInfo, type McpServerDraft, type McpTestResult, parseMcpServers, serializeMcpServers, type Settings, REASONING_EFFORT_OPTIONS } from '../api/client'
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

const ToolRow = styled.label`
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-card); cursor: pointer;
  transition: border-color .15s, background .15s;
  &:hover { border-color: var(--accent); background: var(--bg-hover); }
  input { accent-color: var(--accent); margin-top: 3px; flex-shrink: 0; }
  .info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .name { font-size: 13px; font-weight: 600; color: var(--text); }
  .hint { font-size: 12px; color: var(--text-muted); }
`

const ToolGridHeader = styled.div`
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  .toggle-all { font-size: 12px; color: var(--accent); cursor: pointer; border: none; background: none; padding: 0; &:hover { text-decoration: underline; } }
`

const TABS = [
  { key: 'ai', label: '大模型', icon: '🤖' },
  { key: 'agent', label: 'Agent 能力', icon: '🧩' },
  { key: 'mcp', label: 'MCP 服务器', icon: '🔌' },
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

type TabKey = typeof TABS[number]['key']

interface Status {
  ok: boolean
  text: string
}

function emptyMcpServer(): McpServerDraft {
  return { name: '', type: 'http', url: '', enabled: true }
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

  const mcpServers = parseMcpServers(form.mcpServers)

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
          {tools.map((t) => (
            <ToolRow key={t.name}>
              <input
                type="checkbox"
                checked={selected.has(t.name)}
                onChange={() => toggleTool(key, t.name, tools)}
              />
              <span className="info">
                <span className="name">{t.label}</span>
                <span className="hint">{t.hint}</span>
              </span>
            </ToolRow>
          ))}
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
                '主代理（侧边栏对话）可调用的工具，默认全部勾选。取消勾选的工具将被禁用。',
                AGENT_TOOLS,
              )}
              {renderToolGrid(
                'aiSubagentTools',
                '调研子代理可用工具',
                '深度调研子代理可调用的工具（不含 deep_research 本身），默认全部勾选。',
                SUBAGENT_TOOLS,
              )}
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
