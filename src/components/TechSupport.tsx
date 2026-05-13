import { useCallback, useEffect, useRef, useState } from 'react'
import { useStickToBottomSupportChat } from '../hooks/useStickToBottomSupportChat'
import { getMySupportMessages, getMySupportTyping, postMySupportMessage, postMySupportTyping } from '../api/support'
import type { SupportMessage } from '../api/admin'
import {
  encodeSupportAttachmentFiles,
  resolveSupportMediaUrl,
  isAcceptableSupportMediaFile,
  fileLooksLikeVideo,
} from '../lib/supportAttachments'
import { useAuth } from '../store/authStore'
import { useTelegram } from '../hooks/useTelegram'

type MediaKind = 'image' | 'video'

interface Attachment {
  id: string
  url: string
  kind: MediaKind
  name: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  attachments: Attachment[]
  createdAt: number
  pending?: boolean
}

function revokeAttachments(list: Attachment[]) {
  list.forEach((a) => {
    if (!a.url.startsWith('blob:')) return
    try {
      URL.revokeObjectURL(a.url)
    } catch {
      /* ignore */
    }
  })
}

const WELCOME_ASSISTANT: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Здравствуйте! Опишите вопрос или прикрепите фото или видео. Ответы скоро будет давать ИИ-помощник.',
  attachments: [],
  createdAt: Date.now(),
}

function serverMessagesToChat(list: SupportMessage[]): ChatMessage[] {
  return list.map((m) => {
    const t = new Date(m.createdAt).getTime()
    return {
      id: String(m.id),
      role: m.isFromAdmin ? ('assistant' as const) : ('user' as const),
      text: m.body ?? '',
      attachments: (m.attachments ?? []).map((a, i) => ({
        id: `${String(m.id)}-${i}`,
        url: resolveSupportMediaUrl(a.url),
        kind: a.kind === 'video' ? ('video' as const) : ('image' as const),
        name: a.name || '',
      })),
      createdAt: Number.isNaN(t) ? Date.now() : t,
    }
  })
}

interface TechSupportProps {
  onBack?: () => void
}

export default function TechSupport({ onBack }: TechSupportProps) {
  const { token } = useAuth()
  const isApi = Boolean(token && token !== 'local-dev')
  const { ready, expand } = useTelegram()
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_ASSISTANT])
  const [draft, setDraft] = useState('')
  const [pendingFiles, setPendingFiles] = useState<{ id: string; file: File; url: string }[]>([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [adminTypingPeer, setAdminTypingPeer] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const userTypingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listEndRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>(messages)
  messagesRef.current = messages
  const sendingRef = useRef(false)

  useEffect(() => {
    ready()
    expand()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reloadSupport = useCallback(async () => {
    if (!isApi || !token) return
    // Не перезаписываем messages пока идёт отправка — иначе optimistic-сообщение исчезает
    if (sendingRef.current) return
    try {
      const { messages: raw } = await getMySupportMessages(token)
      const mapped = serverMessagesToChat(raw)
      // Повторная проверка: пока шёл GET, мог начаться send
      if (sendingRef.current) return
      const next =
        mapped.length === 0
          ? [WELCOME_ASSISTANT]
          : mapped.every((m) => m.role === 'assistant')
            ? [WELCOME_ASSISTANT, ...mapped]
            : mapped
      setMessages(next)
    } catch {
      setMessages((prev) => {
        const hasHistory =
          prev.some((m) => m.role === 'user' && !m.id.startsWith('tmp-')) ||
          prev.some((m) => m.role === 'assistant' && m.id !== 'welcome')
        if (hasHistory) return prev
        return [WELCOME_ASSISTANT]
      })
    }
  }, [isApi, token])

  useEffect(() => {
    void reloadSupport()
  }, [reloadSupport])

  useEffect(() => {
    if (!isApi || !token) return
    const id = window.setInterval(() => void reloadSupport(), 8000)
    return () => window.clearInterval(id)
  }, [isApi, token, reloadSupport])

  useEffect(() => {
    if (!isApi || !token) {
      setAdminTypingPeer(false)
      return
    }
    const poll = async () => {
      try {
        const { adminTyping } = await getMySupportTyping(token)
        setAdminTypingPeer(adminTyping)
      } catch {
        setAdminTypingPeer(false)
      }
    }
    void poll()
    const id = window.setInterval(poll, 3000)
    return () => window.clearInterval(id)
  }, [isApi, token])

  useEffect(() => {
    if (!isApi || !token) return
    if (userTypingDebounceRef.current) clearTimeout(userTypingDebounceRef.current)
    if (!draft.trim()) return
    userTypingDebounceRef.current = setTimeout(() => {
      userTypingDebounceRef.current = null
      void postMySupportTyping(token)
    }, 450)
    return () => {
      if (userTypingDebounceRef.current) clearTimeout(userTypingDebounceRef.current)
    }
  }, [draft, isApi, token])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void reloadSupport()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [reloadSupport])

  const scrollToEnd = useStickToBottomSupportChat(scrollRef, [messages, pendingFiles, sending])

  useEffect(() => {
    return () => {
      pendingFiles.forEach((p) => URL.revokeObjectURL(p.url))
    }
  }, [pendingFiles])

  useEffect(() => {
    return () => {
      messagesRef.current.forEach((m) => revokeAttachments(m.attachments))
    }
  }, [])

  const addFiles = useCallback((files: FileList | null) => {
    if (!files?.length) return
    setPendingFiles((prev) => {
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
          setSendError('Файл не подошёл. Выберите фото или видео (JPEG, PNG, HEIC, MP4…).'),
        )
      } else if (added > 0) {
        queueMicrotask(() => setSendError(null))
      }
      return next
    })
  }, [])

  const removePending = (id: string) => {
    setPendingFiles((prev) => {
      const t = prev.find((p) => p.id === id)
      if (t) URL.revokeObjectURL(t.url)
      return prev.filter((p) => p.id !== id)
    })
  }

  const send = () => {
    const text = draft.trim()
    if (!text && pendingFiles.length === 0) return
    if (sending) return

    if (isApi && token) {
      const optimisticId = `tmp-${Date.now()}`
      const optimisticAttachments: Attachment[] = pendingFiles.map((p) => ({
        id: p.id,
        url: p.url,
        kind: fileLooksLikeVideo(p.file) ? 'video' : 'image',
        name: p.file.name,
      }))
      const optimistic: ChatMessage = {
        id: optimisticId,
        role: 'user',
        text,
        attachments: optimisticAttachments,
        createdAt: Date.now(),
        pending: true,
      }

      setSending(true)
      sendingRef.current = true
      setSendError(null)
      setMessages((m) => [...m, optimistic])
      setDraft('')
      const filesToSend = [...pendingFiles]
      setPendingFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''

      void (async () => {
        let postFailed = false
        let errorMsg: string | null = null
        try {
          const encoded =
            filesToSend.length > 0
              ? await encodeSupportAttachmentFiles(filesToSend.map((p) => p.file))
              : undefined
          await postMySupportMessage(token, text, encoded)
        } catch (e) {
          postFailed = true
          errorMsg = e instanceof Error ? e.message : 'Не удалось отправить'
        }

        // Всегда перезагружаем: сообщение могло сохраниться даже при 500-ошибке сервера
        try {
          const { messages: raw } = await getMySupportMessages(token)
          const mapped = serverMessagesToChat(raw)
          const next = mapped.length ? mapped : [WELCOME_ASSISTANT]
          setMessages(next)
          // Если сообщение появилось на сервере — ошибку скрываем
          if (postFailed) {
            const saved = next.some(
              (m) => m.role === 'user' && m.text === text && !m.id.startsWith('tmp-')
            )
            if (saved) errorMsg = null
          }
        } catch {
          if (postFailed) {
            // Reload тоже упал — убираем оптимистичное сообщение и показываем ошибку
            setMessages((m) => m.filter((msg) => msg.id !== optimisticId))
          } else {
            // POST прошёл, но перезагрузка упала — сообщение сохранено, снимаем pending
            setMessages((m) =>
              m.map((msg) => msg.id === optimisticId ? { ...msg, pending: false } : msg)
            )
          }
        }

        // Отзываем blob-URL только после перезагрузки — до этого они нужны в превью
        filesToSend.forEach((p) => URL.revokeObjectURL(p.url))

        if (errorMsg) setSendError(errorMsg)
        sendingRef.current = false
        setSending(false)
      })()
      return
    }

    // Оффлайн-демо режим (без токена)
    const attachments: Attachment[] = pendingFiles.map((p) => ({
      id: p.id,
      url: p.url,
      kind: fileLooksLikeVideo(p.file) ? 'video' : 'image',
      name: p.file.name,
    }))

    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      attachments,
      createdAt: Date.now(),
    }

    setMessages((m) => [...m, msg])
    setDraft('')
    setPendingFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''

    window.setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'Сообщение получено. Скоро здесь появится ответ ассистента.',
          attachments: [],
          createdAt: Date.now(),
        },
      ])
    }, 700)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 pt-2 pb-2 px-1">
      {onBack && (
        <div className="sticky top-0 z-20 -mx-1 px-1 py-2 mb-1 shrink-0 bg-[color:var(--color-surface)]/95 backdrop-blur supports-[backdrop-filter]:bg-[color:var(--color-surface)]/70 border-b border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:opacity-70 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Назад
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[88%] rounded-2xl px-3 py-2.5 shadow-sm border transition-opacity ${
                msg.pending ? 'opacity-60' : 'opacity-100'
              } ${
                msg.role === 'user'
                  ? 'bg-slate-800 text-white border-slate-700 dark:bg-slate-700 dark:border-slate-600'
                  : 'bg-surface text-slate-800 border-slate-200 dark:text-slate-100 dark:border-slate-600 dark:bg-slate-800/80'
              }`}
            >
              {msg.text ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
              ) : null}
              {msg.attachments.length > 0 && (
                <div className={`flex flex-col gap-2 ${msg.text ? 'mt-2' : ''}`}>
                  {msg.attachments.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-xl overflow-hidden border border-white/20 dark:border-slate-600 max-w-[240px]"
                    >
                      {a.kind === 'image' ? (
                        <img
                          src={a.url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                          className="w-full h-auto object-cover max-h-48"
                        />
                      ) : (
                        <video src={a.url} controls className="w-full max-h-48 bg-black" />
                      )}
                      {a.name ? (
                        <p className="text-[10px] opacity-80 px-2 py-1 truncate">{a.name}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {msg.pending && (
                <p className="text-[10px] opacity-60 mt-1">Отправляется…</p>
              )}
            </div>
          </div>
        ))}
        <div ref={listEndRef} />
      </div>

      {sendError && (
        <div className="shrink-0 mx-0 mt-2 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-300">
          <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          <span className="flex-1 min-w-0">{sendError}</span>
          <button
            type="button"
            onClick={() => setSendError(null)}
            className="shrink-0 text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      )}

      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 py-2 shrink-0">
          {pendingFiles.map((p) => (
            <div
              key={p.id}
              className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 w-16 h-16 bg-slate-100 dark:bg-slate-800"
            >
              {fileLooksLikeVideo(p.file) ? (
                <video src={p.url} className="w-full h-full object-cover" muted />
              ) : (
                <img
                  src={p.url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  className="w-full h-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => removePending(p.id)}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-5"
                aria-label="Убрать вложение"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {adminTypingPeer && isApi ? (
        <p className="shrink-0 px-1 pt-1 text-[11px] text-slate-500 dark:text-slate-400 italic">
          Администратор печатает…
        </p>
      ) : null}

      <div className="shrink-0 flex gap-2 items-end pt-2 border-t border-slate-200 dark:border-slate-700">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,image/heic,.heic,.heif,.avif"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files)
            requestAnimationFrame(() => {
              e.target.value = ''
            })
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className="shrink-0 w-11 h-11 rounded-xl bg-surface border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 active:opacity-80 disabled:opacity-40"
          aria-label="Прикрепить фото или видео"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => scrollToEnd()}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.shiftKey) return
            if ('isComposing' in e.nativeEvent && e.nativeEvent.isComposing) return
            e.preventDefault()
            send()
          }}
          placeholder={sending ? 'Отправляется…' : 'Сообщение…'}
          disabled={sending}
          rows={2}
          className="flex-1 min-h-[44px] max-h-28 resize-none rounded-xl border border-slate-200 dark:border-slate-600 bg-surface px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-slate-400/40 dark:focus:ring-slate-500/40 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={send}
          className="shrink-0 w-11 h-11 rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 flex items-center justify-center active:opacity-90 disabled:opacity-40"
          disabled={(!draft.trim() && pendingFiles.length === 0) || sending}
          aria-label="Отправить"
        >
          {sending ? (
            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
