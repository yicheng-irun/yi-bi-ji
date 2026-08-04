import { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import {
  api,
  MEMORY_KIND_LABEL,
  MEMORY_KINDS,
  type Memory,
  type MemoryKind,
} from '../api/client'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { Empty } from '../ui/Empty'
import { Loading } from '../ui/Loading'
import { Modal, ModalFooterCancel } from '../ui/Modal'
import { Select } from '../ui/Select'
import { TagInput } from '../ui/TagInput'
import { SiteTitle } from '../ui/SiteTitle'

const Page = styled.div`
  max-width: 760px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 16px;
`

const CreateBar = styled.div`
  display: flex; gap: 10px; align-items: center;
  .grow { flex: 1; min-width: 0; }
  .kind { width: 110px; flex-shrink: 0; }
`

const ChipRow = styled.div`
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
`

const Chip = styled.button<{ $on: boolean }>`
  height: 28px; padding: 0 12px; font-size: 12px; border-radius: 14px;
  background: ${(p) => (p.$on ? 'var(--accent-light)' : 'var(--bg-card)')};
  border-color: ${(p) => (p.$on ? 'var(--accent)' : 'var(--border)')};
  color: ${(p) => (p.$on ? 'var(--accent)' : 'var(--text-secondary)')};
  font-weight: ${(p) => (p.$on ? 600 : 400)};
  .n { opacity: .6; margin-left: 4px; }
`

const Card = styled.div<{ $archived?: boolean }>`
  display: flex; align-items: flex-start; gap: 14px;
  padding: 14px 18px; background: var(--bg-card);
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  opacity: ${(p) => (p.$archived ? 0.55 : 1)};

  .info { flex: 1; min-width: 0; }
  .content {
    font-size: 14px; line-height: 1.6; word-break: break-word; white-space: pre-wrap;
    ${(p) => (p.$archived ? 'text-decoration: line-through; color: var(--text-secondary);' : '')}
  }
  .meta { font-size: 12px; color: var(--text-secondary); margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
`

const Tag = styled.span`
  font-size: 11px; color: var(--text-muted); background: var(--bg-hover);
  border-radius: 4px; padding: 1px 6px;
`

const Count = styled.div`
  font-size: 13px; color: var(--text-secondary); padding: 0 2px;
`

const FormRow = styled.div`
  display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px;
  label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
  textarea {
    width: 100%; min-height: 90px; resize: vertical;
    font-size: 14px; line-height: 1.6; padding: 10px 12px;
    border: 1px solid var(--border); border-radius: var(--radius);
    background: var(--bg); font-family: inherit;
    &:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,70,229,.08); outline: none; }
  }
`

const KIND_BADGE: Record<MemoryKind, 'neutral' | 'accent' | 'success' | 'warning'> = {
  fact: 'neutral',
  preference: 'accent',
  decision: 'success',
  todo: 'warning',
}

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kind, setKind] = useState<MemoryKind | ''>('')
  const [showArchived, setShowArchived] = useState(false)
  const [query, setQuery] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newKind, setNewKind] = useState<MemoryKind>('fact')
  const [editing, setEditing] = useState<Memory | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editKind, setEditKind] = useState<MemoryKind>('fact')
  const [editTags, setEditTags] = useState<string[]>([])

  const load = useCallback(() => {
    const q = query.trim()
    return api
      .listMemories({
        status: showArchived ? 'archived' : 'confirmed',
        kind: kind || undefined,
        q: q || undefined,
      })
      .then((r) => { setMemories(r.memories); setError('') })
      .catch((e) => { console.error(e); setError('加载失败，请稍后重试') })
      .finally(() => setLoading(false))
  }, [kind, showArchived, query])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => void load(), query.trim() ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, query])

  const allTags = useMemo(() => [...new Set(memories.flatMap((m) => m.tags))], [memories])

  const create = async () => {
    const content = newContent.trim()
    if (!content) return
    try {
      await api.createMemory({ content, kind: newKind })
      setNewContent('')
      void load()
    } catch {
      setError('创建失败')
    }
  }

  const openEdit = (m: Memory) => {
    setEditing(m)
    setEditContent(m.content)
    setEditKind(m.kind)
    setEditTags(m.tags)
  }

  const saveEdit = async () => {
    if (!editing || !editContent.trim()) return
    try {
      await api.updateMemory(editing.id, { content: editContent.trim(), kind: editKind, tags: editTags })
      setEditing(null)
      void load()
    } catch {
      setError('保存失败')
    }
  }

  const toggleArchive = async (m: Memory) => {
    try {
      if (m.status === 'archived') await api.confirmMemory(m.id)
      else await api.archiveMemory(m.id)
      void load()
    } catch {
      setError('操作失败')
    }
  }

  const remove = async (m: Memory) => {
    if (!confirm(`彻底删除这条记忆？\n\n${m.content}`)) return
    try {
      await api.deleteMemory(m.id)
      void load()
    } catch {
      setError('删除失败')
    }
  }

  return (
    <Page>
      <SiteTitle title="记忆" />
      <CreateBar>
        <Input
          size="lg"
          className="grow"
          placeholder="手动记一条：事实 / 偏好 / 决定 / 待办…"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <div className="kind">
          <Select
            value={newKind}
            onChange={(v) => setNewKind(v as MemoryKind)}
            options={MEMORY_KINDS.map((k) => ({ value: k.value, label: k.label }))}
          />
        </div>
        <Button size="lg" variant="primary" onClick={create}>记下</Button>
      </CreateBar>

      <Input
        placeholder="搜索记忆内容…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
      />

      <ChipRow>
        <Chip $on={!kind} onClick={() => setKind('')}>全部</Chip>
        {MEMORY_KINDS.map((k) => (
          <Chip key={k.value} $on={kind === k.value} onClick={() => setKind(kind === k.value ? '' : k.value)}>
            {k.label}
          </Chip>
        ))}
        <Chip $on={showArchived} onClick={() => setShowArchived((s) => !s)}>已归档</Chip>
      </ChipRow>

      {loading && <Loading />}
      {error && !loading && <Empty title={error} />}

      {!loading && !error && memories.length > 0 && <Count>共 {memories.length} 条记忆</Count>}

      {!loading && !error && memories.map((m) => (
        <Card key={m.id} $archived={m.status === 'archived'}>
          <div className="info">
            <div className="content">{m.content}</div>
            <div className="meta">
              <Badge variant={KIND_BADGE[m.kind]}>{MEMORY_KIND_LABEL[m.kind]}</Badge>
              <span>{new Date(m.updatedAt).toLocaleString('zh-CN')}</span>
              {m.sourceThreadId && <span>来自对话</span>}
              {m.tags.map((t) => <Tag key={t}>#{t}</Tag>)}
            </div>
          </div>
          <div className="actions">
            <Button size="sm" onClick={() => openEdit(m)}>编辑</Button>
            <Button size="sm" onClick={() => toggleArchive(m)}>
              {m.status === 'archived' ? '恢复' : '归档'}
            </Button>
            <Button size="sm" variant="danger" onClick={() => remove(m)}>删除</Button>
          </div>
        </Card>
      ))}

      {!loading && !error && memories.length === 0 && (
        <Empty
          icon="🧠"
          title={showArchived ? '没有已归档的记忆' : query.trim() ? '没有匹配的记忆' : '还没有记忆，AI 会在对话中主动沉淀，也可以手动记一条'}
        />
      )}

      {editing && (
        <Modal
          title="编辑记忆"
          onClose={() => setEditing(null)}
          footer={
            <>
              <ModalFooterCancel onClose={() => setEditing(null)} />
              <Button variant="primary" onClick={saveEdit}>保存</Button>
            </>
          }
        >
          <FormRow>
            <label>内容</label>
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} autoFocus />
          </FormRow>
          <FormRow>
            <label>类型</label>
            <Select
              value={editKind}
              onChange={(v) => setEditKind(v as MemoryKind)}
              options={MEMORY_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            />
          </FormRow>
          <FormRow>
            <label>标签</label>
            <TagInput value={editTags} onChange={setEditTags} suggestions={allTags} placeholder="输入标签，回车确认" />
          </FormRow>
        </Modal>
      )}
    </Page>
  )
}
