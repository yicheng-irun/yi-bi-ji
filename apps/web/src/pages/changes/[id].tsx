import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'
import { api, type Hunk, type NoteDiff } from '../../api/client'

const Page = styled.div`
  max-width: 900px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 14px;
`

const TopBar = styled.div`
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  h2 { font-size: 18px; font-weight: 700; margin: 0; }
  .spacer { flex: 1; }
`

const TitleChange = styled.div`
  display: flex; align-items: center; gap: 10px; padding: 10px 14px;
  background: var(--orange-bg); border: 1px solid #fcd34d;
  border-radius: var(--radius); font-size: 14px;
  .old { color: var(--text-secondary); text-decoration: line-through; }
  .arrow { color: var(--orange); font-weight: 600; }
`

const HunkBox = styled.div<{ $dimmed: boolean }>`
  border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden;
  opacity: ${(p) => (p.$dimmed ? .4 : 1)};
  transition: opacity .2s;
`

const HunkHeader = styled.div`
  display: flex; align-items: center; gap: 10px;
  background: #f9fafb; padding: 8px 14px; border-bottom: 1px solid var(--border);
  font-size: 12px; color: var(--text-secondary);
  font-family: var(--font-mono);

  .meta { font-weight: 600; }
  .spacer { flex: 1; }
`

const LineRow = styled.div<{ $kind: string }>`
  font-family: var(--font-mono); font-size: 13px; line-height: 1.5;
  padding: 2px 14px; white-space: pre-wrap; word-break: break-all;
  background: ${(p) => p.$kind === '+' ? 'var(--green-bg)' : p.$kind === '-' ? '#fef2f2' : 'transparent'};
  color: ${(p) => p.$kind === '+' ? 'var(--green)' : p.$kind === '-' ? 'var(--red)' : 'var(--text)'};

  &:first-of-type { padding-top: 6px; }
  &:last-of-type { padding-bottom: 6px; }
`

const Hint = styled.div`
  text-align: center; color: var(--text-secondary); font-size: 13px;
  padding: 10px; background: var(--bg-hover); border-radius: var(--radius-lg);
  border: 1px dashed var(--border);
`

const BtnAccept = styled.button<{ $on: boolean }>`
  padding: 3px 10px; font-size: 12px; border-radius: 4px;
  background: ${(p) => (p.$on ? 'var(--green-bg)' : 'transparent')};
  border-color: ${(p) => (p.$on ? 'var(--green)' : 'var(--border)')};
  color: ${(p) => (p.$on ? 'var(--green)' : 'var(--text-secondary)')};
  &:hover { background: ${(p) => (p.$on ? 'var(--green-bg)' : 'var(--bg-hover)')}; }
  &:disabled { opacity: .6; }
`
const BtnReject = styled.button<{ $on: boolean }>`
  padding: 3px 10px; font-size: 12px; border-radius: 4px;
  background: ${(p) => (p.$on ? '#fef2f2' : 'transparent')};
  border-color: ${(p) => (p.$on ? 'var(--red)' : 'var(--border)')};
  color: ${(p) => (p.$on ? 'var(--red)' : 'var(--text-secondary)')};
  &:hover { background: ${(p) => (p.$on ? '#fef2f2' : 'var(--bg-hover)')}; }
  &:disabled { opacity: .6; }
`

function buildFinalContent(committed: string, hunks: Hunk[], accepted: boolean[]) {
  const oldLines = committed.split('\n')
  const out: string[] = []; let cursor = 0
  hunks.forEach((h, i) => {
    const start = h.oldStart - 1
    out.push(...oldLines.slice(cursor, start))
    if (accepted[i]) out.push(...h.lines.filter((l) => l[0] !== '-').map((l) => l.slice(1)))
    else out.push(...h.lines.filter((l) => l[0] !== '+').map((l) => l.slice(1)))
    cursor = start + h.oldLines
  })
  out.push(...oldLines.slice(cursor))
  return out.join('\n')
}

export default function ChangeDetailPage() {
  const { id } = useParams()
  const noteId = Number(id)
  const navigate = useNavigate()

  const [diff, setDiff] = useState<NoteDiff | null>(null)
  const [accepted, setAccepted] = useState<boolean[]>([])

  useEffect(() => {
    void (() => api.getDiff(noteId).then((d) => { setDiff(d); setAccepted(d.hunks.map(() => true)) }).catch(console.error))()
  }, [noteId])

  const finalContent = useMemo(
    () => diff ? buildFinalContent(diff.committedContent, diff.hunks, accepted) : '',
    [diff, accepted],
  )

  const commit = async () => {
    const all = accepted.every(Boolean)
    await api.commitNote(noteId, all ? undefined : finalContent)
    navigate('/changes')
  }

  const discardAll = async () => {
    if (!confirm('放弃所有草稿变更，恢复为已提交版本？')) return
    await api.commitNote(noteId, diff!.committedContent)
    navigate('/changes')
  }

  if (!diff) return <p style={{ color: 'var(--text-secondary)' }}>加载中…</p>

  return (
    <Page>
      <TopBar>
        <button onClick={() => navigate('/changes')} style={{ border: 'none', padding: '6px 8px', background: 'transparent' }}>← 返回</button>
        <h2>{diff.draftTitle || '(无标题)'}</h2>
        <div className="spacer" />
        <button onClick={discardAll}>放弃全部</button>
        <button className="btn-green" onClick={commit}>
          提交（{accepted.filter(Boolean).length}/{diff.hunks.length}）
        </button>
      </TopBar>

      {diff.draftTitle !== diff.committedTitle && (
        <TitleChange>
          <span>标题变更</span>
          <span className="old">{diff.committedTitle || '(空)'}</span>
          <span className="arrow">→</span>
          <span>{diff.draftTitle}</span>
        </TitleChange>
      )}

      {diff.hunks.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 20 }}>正文无差异。</p>}

      {diff.hunks.map((h, i) => (
        <HunkBox key={i} $dimmed={!accepted[i]}>
          <HunkHeader>
            <span className="meta">@@ -{h.oldStart},{h.oldLines} +{h.newStart},{h.newLines} @@</span>
            <div className="spacer" />
            <BtnAccept $on={accepted[i]} disabled={accepted[i]} onClick={() => setAccepted((a) => a.map((v, j) => j === i ? true : v))}>
              ✓ Accept
            </BtnAccept>
            <BtnReject $on={!accepted[i]} disabled={!accepted[i]} onClick={() => setAccepted((a) => a.map((v, j) => j === i ? false : v))}>
              ✗ Reject
            </BtnReject>
          </HunkHeader>
          {h.lines.map((l, j) => <LineRow key={j} $kind={l[0]}>{l}</LineRow>)}
        </HunkBox>
      ))}

      {diff.hunks.length > 0 && (
        <Hint>Reject 的区块将恢复为已提交版本内容；点击「提交」后生效。</Hint>
      )}
    </Page>
  )
}
