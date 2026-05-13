import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getAdminSupportMessages,
  getAdminSupportThreads,
  getAdminSupportTyping,
  postAdminCloseThread,
  postAdminMarkRead,
  postAdminSupportReply,
  postAdminSupportTyping,
  type SupportMessage,
  type SupportThread,
} from '../../../api/admin'
import {
  encodeSupportAttachmentFiles,
  fileLooksLikeVideo,
  isAcceptableSupportMediaFile,
  resolveSupportMediaUrl,
} from '../../../lib/supportAttachments'
import { useAdminSupportThreadSelection } from '../../../hooks/useAdminSupportThreadSelection'
import { useStickToBottomSupportChat } from '../../../hooks/useStickToBottomSupportChat'
import { useAuth } from '../../../store/authStore'

const FAREWELL_CLOSE_MESSAGE = 'Рады что смогли помочь! Обращайтесь!'

function dedupeThreads(list: SupportThread[]): SupportThread[] {
  const m = new Map<string, SupportThread>()
  for (const t of list) {
    const id = String(t.userId).trim().toLowerCase()
    if (!m.has(id)) m.set(id, { ...t, userId: String(t.userId).trim() })
  }
  return [...m.values()]
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function ChatsTab() {
  const { token } = useAuth()
  const [threads, setThreads] = useState<SupportThread[]>([])
  const [selectedId, setSelectedId] = useAdminSupportThreadSelection()
  const [messages, setMessages] = useState<SupportMessage[]>([])
  const [replyDraft, setReplyDraft] = useState('')
  const [replyPendingFiles, setReplyPendingFiles] = useState<{ id: string; file: File; url: string }[]>([])
  const [sendErr, setSendErr] = useState<string | null>(null)
  const [supportUserTyping, setSupportUserTyping] = useState(false)
  const replyFileInputRef = useRef<HTMLInputElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const adminTypingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addReplyFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return
    setReplyPendingFiles((prev) => {
      const next = [...prev]
      let added = 0
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (!isAcceptableSupportMediaFile(file)) continue
        added++
        next.push({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) })
      }
      if (files.length > 0 && added === 0) {
        queueMicrotask(() =>
          setSendErr('Файл не подошёл. Выберите фото или видео (JPEG, PNG, HEIC, MP4…).'),
        )
      } else if (added > 0) {
        queueMicrotask(() => setSendErr(null))
      }
      return next
    })
  }, [])

  const removeReplyPending = (id: string) => {
    setReplyPendingFiles((prev) => {
      const t = prev.find((p) => p.id === id)
      if (t) URL.revokeObjectURL(t.url)
      return prev.filter((p) => p.id !== id)
    })
  }

  useEffect(() => {
    if (!token) return
    const load = async () => {
      try {
        const r = await getAdminSupportThreads(token)
        setThreads(dedupeThreads(r.threads))
      } catch {
        setThreads([])
      }
    }
    void load()
    const t = window.setInterval(load, 8000)
    return () => window.clearInterval(t)
  }, [token])

  useEffect(() => {
    if (!selectedId || !token) {
      setMessages([])
      return
    }
    let cancelled = false
    let firstLoad = true
    const load = async () => {
      try {
        const r = await getAdminSupportMessages(token, selectedId)
        if (!cancelled) setMessages(r.messages)
        await postAdminMarkRead(token, selectedId)
        if (!cancelled) {
          try {
            const tr = await getAdminSupportThreads(token)
            setThreads(dedupeThreads(tr.threads))
          } catch {
            /* список оставляем как есть */
          }
        }
      } catch {
        if (!cancelled && firstLoad) setMessages([])
      } finally {
        firstLoad = false
      }
    }
    void load()
    const intervalId = window.setInterval(() => void load(), 3000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [selectedId, token])

  useEffect(() => {
    if (!selectedId || !token) {
      setSupportUserTyping(false)
      return
    }
    const poll = async () => {
      try {
        const { userTyping } = await getAdminSupportTyping(token, selectedId)
        setSupportUserTyping(userTyping)
      } catch {
        setSupportUserTyping(false)
      }
    }
    void poll()
    const id = window.setInterval(poll, 3000)
    return () => window.clearInterval(id)
  }, [selectedId, token])

  useEffect(() => {
    if (!selectedId || !token) return
    if (adminTypingDebounceRef.current) clearTimeout(adminTypingDebounceRef.current)
    if (!replyDraft.trim()) return
    adminTypingDebounceRef.current = setTimeout(() => {
      adminTypingDebounceRef.current = null
      void postAdminSupportTyping(token, selectedId)
    }, 450)
    return () => {
      if (adminTypingDebounceRef.current) clearTimeout(adminTypingDebounceRef.current)
    }
  }, [replyDraft, selectedId, token])

  const scrollChatsToEnd = useStickToBottomSupportChat(messagesScrollRef, [messages, replyPendingFiles])

  useEffect(() => {
    setReplyPendingFiles((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url))
      return []
    })
    setReplyDraft('')
  }, [selectedId])

  const selectedThread = useMemo(
    () => threads.find((t) => String(t.userId) === String(selectedId)) ?? null,
    [threads, selectedId]
  )

  const sendReply = async () => {
    if (!token || !selectedId) return
    const text = replyDraft.trim()
    if (!text && replyPendingFiles.length === 0) return
    setSendErr(null)
    try {
      const encoded =
        replyPendingFiles.length > 0
          ? await encodeSupportAttachmentFiles(replyPendingFiles.map((p) => p.file))
          : undefined
      await postAdminSupportReply(token, selectedId, text, encoded)
      setReplyDraft('')
      replyPendingFiles.forEach((p) => URL.revokeObjectURL(p.url))
      setReplyPendingFiles([])
      if (replyFileInputRef.current) replyFileInputRef.current.value = ''
      const r = await getAdminSupportMessages(token, selectedId)
      setMessages(r.messages)
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'Не удалось отправить')
    }
  }

  const closeChat = async () => {
    if (!token || !selectedId) return
    await postAdminSupportReply(token, selectedId, FAREWELL_CLOSE_MESSAGE)
    await postAdminCloseThread(token, selectedId)
    setSelectedId(null)
    setReplyDraft('')
    setReplyPendingFiles((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url))
      return []
    })
    const r = await getAdminSupportThreads(token)
    setThreads(dedupeThreads(r.threads))
  }

  if (selectedId) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-surface">
        <div className="shrink-0 flex items-center gap-2 px-2 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={() => {
              setSendErr(null)
              setSelectedId(null)
            }}
            className="shrink-0 rounded-xl p-2 hover:bg-slate-200/80 dark:hover:bg-slate-700/80"
            aria-label="Назад"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-slate-700 dark:text-slate-200">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{selectedThread?.title ?? 'Чат'}</p>
            <p className="text-[10px] text-slate-500 truncate">История сообщений сохраняется</p>
          </div>
          <button
            type="button"
            onClick={() => void closeChat()}
            className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Закрыть чат
          </button>
        </div>
        <div
          ref={messagesScrollRef}
          className="min-h-0 flex-1 basis-0 overflow-y-auto overscroll-contain p-3 space-y-2 touch-pan-y"
        >
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.isFromAdmin ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[min(90%,28rem)] rounded-2xl px-3 py-2 text-sm ${
                  m.isFromAdmin
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                }`}
              >
                {m.body?.trim() ? <p className="whitespace-pre-wrap break-words">{m.body}</p> : null}
                {(m.attachments ?? []).length > 0 ? (
                  <div className={`flex flex-col gap-2 ${m.body?.trim() ? 'mt-2' : ''}`}>
                    {(m.attachments ?? []).map((a, i) => (
                      <div
                        key={`${m.id}-att-${i}`}
                        className={`rounded-xl overflow-hidden max-w-[240px] ${
                          m.isFromAdmin
                            ? 'border border-white/25'
                            : 'border border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {a.kind === 'video' ? (
                          <video
                            src={resolveSupportMediaUrl(a.url)}
                            controls
                            className="w-full max-h-48 bg-black"
                          />
                        ) : (
                          <img
                            src={resolveSupportMediaUrl(a.url)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-full h-auto max-h-48 object-cover"
                          />
                        )}
                        {a.name ? <p className="text-[10px] opacity-80 px-2 py-1 truncate">{a.name}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                <p className="text-[10px] opacity-70 mt-1">{formatTime(m.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
        {sendErr ? (
          <div className="shrink-0 mx-2 mb-1 rounded-xl border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300">
            {sendErr}
          </div>
        ) : null}
        <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col gap-2">
          {supportUserTyping ? (
            <p className="px-3 pt-1.5 text-[11px] text-slate-500 dark:text-slate-400 italic">
              Пользователь печатает…
            </p>
          ) : null}
          {replyPendingFiles.length > 0 ? (
            <div className="flex flex-wrap gap-2 px-2 pt-2">
              {replyPendingFiles.map((p) => (
                <div
                  key={p.id}
                  className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 w-14 h-14 bg-slate-100 dark:bg-slate-800"
                >
                  {fileLooksLikeVideo(p.file) ? (
                    <video src={p.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeReplyPending(p.id)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-5"
                    aria-label="Убрать вложение"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2 p-2 items-end">
            <input
              ref={replyFileInputRef}
              type="file"
              accept="image/*,video/*,image/heic,.heic,.heif,.avif"
              multiple
              className="hidden"
              onChange={(e) => {
                addReplyFiles(e.target.files)
                requestAnimationFrame(() => {
                  e.target.value = ''
                })
              }}
            />
            <button
              type="button"
              onClick={() => replyFileInputRef.current?.click()}
              className="shrink-0 w-11 h-11 rounded-xl bg-[var(--color-body)] border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300"
              aria-label="Прикрепить файл"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path
                  d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <textarea
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              onFocus={() => scrollChatsToEnd()}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.shiftKey) return
                if ('isComposing' in e.nativeEvent && e.nativeEvent.isComposing) return
                e.preventDefault()
                if (!replyDraft.trim() && replyPendingFiles.length === 0) return
                void sendReply()
              }}
              placeholder="Сообщение..."
              rows={2}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm resize-none"
            />
            <button
              type="button"
              onClick={() => void sendReply()}
              disabled={!replyDraft.trim() && replyPendingFiles.length === 0}
              className="shrink-0 self-end rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-4 py-2 text-sm font-medium disabled:opacity-40"
            >
              Отправить
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface divide-y divide-slate-100 dark:divide-slate-700/80">
        {threads.length === 0 ? (
          <p className="p-3 text-xs text-slate-500">Нет пользователей</p>
        ) : (
          threads.map((t) => (
            <button
              key={String(t.userId)}
              type="button"
              onClick={() => setSelectedId(String(t.userId))}
              className="w-full text-left px-3 py-3 hover:bg-white/80 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800"
            >
              <div className="flex justify-between gap-2">
                <span className="text-sm font-medium truncate">{t.title}</span>
                {t.unread > 0 ? (
                  <span className="shrink-0 text-[10px] font-bold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">
                    {t.unread}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{t.lastPreview}</p>
              <p className="text-[10px] text-slate-400 mt-1">{formatTime(t.lastAt)}</p>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
