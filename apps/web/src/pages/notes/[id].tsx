import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import styled, { keyframes } from 'styled-components'
import { api, CLIENT_ID, type Note } from '../../api/client'
import { Loading } from '../../components/Loading'
import { ChatSidebar } from '../../components/ChatSidebar'
import { useDocTitle } from '../../hooks/use-doc-title'

const slideUp = keyframes`
  from { opacity: 0; transform: translate(-50%, 10px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
`

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
`

const Wrap = styled.div`
  display: flex; gap: 20px; height: 100%; align-items: flex-start;
`

const EditorPane = styled.div`
  flex: 1; display: flex; flex-direction: column; gap: 10px;
  min-width: 0; height: 100%;
`



const TitleInput = styled.input`
  font-size: 22px; font-weight: 700; width: 100%;
  border: none; border-bottom: 2px solid transparent;
  padding: 8px 4px; background: transparent; border-radius: 0;
  letter-spacing: -.01em;
  &:focus { border-bottom-color: var(--accent); box-shadow: none; }
  &::placeholder { font-weight: 400; color: var(--text-muted); }
`

const MetaRow = styled.div`
  display: flex; gap: 10px; flex-shrink: 0; align-items: center;

  .tags-input {
    flex: 1; min-width: 0; height: 30px; font-size: 12px;
    background: transparent; border: 1px solid transparent; border-radius: var(--radius);
    color: var(--text-secondary); padding: 0 6px;
    &:hover { border-color: var(--border); background: var(--bg-card); }
    &:focus { border-color: var(--accent); background: var(--bg-card); box-shadow: none; }
    &::placeholder { color: var(--text-muted); }
  }

  .version { font-size: 12px; color: var(--text-muted); font-weight: 500; flex-shrink: 0; }
  .status { font-size: 12px; display: flex; align-items: center; gap: 5px; flex-shrink: 0; color: var(--text-secondary); }
  .status .dot { width: 7px; height: 7px; border-radius: 50%; }

  .link-diff {
    font-size: 12px; color: var(--orange); display: flex; align-items: center; gap: 4px; flex-shrink: 0;
    &:hover { text-decoration: underline; }
  }
`

const TextareaWrapper = styled.div`
  flex: 1; position: relative; border-radius: var(--radius-lg);
  overflow: hidden; border: 1px solid var(--border);
  transition: border-color .15s; background: var(--bg-card);
  &:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(79,70,229,.08); }
`

const ContentArea = styled.textarea`
  position: absolute; inset: 0; width: 100%; height: 100%;
  resize: none; border: none; padding: 16px 20px;
  font-family: var(--font-mono); font-size: 14px; line-height: 1.7;
  background: transparent; border-radius: 0;
  &:focus { box-shadow: none; }
  &::selection { background: rgba(79,70,229,.15); }
`

const AlertBar = styled.div`
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: var(--orange-bg); border: 1px solid #fcd34d;
  border-radius: var(--radius); padding: 10px 14px;
  font-size: 13px; color: var(--orange);
  animation: ${fadeIn} .2s ease;

  .spacer { flex: 1; }
  button { font-size: 12px; }
`

const Toast = styled.div`
  position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
  background: var(--text); color: #fff; padding: 10px 20px;
  border-radius: var(--radius-lg); z-index: 200; font-size: 14px;
  box-shadow: 0 8px 24px rgba(0,0,0,.15);
  animation: ${slideUp} .2s ease;
`

interface RemoteDraft {
  draftTitle: string
  draftContent: string
  draftContentVersion: number
  draftTitleVersion: number
}

export default function NoteEditorPage() {
  const { id } = useParams()
  const noteId = Number(id)
  const navigate = useNavigate()

  const [note, setNote] = useState<Note | null>(null)
  const [remote, setRemote] = useState<RemoteDraft | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagsText, setTagsText] = useState('')
  const [allTags, setAllTags] = useState<string[]>([])
  const [pendingRemote, setPendingRemote] = useState<RemoteDraft | null>(null)
  const [toast, setToast] = useState('')
  const [showChat, setShowChat] = useState(true)
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null)

  useDocTitle(note ? (title || '(无标题)') : null)

  useEffect(() => {
    setSlotEl(document.getElementById('topbar-slot'))
  }, [])

  const dirtyRef = useRef(false)
  const dirty = remote !== null && (title !== remote.draftTitle || content !== remote.draftContent)
  dirtyRef.current = dirty

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }, [])

  useEffect(() => {
    api.getNote(noteId).then((n) => {
      setNote(n)
      setRemote({ draftTitle: n.draftTitle, draftContent: n.draftContent, draftContentVersion: n.draftContentVersion, draftTitleVersion: n.draftTitleVersion })
      setTitle(n.draftTitle)
      setContent(n.draftContent)
      setTagsText(n.tags.join(', '))
    }).catch(() => navigate('/'))
    api.listNotes().then((list) => {
      setAllTags([...new Set(list.flatMap((x) => x.tags))])
    }).catch(() => {})
  }, [noteId, navigate])

  const saveMeta = useCallback(async (tagsStr: string) => {
    if (!note) return
    const tags = tagsStr.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    if (JSON.stringify(tags) === JSON.stringify(note.tags)) return
    try {
      const n = await api.updateMeta(noteId, { tags })
      setNote(n)
      showToast('标签已保存')
    } catch {
      showToast('标签保存失败')
    }
  }, [note, noteId, showToast])

  useEffect(() => {
    const es = new EventSource('/api/events')
    es.addEventListener('note-updated', (e) => {
      const evt = JSON.parse((e as MessageEvent).data) as RemoteDraft & { noteId: number; clientId?: string }
      if (evt.noteId !== noteId) return
      // 自己保存动作产生的回声事件：本地状态已由保存请求的响应更新，直接忽略，
      // 避免 SSE 先于 HTTP 响应到达时误判为"远端有更新"
      if (evt.clientId === CLIENT_ID) return
      const next: RemoteDraft = { draftTitle: evt.draftTitle, draftContent: evt.draftContent, draftContentVersion: evt.draftContentVersion, draftTitleVersion: evt.draftTitleVersion }
      if (!dirtyRef.current) {
        setRemote(next); setTitle(next.draftTitle); setContent(next.draftContent); setPendingRemote(null)
      } else {
        setRemote((cur) => {
          if (cur && evt.draftContentVersion === cur.draftContentVersion && evt.draftTitleVersion === cur.draftTitleVersion) return cur
          setPendingRemote(next)
          return cur
        })
      }
    })
    es.addEventListener('note-committed', (e) => {
      const evt = JSON.parse((e as MessageEvent).data) as { noteId: number }
      if (evt.noteId === noteId) api.getNote(noteId).then(setNote)
    })
    return () => es.close()
  }, [noteId])

  const savingRef = useRef(false)

  const save = useCallback(async (base?: RemoteDraft) => {
    const r = base ?? remote
    if (!r) return
    // 上一次保存尚未返回时忽略本次触发，避免用旧 base 版本发起请求造成假冲突（409）
    if (savingRef.current) return
    savingRef.current = true
    try {
      const n = await api.saveDraft(noteId, {
        draftTitle: title, draftContent: content,
        baseContentVersion: r.draftContentVersion, baseTitleVersion: r.draftTitleVersion,
      })
      setNote(n)
      setRemote({ draftTitle: n.draftTitle, draftContent: n.draftContent, draftContentVersion: n.draftContentVersion, draftTitleVersion: n.draftTitleVersion })
      setPendingRemote(null)
      showToast('已保存')
    } catch (err) {
      const e = err as { status?: number; body?: { note?: Note } }
      if (e.status === 409 && e.body?.note) {
        const n = e.body.note
        setPendingRemote({ draftTitle: n.draftTitle, draftContent: n.draftContent, draftContentVersion: n.draftContentVersion, draftTitleVersion: n.draftTitleVersion })
        showToast('保存冲突：远端已被修改')
      } else {
        showToast('保存失败')
      }
    } finally {
      savingRef.current = false
    }
  }, [noteId, remote, title, content, showToast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); void save() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  if (!note) return <Loading />

  return (
    <Wrap>
      {slotEl && createPortal(
        <>
          <button onClick={() => setShowChat((s) => !s)}>
            {showChat ? '隐藏 AI' : 'AI 助手'}
          </button>
          <button className="btn-danger" onClick={async () => {
            if (!confirm('删除这篇笔记？将标记为待确认删除，需到「变更」页提交后才会真正删除。')) return
            await api.deleteNote(noteId)
            navigate('/changes')
          }}>删除</button>
        </>,
        slotEl,
      )}
      <EditorPane>
        {pendingRemote && (
          <AlertBar>
            <span>远端草稿有更新，与本地未保存内容冲突</span>
            <div className="spacer" />
            <button onClick={() => {
              if (!pendingRemote) return
              setRemote(pendingRemote); setTitle(pendingRemote.draftTitle); setContent(pendingRemote.draftContent); setPendingRemote(null)
            }}>放弃本地并同步</button>
            <button className="btn-primary" onClick={() => { if (pendingRemote) save(pendingRemote) }}>
              用本地覆盖远端
            </button>
          </AlertBar>
        )}

        <MetaRow>
          <input
            className="tags-input"
            list="tag-options"
            value={tagsText}
            placeholder="标签，用逗号分隔（可自由输入）"
            onChange={(e) => setTagsText(e.target.value)}
            onBlur={() => void saveMeta(tagsText)}
          />
          <datalist id="tag-options">
            {allTags.map((t) => <option key={t} value={t} />)}
          </datalist>
          <span className="version">v{remote?.draftContentVersion ?? '-'}</span>
          <span className="status">
            <span className="dot" style={{ background: dirty ? 'var(--orange)' : 'var(--green)' }} />
            {dirty ? '未保存 (Ctrl+S)' : '已保存'}
          </span>
          {note.hasChanges && (
            <Link className="link-diff" to={`/changes/${note.id}`}>
              未提交的变更 →
            </Link>
          )}
        </MetaRow>

        <TitleInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="笔记标题" />

        <TextareaWrapper>
          <ContentArea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="用 markdown 开始书写…"
          />
        </TextareaWrapper>
      </EditorPane>
      {showChat && <ChatSidebar currentNoteId={noteId} />}
      {toast && <Toast>{toast}</Toast>}
    </Wrap>
  )
}
