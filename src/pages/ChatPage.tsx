import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { usePrefersDesktopLayout } from '../hooks/useMediaQuery'
import {
  createChat,
  deleteChat,
  enablePaidChatMode,
  fetchMessages,
  renameChat as renameChatApi,
  sendMessage,
  type Chat,
  type ChatMessage,
} from '../api/chats'
import {
  MAX_CHAT_FILES_PER_MESSAGE,
  ALLOWED_CHAT_FILE_MIME_RE,
  readFileAsDataUrl,
  type ChatAttachmentPayload,
  resizeImageFileToJpegDataUrl,
  tryParseChatUserContent,
} from '../lib/chatAttachments'

const FREE_CHAT_LIMIT = 3
const CHAT_TITLE_MAX_CHARS = 200
const LIMIT_MODAL_MS = 320
const FILE_FORMAT_HINT =
  'Формат файла не подходит. Используйте: JPG, PNG, WebP, GIF, PDF, DOCX, XLSX, PPTX.'

function ChatLimitModal({
  open,
  entered,
  activating,
  onActivatePaidMode,
  onClose,
}: {
  open: boolean
  entered: boolean
  activating: boolean
  onActivatePaidMode: () => void
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <div
        role="presentation"
        aria-hidden
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ease-out ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-limit-modal-title"
        className={`relative w-full max-w-md rounded-2xl border-2 border-red-400/90 dark:border-red-600 bg-white dark:bg-slate-900 shadow-2xl shadow-red-900/20 dark:shadow-black/50 px-5 pb-5 pt-10 sm:px-6 sm:pb-6 transition-[opacity,transform] duration-300 ease-out ${
          entered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.96] translate-y-2'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-300 transition-colors"
          aria-label="Закрыть"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
        <div className="flex gap-3 pr-6">
          <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/80 flex items-center justify-center text-red-600 dark:text-red-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0 space-y-3 text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
            <h2 id="chat-limit-modal-title" className="text-base font-semibold text-red-700 dark:text-red-400 pr-1">
              Лимит чата
            </h2>
            <p>
              Вы достигли лимита по запросам/загрузкам медиа в чат. Ограничение сбросится в 00:00 по МСК (GMT+3).
              Если же Вы желаете продолжить пользоваться чатом, то будет списываться плата за пользование по тарифу:
            </p>
            <ul className="list-none space-y-2 pl-0 border-l-2 border-red-200 dark:border-red-800 pl-3">
              <li>
                Текстовое сообщение:{' '}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">1 кредит</span>
              </li>
              <li>
                Сообщение с медиа:{' '}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">4 кредита</span>
              </li>
            </ul>
            <button
              type="button"
              onClick={onActivatePaidMode}
              disabled={activating}
              className="w-full h-10 rounded-xl bg-[var(--color-brand)] text-[var(--color-on-brand)] text-sm font-semibold hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {activating ? 'Подключаем…' : 'Понятно'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChatDangerModal({
  open,
  entered,
  title,
  message,
  onClose,
}: {
  open: boolean
  entered: boolean
  title: string
  message: string
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 sm:p-6">
      <div
        role="presentation"
        aria-hidden
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ease-out ${
          entered ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-md rounded-2xl border-2 border-red-400/90 dark:border-red-600 bg-white dark:bg-slate-900 shadow-2xl shadow-red-900/20 dark:shadow-black/50 px-5 pb-5 pt-10 sm:px-6 sm:pb-6 transition-[opacity,transform] duration-300 ease-out ${
          entered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.96] translate-y-2'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-300 transition-colors"
          aria-label="Закрыть"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
        <div className="flex gap-3 pr-6">
          <div className="shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/80 flex items-center justify-center text-red-600 dark:text-red-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="min-w-0 space-y-2 text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
            <h2 className="text-base font-semibold text-red-700 dark:text-red-400 pr-1">{title}</h2>
            <p>{message}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function UserBubbleContent({ content }: { content: string }) {
  const parsed = useMemo(() => tryParseChatUserContent(content), [content])
  if (!parsed?.attachments?.length) {
    return <span className="whitespace-pre-wrap">{content}</span>
  }
  const images = parsed.attachments.filter((a) => a.kind === 'image')
  const files = parsed.attachments.filter((a) => a.kind === 'file')
  return (
    <div className="space-y-2">
      {parsed.text.trim() ? <p className="whitespace-pre-wrap">{parsed.text}</p> : null}
      {images.length > 0 && (
      <div className="flex flex-wrap gap-2 justify-end">
        {images.map((a, i) => (
          <img
            key={i}
            src={a.dataUrl}
            alt=""
            className="max-h-40 max-w-[min(200px,70vw)] rounded-lg object-cover border border-white/15"
          />
        ))}
      </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-col gap-1 items-end">
          {files.map((f, i) => (
            <a
              key={`${f.name ?? 'file'}-${i}`}
              href={f.dataUrl}
              download={f.name || `file-${i + 1}`}
              className="text-xs underline opacity-90 hover:opacity-100"
            >
              {f.name || `Файл ${i + 1}`}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CommunityPage() {
  const { token, mergeUser } = useAuth()
  const isApi = Boolean(token && token !== 'local-dev')
  const isDesktop = usePrefersDesktopLayout()
  const {
    chats,
    chatsReady,
    setChats,
    dailyAiMsgCount,
    dailyAiMsgLimit,
    setDailyAiMsgCount,
    dailyAiImageCount,
    dailyAiImageLimit,
    paidChatModeActive,
    paidChatTextCost,
    paidChatMediaCost,
    setDailyAiImageCount,
    setDailyAiImageLimit,
    setPaidChatModeActive,
    setPaidChatTextCost,
    setPaidChatMediaCost,
  } = useChatStore()
  const chatsLoading = !chatsReady

  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [msgsLoading, setMsgsLoading] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [chatError, setChatError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [renameBusy, setRenameBusy] = useState(false)
  const [attachments, setAttachments] = useState<ChatAttachmentPayload[]>([])
  const [attachBusy, setAttachBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const dragDepthRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [limitModalOpen, setLimitModalOpen] = useState(false)
  const [limitModalEntered, setLimitModalEntered] = useState(false)
  const [paidModeActivating, setPaidModeActivating] = useState(false)
  const [dangerModalOpen, setDangerModalOpen] = useState(false)
  const [dangerModalEntered, setDangerModalEntered] = useState(false)
  const [dangerModalMessage, setDangerModalMessage] = useState(FILE_FORMAT_HINT)

  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const composerIntoViewRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const renameInputSidebarRef = useRef<HTMLInputElement>(null)
  const renameInputHeaderRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback((instant = false) => {
    const el = scrollRef.current
    if (!el) return
    /** Только внутренний скролл списка сообщений: `scrollIntoView` на якоре тянет внешний #main-scroll и на мобильном уводит поле ввода с превью из зоны видимости */
    el.scrollTo({ top: el.scrollHeight, behavior: instant ? 'instant' : 'smooth' })
  }, [])


  useEffect(() => {
    if (!activeChatId || !isApi || !token) {
      setMessages([])
      return
    }
    setMsgsLoading(true)
    setSendError(null)
    fetchMessages(token, activeChatId)
      .then(({ messages: msgs, dailyCount: dc, dailyImageCount, dailyImageLimit, paidModeActive, paidTextCost, paidMediaCost }) => {
        setMessages(msgs)
        setDailyAiMsgCount(dc)
        if (typeof dailyImageCount === 'number') setDailyAiImageCount(dailyImageCount)
        if (dailyImageLimit === null || typeof dailyImageLimit === 'number') {
          setDailyAiImageLimit(dailyImageLimit)
        }
        setPaidChatModeActive(Boolean(paidModeActive))
        if (typeof paidTextCost === 'number') setPaidChatTextCost(paidTextCost)
        if (typeof paidMediaCost === 'number') setPaidChatMediaCost(paidMediaCost)
      })
      .catch(() => { })
      .finally(() => setMsgsLoading(false))
  }, [activeChatId, isApi, token, setDailyAiMsgCount, setDailyAiImageCount, setDailyAiImageLimit, setPaidChatModeActive, setPaidChatTextCost, setPaidChatMediaCost])

  useEffect(() => {
    scrollToBottom(true)
  }, [messages, scrollToBottom])

  useLayoutEffect(() => {
    if (attachments.length === 0) return
    composerIntoViewRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [attachments.length])

  useEffect(() => {
    if (!editingChatId) return
    const rid = window.requestAnimationFrame(() => {
      const el = renameInputSidebarRef.current ?? renameInputHeaderRef.current
      el?.focus()
      try {
        el?.select()
      } catch {
        /* ignore */
      }
    })
    return () => cancelAnimationFrame(rid)
  }, [editingChatId])

  const beginRename = (chat: Chat, e?: React.MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    setChatError(null)
    setEditingChatId(chat.id)
    setRenameDraft(chat.title)
  }

  const cancelRename = () => {
    setEditingChatId(null)
    setRenameDraft('')
  }

  const commitRename = async () => {
    if (!token || !isApi || !editingChatId || renameBusy) return
    const t = renameDraft.trim()
    if (!t) return
    setRenameBusy(true)
    try {
      const { chat } = await renameChatApi(token, editingChatId, t)
      setChats((prev) => {
        const next = prev.map((c) => (c.id === chat.id ? chat : c))
        return [...next].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
      })
      cancelRename()
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Не удалось сохранить название')
    }
    setRenameBusy(false)
  }

  const onRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if ('isComposing' in e.nativeEvent && e.nativeEvent.isComposing) return
      e.preventDefault()
      void commitRename()
    }
    if (e.key === 'Escape') cancelRename()
  }

  const openLimitModal = useCallback(() => {
    setLimitModalOpen(true)
  }, [])

  const closeLimitModal = useCallback(() => {
    setLimitModalEntered(false)
    window.setTimeout(() => setLimitModalOpen(false), LIMIT_MODAL_MS)
  }, [])

  const handleActivatePaidMode = useCallback(async () => {
    if (!token || !isApi || paidModeActivating) return
    setPaidModeActivating(true)
    setSendError(null)
    try {
      const out = await enablePaidChatMode(token)
      setDailyAiMsgCount(out.dailyCount)
      setDailyAiImageCount(out.dailyImageCount)
      setDailyAiImageLimit(out.dailyImageLimit)
      setPaidChatModeActive(Boolean(out.paidModeActive))
      if (typeof out.paidTextCost === 'number') setPaidChatTextCost(out.paidTextCost)
      if (typeof out.paidMediaCost === 'number') setPaidChatMediaCost(out.paidMediaCost)
      closeLimitModal()
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Не удалось включить платный режим')
    } finally {
      setPaidModeActivating(false)
    }
  }, [token, isApi, paidModeActivating, setDailyAiMsgCount, setDailyAiImageCount, setDailyAiImageLimit, setPaidChatModeActive, setPaidChatTextCost, setPaidChatMediaCost, closeLimitModal])

  const openDangerModal = useCallback((message: string) => {
    setDangerModalMessage(message)
    setDangerModalOpen(true)
  }, [])

  const closeDangerModal = useCallback(() => {
    setDangerModalEntered(false)
    window.setTimeout(() => setDangerModalOpen(false), LIMIT_MODAL_MS)
  }, [])

  useLayoutEffect(() => {
    if (!limitModalOpen) return
    setLimitModalEntered(false)
    let inner = 0
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => setLimitModalEntered(true))
    })
    return () => {
      window.cancelAnimationFrame(outer)
      if (inner) window.cancelAnimationFrame(inner)
    }
  }, [limitModalOpen])

  useLayoutEffect(() => {
    if (!dangerModalOpen) return
    setDangerModalEntered(false)
    let inner = 0
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => setDangerModalEntered(true))
    })
    return () => {
      window.cancelAnimationFrame(outer)
      if (inner) window.cancelAnimationFrame(inner)
    }
  }, [dangerModalOpen])

  useEffect(() => {
    if (!limitModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLimitModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [limitModalOpen, closeLimitModal])

  useEffect(() => {
    if (!dangerModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDangerModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dangerModalOpen, closeDangerModal])

  useEffect(() => {
    if (!limitModalOpen && !dangerModalOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [limitModalOpen, dangerModalOpen])

  const handleNewChat = async () => {
    if (!isApi || !token) return
    setChatError(null)
    try {
      const { chat } = await createChat(token)
      setChats((prev) => [chat, ...prev])
      setActiveChatId(chat.id)
    } catch (e) {
      setChatError(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  const handleSelectChat = (chatId: string) => {
    if (chatId === activeChatId) return
    setEditingChatId(null)
    setRenameDraft('')
    setActiveChatId(chatId)
    setSendError(null)
  }

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isApi || !token || deletingId) return
    setDeletingId(chatId)
    try {
      await deleteChat(token, chatId)
      setChats((prev) => prev.filter((c) => c.id !== chatId))
      if (editingChatId === chatId) cancelRename()
      if (activeChatId === chatId) setActiveChatId(null)
    } catch { }
    setDeletingId(null)
  }

  const addFiles = useCallback(
    async (files: Iterable<File>) => {
      const all = Array.from(files)
      const list = all.filter((f) => ALLOWED_CHAT_FILE_MIME_RE.test(f.type))
      if (!list.length) {
        if (all.length > 0) openDangerModal(FILE_FORMAT_HINT)
        return
      }
      if (list.length !== all.length) {
        openDangerModal(FILE_FORMAT_HINT)
      }
      if (!paidChatModeActive && dailyAiMsgCount >= dailyAiMsgLimit) {
        openLimitModal()
        return
      }
      if (attachments.length >= MAX_CHAT_FILES_PER_MESSAGE) {
        setSendError(`Не более ${MAX_CHAT_FILES_PER_MESSAGE} файлов в сообщении`)
        return
      }
      if (!paidChatModeActive && typeof dailyAiImageLimit === 'number') {
        const slotsLeft = Math.max(0, dailyAiImageLimit - dailyAiImageCount - attachments.length)
        if (slotsLeft === 0) {
          openLimitModal()
          return
        }
      }
      const cap =
        dailyAiImageLimit == null
          ? MAX_CHAT_FILES_PER_MESSAGE
          : Math.max(0, dailyAiImageLimit - dailyAiImageCount - attachments.length)
      const room = Math.min(MAX_CHAT_FILES_PER_MESSAGE - attachments.length, cap)
      if (room <= 0) {
        setSendError(`Не более ${MAX_CHAT_FILES_PER_MESSAGE} файлов в сообщении`)
        return
      }
      setAttachBusy(true)
      setSendError(null)
      const next: ChatAttachmentPayload[] = []
      try {
        for (const f of list) {
          if (next.length + attachments.length >= room) break
          try {
            const clientKey = crypto.randomUUID()
            if (/^image\//i.test(f.type)) {
              next.push({
                clientKey,
                kind: 'image',
                dataUrl: await resizeImageFileToJpegDataUrl(f),
                name: f.name,
                mime: f.type,
              })
            } else {
              next.push({
                clientKey,
                kind: 'file',
                dataUrl: await readFileAsDataUrl(f),
                name: f.name,
                mime: f.type,
              })
            }
          } catch (e) {
            setSendError(e instanceof Error ? e.message : 'Не удалось обработать файл')
          }
        }
        if (next.length) setAttachments((prev) => [...prev, ...next])
      } finally {
        setAttachBusy(false)
      }
    },
    [
      attachments.length,
      dailyAiImageCount,
      dailyAiImageLimit,
      dailyAiMsgCount,
      dailyAiMsgLimit,
      paidChatModeActive,
      openLimitModal,
      openDangerModal,
    ]
  )

  const handleSend = async () => {
    const text = input.trim()
    const atts = attachments
    const imgs = atts.filter((a) => a.kind === 'image').map((a) => a.dataUrl)
    const files = atts
      .filter((a) => a.kind === 'file')
      .map((a) => ({ name: a.name || 'file', mime: a.mime || 'application/octet-stream', dataUrl: a.dataUrl }))
    if ((!text && atts.length === 0) || !activeChatId || !isApi || !token || sending) return
    if (!paidChatModeActive && dailyAiMsgCount >= dailyAiMsgLimit) {
      openLimitModal()
      return
    }
    if (
      !paidChatModeActive &&
      typeof dailyAiImageLimit === 'number' &&
      atts.length > 0 &&
      dailyAiImageCount + atts.length > dailyAiImageLimit
    ) {
      openLimitModal()
      return
    }

    setInput('')
    setAttachments([])
    setSendError(null)
    setSending(true)

    const tempId = `tmp-${Date.now()}`
    const attachmentsWire =
      atts.length > 0
        ? atts.map(({ clientKey: _omit, ...rest }) => rest)
        : []
    const optimistic: ChatMessage = {
      id: tempId,
      chat_id: activeChatId,
      role: 'user',
      content:
        atts.length > 0 ? JSON.stringify({ v: 1, text, attachments: attachmentsWire }) : text,
      created_at: new Date().toISOString(),
      user_image_count: atts.length,
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const result = await sendMessage(
        token,
        activeChatId,
        text,
        imgs.length ? imgs : undefined,
        files.length ? files : undefined
      )
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        result.userMessage,
        result.assistantMessage,
      ])
      setDailyAiMsgCount(result.dailyCount)
      if (typeof result.dailyImageCount === 'number') setDailyAiImageCount(result.dailyImageCount)
      if (result.dailyImageLimit === null || typeof result.dailyImageLimit === 'number') {
        setDailyAiImageLimit(result.dailyImageLimit)
      }
      setPaidChatModeActive(Boolean(result.paidModeActive))
      if (typeof result.paidTextCost === 'number') setPaidChatTextCost(result.paidTextCost)
      if (typeof result.paidMediaCost === 'number') setPaidChatMediaCost(result.paidMediaCost)
      if (typeof result.creditsBalance === 'number') {
        mergeUser({ creditsBalance: result.creditsBalance })
      }
      if (result.newTitle) {
        setChats((prev) =>
          prev.map((c) =>
            c.id === activeChatId
              ? { ...c, title: result.newTitle!, updated_at: new Date().toISOString() }
              : c
          )
        )
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      setInput(text)
      setAttachments(atts)
      const msg = e instanceof Error ? e.message : ''
      if (/лимит/i.test(msg)) {
        openLimitModal()
      } else {
        setSendError(msg || 'Не удалось отправить')
      }
    } finally {
      setSending(false)
      setTimeout(() => textareaRef.current?.focus(), 0)
    }
  }

  const activeChat = chats.find((c) => c.id === activeChatId)
  const limitReached = dailyAiMsgCount >= dailyAiMsgLimit
  const imageSlotsBlocked =
    typeof dailyAiImageLimit === 'number' &&
    attachments.length > 0 &&
    dailyAiImageCount + attachments.length > dailyAiImageLimit
  const canSend =
    Boolean(activeChatId) &&
    !sending &&
    (paidChatModeActive || !limitReached) &&
    (paidChatModeActive || !imageSlotsBlocked) &&
    (input.trim().length > 0 || attachments.length > 0)

  if (!isApi) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400 text-sm">
        Войдите, чтобы использовать AI чат
      </div>
    )
  }

  return (
    <>
    <div
      className={`flex w-full min-w-0 min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 ${isDesktop ? 'min-h-[320px]' : 'min-h-[min(100%,320px)]'}`}
    >
      {/* ── Sidebar ── */}
      <div
        className={`flex flex-col shrink-0 bg-surface border-r border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-200
          ${activeChatId ? 'hidden lg:flex lg:w-64' : 'flex w-full lg:w-64'}`}
      >
        {/* New chat button */}
        <div className="p-3 shrink-0">
          <button
            type="button"
            onClick={() => void handleNewChat()}
            disabled={chats.length >= FREE_CHAT_LIMIT}
            className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold bg-[var(--color-brand)] text-[var(--color-on-brand)] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            Новый чат
          </button>
          {chatError && (
            <p className="text-[11px] text-red-500 mt-1.5 text-center">{chatError}</p>
          )}
          <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-2 px-2 leading-snug">
            {dailyAiMsgCount}/{dailyAiMsgLimit} запросов сегодня (все чаты)
          </p>
          {typeof dailyAiImageLimit === 'number' && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center mt-1 px-2 leading-snug">
              {dailyAiImageCount}/{dailyAiImageLimit} файл(а)
            </p>
          )}
          {paidChatModeActive && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 text-center mt-1 px-2 leading-snug">
              Платный режим: {paidChatTextCost} / {paidChatMediaCost} кр.
            </p>
          )}
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {chatsLoading ? (
            <p className="text-center text-xs text-slate-400 py-6">Загрузка…</p>
          ) : chats.length === 0 ? (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-6 px-3 leading-relaxed">
              Создайте первый чат,<br />чтобы начать общение
            </p>
          ) : (
            chats.map((chat) =>
              editingChatId === chat.id ? (
                <div
                  key={chat.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 px-2 py-2 shadow-sm"
                >
                  <div className="flex items-center gap-1">
                    <input
                      ref={renameInputSidebarRef}
                      type="text"
                      value={renameDraft}
                      maxLength={CHAT_TITLE_MAX_CHARS}
                      disabled={renameBusy}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={onRenameKeyDown}
                      className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[var(--color-brand)]/35"
                      aria-label="Название чата"
                    />
                    <button
                      type="button"
                      disabled={renameBusy || !renameDraft.trim()}
                      onClick={() => void commitRename()}
                      className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold bg-[var(--color-brand)] text-[var(--color-on-brand)] hover:brightness-110 disabled:opacity-40"
                    >
                      OK
                    </button>
                    <button
                      type="button"
                      disabled={renameBusy}
                      onClick={cancelRename}
                      className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-0.5">
                    Enter — сохранить, Esc — отмена (до {CHAT_TITLE_MAX_CHARS} символов)
                  </p>
                </div>
              ) : (
                <div key={chat.id} className="relative group">
                  <button
                    type="button"
                    onClick={() => handleSelectChat(chat.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm transition-colors pr-20
                      ${activeChatId === chat.id
                        ? 'bg-slate-100 dark:bg-slate-700/70 font-medium text-slate-900 dark:text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      className="shrink-0 text-slate-400"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
                    </svg>
                    <span className="truncate">{chat.title}</span>
                  </button>
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => beginRename(chat, e)}
                      disabled={deletingId === chat.id || renameBusy}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[var(--color-brand)] hover:bg-slate-100 dark:hover:bg-slate-700/70 disabled:opacity-30"
                      aria-label="Переименовать чат"
                      title="Переименовать"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => void handleDeleteChat(chat.id, e)}
                      disabled={deletingId === chat.id}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-30"
                      aria-label="Удалить чат"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" strokeLinejoin="round" />
                        <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                        <path d="M9 6V4h6v2" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            )
          )}
        </div>
      </div>

      {/* ── Chat area ── */}
      <div
        className={`relative flex-1 flex flex-col min-w-0 bg-[var(--color-body)]
          ${!activeChatId ? 'hidden lg:flex' : 'flex'}`}
        onDragEnter={(e) => {
          e.preventDefault()
          e.stopPropagation()
          dragDepthRef.current += 1
          setDragOver(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          e.stopPropagation()
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
          if (dragDepthRef.current === 0) setDragOver(false)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          dragDepthRef.current = 0
          setDragOver(false)
          if (e.dataTransfer.files?.length) void addFiles(Array.from(e.dataTransfer.files))
        }}
      >
        {dragOver && activeChatId && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/45 backdrop-blur-[2px]">
            <span className="rounded-xl border border-white/30 bg-black/40 px-4 py-2 text-sm font-medium text-white">
              Отпустите, чтобы прикрепить файл
            </span>
          </div>
        )}
        {/* Mobile back header */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-surface shrink-0 lg:hidden min-w-0">
          <button
            type="button"
            onClick={() => {
              cancelRename()
              setActiveChatId(null)
            }}
            className="shrink-0 flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white active:opacity-70 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Чаты
          </button>
          {activeChatId && editingChatId === activeChatId ? (
            <div className="flex-1 min-w-0 flex items-center gap-1">
              <input
                ref={renameInputHeaderRef}
                type="text"
                value={renameDraft}
                maxLength={CHAT_TITLE_MAX_CHARS}
                disabled={renameBusy}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={onRenameKeyDown}
                className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[var(--color-brand)]/35"
                aria-label="Название чата"
              />
              <button
                type="button"
                disabled={renameBusy || !renameDraft.trim()}
                onClick={() => void commitRename()}
                className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold bg-[var(--color-brand)] text-[var(--color-on-brand)] disabled:opacity-40"
              >
                OK
              </button>
              <button
                type="button"
                disabled={renameBusy}
                onClick={cancelRename}
                className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex-1 min-w-0 flex items-center justify-center gap-1">
              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate text-center min-w-0">
                {activeChat?.title ?? ''}
              </span>
              {activeChat ? (
                <button
                  type="button"
                  onClick={() => beginRename(activeChat)}
                  className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-[var(--color-brand)] hover:bg-slate-100 dark:hover:bg-slate-800/80"
                  aria-label="Переименовать чат"
                  title="Переименовать"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              ) : null}
            </div>
          )}
        </div>

        {activeChatId ? (
          <>
            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
              {msgsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-slate-400">Загрузка…</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-center px-4">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Начните диалог</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                      Напишите первое сообщение ниже
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mx-auto w-full max-w-[900px] space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end items-end' : 'justify-start items-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-7 h-7 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-[var(--color-on-brand)] text-[11px] font-bold shrink-0 mr-2 mt-0.5">
                          AI
                        </div>
                      )}
                      <div
                        className={`max-w-[82%] lg:max-w-[760px] xl:max-w-[820px] rounded-2xl px-3.5 py-2.5 shadow-sm text-sm leading-snug break-words
                          ${msg.role === 'user' ? 'whitespace-pre-wrap' : ''}
                          ${msg.role === 'user'
                            ? 'bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-100 rounded-br-md'
                            : 'bg-surface border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 rounded-bl-md'
                          }
                          ${msg.id.startsWith('tmp-') ? 'opacity-60' : ''}`}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="[&_h1]:text-xl [&_h1]:leading-tight [&_h1]:font-bold [&_h1]:my-2 [&_h2]:text-lg [&_h2]:leading-tight [&_h2]:font-semibold [&_h2]:my-1.5 [&_h3]:leading-snug [&_h3]:font-semibold [&_h3]:my-1 [&_h4]:text-sm [&_h4]:leading-snug [&_h4]:font-semibold [&_h4]:my-1 [&_p]:my-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <UserBubbleContent content={msg.content} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {sending && (
                <div className="mx-auto w-full max-w-[900px]">
                  <div className="flex justify-start items-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-[var(--color-on-brand)] text-[11px] font-bold shrink-0 mt-0.5">
                      AI
                    </div>
                    <div className="max-w-[82%] lg:max-w-[760px] xl:max-w-[820px] bg-surface border border-slate-200 dark:border-slate-600 rounded-2xl rounded-bl-md px-4 py-3">
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div
              ref={composerIntoViewRef}
              className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-surface px-3 pt-2 pb-8"
            >
              <div className="mx-auto w-full max-w-[900px]">
                {sendError && (
                  <p className="text-xs text-red-500 dark:text-red-400 mb-2 px-1">{sendError}</p>
                )}
                <div className="flex items-center justify-between mb-1.5 px-0.5 flex-wrap gap-1">
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    {dailyAiMsgCount}/{dailyAiMsgLimit} запросов сегодня (все диалоги)
                    {typeof dailyAiImageLimit === 'number' ? (
                      <span className="text-slate-400 dark:text-slate-500">
                        {' · '}
                        {dailyAiImageCount}/{dailyAiImageLimit} файл(а)
                      </span>
                    ) : null}
                    {paidChatModeActive ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {' · '}Платный режим {paidChatTextCost}/{paidChatMediaCost} кр.
                      </span>
                    ) : null}
                  </span>
                  {limitReached && (
                    <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                      Сбросится в 00:00 МСК
                    </span>
                  )}
                </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                multiple
                className="hidden"
                onChange={(e) => {
                  const fl = e.target.files
                  const picked = fl?.length ? Array.from(fl) : []
                  e.target.value = ''
                  if (picked.length) void addFiles(picked)
                }}
              />
              <div className="relative rounded-xl border border-transparent transition-colors">
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-1 pb-2">
                    {attachments.map((att, i) => (
                      <div
                        key={att.clientKey ?? `${i}-${att.kind}-${att.dataUrl.length}`}
                        className="relative group/th rounded-lg ring-1 ring-slate-200/80 dark:ring-slate-600/80"
                      >
                        {att.kind === 'image' ? (
                          <img
                            src={att.dataUrl}
                            alt=""
                            loading="eager"
                            decoding="async"
                            className="block h-16 w-16 shrink-0 rounded-lg object-cover border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800"
                          />
                        ) : (
                          <a
                            href={att.dataUrl}
                            download={att.name || `file-${i + 1}`}
                            className="h-16 min-w-16 max-w-[180px] px-2 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center text-[11px] leading-tight text-slate-700 dark:text-slate-200 bg-[var(--color-body)]"
                            title={att.name || 'Файл'}
                          >
                            {att.name || `Файл ${i + 1}`}
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute -right-1 -top-1 z-[1] w-5 h-5 rounded-full bg-slate-800 text-white text-xs leading-5 opacity-100 shadow-sm md:opacity-0 md:group-hover/th:opacity-100 md:hover:bg-red-600 transition-opacity disabled:opacity-30"
                          aria-label="Убрать"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 items-end">
                  <button
                    type="button"
                    disabled={sending || attachBusy}
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40"
                    aria-label="Прикрепить файл"
                    title="Файлы: фото/PDF/DOCX/XLSX/PPTX"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onPaste={(e) => {
                      const files = Array.from(e.clipboardData.files).filter((f) => ALLOWED_CHAT_FILE_MIME_RE.test(f.type))
                      if (files.length) {
                        e.preventDefault()
                        void addFiles(files)
                      } else if (e.clipboardData.files.length > 0) {
                        e.preventDefault()
                        openDangerModal(FILE_FORMAT_HINT)
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void handleSend()
                      }
                    }}
                    placeholder={
                      'Сообщение'
                    }
                    disabled={sending}
                    rows={2}
                    className="flex-1 min-h-[44px] max-h-36 resize-none rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30 disabled:opacity-50 transition-opacity"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={!canSend}
                    className="shrink-0 w-11 h-11 rounded-xl bg-[var(--color-brand)] text-[var(--color-on-brand)] flex items-center justify-center hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
                    aria-label="Отправить"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </div>
              </div>
              </div>
            </div>
          </>
        ) : (
          /* Desktop empty state */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand-light)] dark:bg-[var(--color-brand-light)] flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="1.75">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Выберите чат</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                или создайте новый в панели слева
              </p>
            </div>
            {chats.length < FREE_CHAT_LIMIT && (
              <button
                type="button"
                onClick={() => void handleNewChat()}
                className="px-4 py-2 rounded-xl bg-[var(--color-brand)] text-[var(--color-on-brand)] text-sm font-medium hover:brightness-110"
              >
                Новый чат
              </button>
            )}
          </div>
        )}
      </div>
    </div>
    <ChatLimitModal
      open={limitModalOpen}
      entered={limitModalEntered}
      activating={paidModeActivating}
      onActivatePaidMode={() => {
        void handleActivatePaidMode()
      }}
      onClose={closeLimitModal}
    />
    <ChatDangerModal
      open={dangerModalOpen}
      entered={dangerModalEntered}
      title="Неподходящий формат файла"
      message={dangerModalMessage}
      onClose={closeDangerModal}
    />
    </>
  )
}
