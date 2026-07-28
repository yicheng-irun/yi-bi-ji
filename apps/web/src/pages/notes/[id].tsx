import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'
import { api, type Note } from '../../api/client'
import { ChatSidebar } from '../../components/ChatSidebar'

const Wrap = styled.div`
  display: flex;
  gap: 16px;
  height: 100%;
`

const EditorPane = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
`

const TitleInput = styled.input`
  font-size: 20px;
  font-weight: 600;
  background: #fff;
`

const ContentArea = styled.textarea`
  flex: 1;
  resize: none;
  background: #fff;
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 14px;
  line-height: 1.6;
  min-height: 300px;
`

const AlertBar = styled.div`
  background: #fff8c5;
  border: 1px solid #d4a72c;
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
`

const Toast = styled.div`
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: #24292f;
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  z-index: 100;
`

const ToolRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #57606a;
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
    setTimeout(() => setToast(''), 4000)
  }, [])

  useEffect(() => {
    api.getNote(noteId).then((n) => {
      setNote(n)
      setRemote({
        draftTitle: n.draftTitle,
        draftContent: n.draftContent,
        draftContentVersion: n.draftContentVersion,
        draftTitleVersion: n.draftTitleVersion,
      })
      setTitle(n.draftTitle)
      setContent(n.draftContent)
    }).catch(() => navigate('/'))
  }, [noteId, navigate])

  useEffect(() => {
    const es = new EventSource('/api/events')
    es.addEventListener('note-updated', (e) => {
      const evt = JSON.parse((e as MessageEvent).data) as RemoteDraft & { noteId: number }
      if (evt.noteId !== noteId) return
      const next: RemoteDraft = {
        draftTitle: evt.draftTitle,
        draftContent: evt.draftContent,
        draftContentVersion: evt.draftContentVersion,
        draftTitleVersion: evt.draftTitleVersion,
      }
      if (!dirtyRef.current) {
        setRemote(next)
        setTitle(next.draftTitle)
        setContent(next.draftContent)
        setPendingRemote(null)
      } else {
        setRemote((cur) => {
          if (cur && evt.draftContentVersion === cur.draftContentVersion && evt.draftTitleVersion === cur.draftTitleVersion) {
            return cur
          }
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

  const save = useCallback(
    async (base?: RemoteDraft) => {
      const r = base ?? remote
      if (!r) return
      try {
        const n = await api.saveDraft(noteId, {
          draftTitle: title,
          draftContent: content,
          baseContentVersion: r.draftContentVersion,
          baseTitleVersion: r.draftTitleVersion,
        })
        setNote(n)
        setRemote({
          draftTitle: n.draftTitle,
          draftContent: n.draftContent,
          draftContentVersion: n.draftContentVersion,
          draftTitleVersion: n.draftTitleVersion,
        })
        setPendingRemote(null)
        showToast('草稿已保存')
      } catch (err) {
        const e = err as { status?: number; body?: { note?: Note } }
        if (e.status === 409 && e.body?.note) {
          const n = e.body.note
          setPendingRemote({
            draftTitle: n.draftTitle,
            draftContent: n.draftContent,
            draftContentVersion: n.draftContentVersion,
            draftTitleVersion: n.draftTitleVersion,
          })
          showToast('保存冲突：远端草稿已被修改')
        } else {
          showToast('保存失败')
        }
      }
    },
    [noteId, remote, title, content, showToast],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  const discardLocalAndSync = () => {
    if (!pendingRemote) return
    setRemote(pendingRemote)
    setTitle(pendingRemote.draftTitle)
    setContent(pendingRemote.draftContent)
    setPendingRemote(null)
  }

  const overwriteRemote = () => {
    if (!pendingRemote) return
    void save(pendingRemote)
  }

  const remove = async () => {
    if (!confirm('确定删除这篇笔记？')) return
    await api.deleteNote(noteId)
    navigate('/')
  }

  if (!note) return <p>加载中…</p>

  return (
    <Wrap>
      <EditorPane>
        <ToolRow>
          <span>草稿版本 v{remote?.draftContentVersion ?? '-'}</span>
          {dirty ? <span style={{ color: '#bf8700' }}>● 未保存（Ctrl+S 保存）</span> : <span>已保存</span>}
          {note.hasChanges && <Link to={`/changes/${note.id}`}>查看未提交变更 →</Link>}
          <span style={{ flex: 1 }} />
          <button onClick={() => setShowChat((s) => !s)}>{showChat ? '隐藏 AI' : '显示 AI'}</button>
          <button className="danger" onClick={remove}>删除</button>
        </ToolRow>
        {pendingRemote && (
          <AlertBar>
            <span>远端草稿有新变更（可能是 AI 或其他页面修改），与本地未保存内容冲突。</span>
            <span style={{ flex: 1 }} />
            <button onClick={discardLocalAndSync}>放弃本地并同步</button>
            <button className="primary" onClick={overwriteRemote}>用本地覆盖远端</button>
          </AlertBar>
        )}
        <TitleInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" />
        <ContentArea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="用 markdown 开始记录…"
        />
      </EditorPane>
      {showChat && <ChatSidebar currentNoteId={noteId} />}
      {toast && <Toast>{toast}</Toast>}
    </Wrap>
  )
}
