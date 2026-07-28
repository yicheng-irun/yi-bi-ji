import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'
import { api, type Hunk, type NoteDiff } from '../../api/client'

const Wrap = styled.div`
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const HunkBox = styled.div`
  border: 1px solid #d0d7de;
  border-radius: 8px;
  overflow: hidden;
`

const HunkHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  background: #ddf4ff;
  padding: 6px 12px;
  font-size: 13px;
  color: #57606a;
  font-family: 'SF Mono', Consolas, monospace;
`

const LineRow = styled.div<{ $kind: string }>`
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px;
  padding: 1px 12px;
  white-space: pre-wrap;
  word-break: break-all;
  background: ${(p) => (p.$kind === '+' ? '#dafbe1' : p.$kind === '-' ? '#ffebe9' : '#fff')};
  color: ${(p) => (p.$kind === '+' ? '#1a7f37' : p.$kind === '-' ? '#cf222e' : 'inherit')};
`

const Gap = styled.div`
  text-align: center;
  color: #57606a;
  font-size: 12px;
  padding: 4px;
  background: #f6f8fa;
  border: 1px dashed #d0d7de;
  border-radius: 8px;
`

function buildFinalContent(committed: string, hunks: Hunk[], accepted: boolean[]) {
  const oldLines = committed.split('\n')
  const out: string[] = []
  let cursor = 0
  hunks.forEach((h, i) => {
    const start = h.oldStart - 1
    out.push(...oldLines.slice(cursor, start))
    if (accepted[i]) {
      out.push(...h.lines.filter((l) => l[0] !== '-').map((l) => l.slice(1)))
    } else {
      out.push(...h.lines.filter((l) => l[0] !== '+').map((l) => l.slice(1)))
    }
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

  const load = () =>
    api.getDiff(noteId).then((d) => {
      setDiff(d)
      setAccepted(d.hunks.map(() => true))
    }).catch(console.error)
  useEffect(() => { void load() }, [noteId])

  const finalContent = useMemo(
    () => (diff ? buildFinalContent(diff.committedContent, diff.hunks, accepted) : ''),
    [diff, accepted],
  )

  const commit = async () => {
    const all = accepted.every(Boolean)
    await api.commitNote(noteId, all ? undefined : finalContent)
    navigate('/changes')
  }

  const discardAll = async () => {
    if (!confirm('确定放弃该笔记的所有草稿变更，恢复到已提交版本？')) return
    await api.commitNote(noteId, diff!.committedContent)
    navigate('/changes')
  }

  if (!diff) return <p>加载中…</p>

  return (
    <Wrap>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h3 style={{ margin: 0 }}>{diff.draftTitle || '(无标题)'}</h3>
        <span style={{ flex: 1 }} />
        <button onClick={discardAll}>放弃全部变更</button>
        <button className="primary" onClick={commit}>
          提交落库（{accepted.filter(Boolean).length}/{diff.hunks.length} 个区块）
        </button>
      </div>
      {diff.draftTitle !== diff.committedTitle && (
        <AlertLine>
          标题变更：「{diff.committedTitle || '(空)'}」→「{diff.draftTitle}」（随提交一起生效）
        </AlertLine>
      )}
      {diff.hunks.length === 0 && <p style={{ color: '#57606a' }}>正文无差异。</p>}
      {diff.hunks.map((h, i) => (
        <HunkBox key={i} style={{ opacity: accepted[i] ? 1 : 0.55 }}>
          <HunkHeader>
            <span>
              @@ -{h.oldStart},{h.oldLines} +{h.newStart},{h.newLines} @@
            </span>
            <span style={{ flex: 1 }} />
            <button onClick={() => setAccepted((a) => a.map((v, j) => (j === i ? true : v)))} disabled={accepted[i]}>
              Accept
            </button>
            <button onClick={() => setAccepted((a) => a.map((v, j) => (j === i ? false : v)))} disabled={!accepted[i]}>
              Reject
            </button>
          </HunkHeader>
          {h.lines.map((l, j) => (
            <LineRow key={j} $kind={l[0]}>{l}</LineRow>
          ))}
        </HunkBox>
      ))}
      <Gap>提示：Reject 的区块将恢复为已提交版本的内容；点击「提交落库」后生效。</Gap>
    </Wrap>
  )
}

const AlertLine = styled.div`
  background: #fff8c5;
  border: 1px solid #d4a72c;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
`
