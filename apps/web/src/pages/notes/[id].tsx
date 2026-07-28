import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import styled, { keyframes } from 'styled-components'
import { api, type Note } from '../../api/client'
import { ChatSidebar } from '../../components/ChatSidebar'

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

const Toolbar = styled.div`
  display: flex; align-items: center; gap: 12px; flex-shrink: 0;
  flex-wrap: wrap; padding: 2px 0;

  .version { font-size: 12px; color: var(--text-secondary); font-weight: 500; }
  .status { font-size: 12px; display: flex; align-items: center; gap: 5px; }
  .status .dot { width: 7px; height: 7px; border-radius: 50%; }
  .spacer { flex: 1; }

  .link-diff {
    font-size: 12px; color: var(--orange); display: flex; align-items: center; gap: 4px;
    &:hover { text-decoration: underline; }
  }
`

const TitleInput = styled.input`
  font-size: 22px; font-weight: 700; width: 100%;
  border: none; border-bottom: 2px solid transparent;
  padding: 8px 4px; background: transparent; border-radius: 0;
  letter-spacing: -.01em;
  &:focus { border-bottom-color: var(--accent); box-shadow: none; }
  &::placeholder { font-weight: 400; color: var(--text-muted); }
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
  const [pendingRemote, setPendingRemote] = useState<RemoteDraft | null>(null)
  const [toast, setToast] = useState('')
  const [showChat, setShowChat] = useState(true)

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
    }).catch(() => navigate('/'))
  }, [noteId, navigate])

  useEffect(() => {
    const es = new EventSource('/api/events')
    es.addEventListener('note-updated', (e) => {
      const evt = JSON.parse((e as MessageEvent).data) as RemoteDraft & { noteId: number }
      if (evt.noteId !== noteId) return
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

  const save = useCallback(async (base?: RemoteDraft) => {
    const r = base ?? remote
    if (!r) return
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
    }
  }, [noteId, remote, title, content, showToast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); void save() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  if (!note) return <p style={{ color: 'var(--text-secondary)' }}>加载中…</p>

  return (
    <Wrap>
      <EditorPane>
        <Toolbar>
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
          <div className="spacer" />
          <button onClick={() => setShowChat((s) => !s)}>
            {showChat ? '隐藏 AI' : 'AI 助手'}
          </button>
          <button className="btn-danger" onClick={async () => {
            if (!confirm('确定删除这篇笔记？')) return
            await api.deleteNote(noteId)
            navigate('/')
          }}>删除</button>
        </Toolbar>

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
