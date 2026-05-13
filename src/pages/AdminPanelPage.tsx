import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAdminSupportThreadSelection } from '../hooks/useAdminSupportThreadSelection'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useStickToBottomSupportChat } from '../hooks/useStickToBottomSupportChat'
import AdminLayout from '../components/admin/AdminLayout'
import PricesTab from '../components/admin/tabs/PricesTab'
import BannersTab from '../components/admin/tabs/BannersTab'
import PartnersTab from '../components/admin/tabs/PartnersTab'
import UsersTab from '../components/admin/tabs/UsersTab'
import SiteSettingsTab from '../components/admin/tabs/SiteSettingsTab'
import FeedModerationTab from '../components/admin/tabs/FeedModerationTab'
import {
  getAdminApimart,
  getAdminOpenAiVless,
  getAdminEvents,
  getAdminPromoCodes,
  getAdminSummary,
  getAdminSupportMessages,
  getAdminSupportThreads,
  getAdminSupportTyping,
  patchKieEconomics,
  putAdminApimart,
  putAdminOpenAiVless,
  postAdminCloseThread,
  postAdminGrant,
  postAdminMarkRead,
  postAdminPromoCode,
  postAdminSupportTyping,
  postAdminSupportReply,
  type AdminStats,
  type PromoCodeRow,
  type SiteEventRow,
  type SupportMessage,
  type SupportThread,
} from '../api/admin'
import {
  encodeSupportAttachmentFiles,
  fileLooksLikeVideo,
  isAcceptableSupportMediaFile,
  resolveSupportMediaUrl,
} from '../lib/supportAttachments'
import { useAuth } from '../store/authStore'

const FAREWELL_CLOSE_MESSAGE = 'Рады что смогли помочь! Обращайтесь!'
/** Одна выборка последних событий (без «Показать ещё»). */
const ADMIN_EVENTS_LIMIT = 120

const KIND_LABEL: Record<string, string> = {
  registration: 'Регистрация',
  topup: 'Пополнение',
  promo_redeem: 'Промокод',
  roulette: 'Рулетка',
  admin_grant: 'Начисление админом',
  generation_ok: 'Генерация ✓',
  generation_fail: 'Генерация ✕',
  login_ok: 'Вход ✓',
  login_fail: 'Вход ✕',
  moderation_blocked: 'Модерация ✕',
  moderation_error: 'Модерация ⚠',
}

function dedupeThreads(list: SupportThread[]): SupportThread[] {
  const m = new Map<string, SupportThread>()
  for (const t of list) {
    const id = String(t.userId).trim().toLowerCase()
    if (!m.has(id)) m.set(id, { ...t, userId: String(t.userId).trim() })
  }
  return [...m.values()]
}

function formatUsdMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0'
  const rounded = Math.round(n * 10000) / 10000
  const s = rounded.toFixed(4).replace(/\.?0+$/, '')
  return `$${s}`
}

function formatRubMoney(n: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/** ISO yyyy-mm-dd → dd.mm.yyyy */
function formatBillingDayHuman(day: string | undefined): string {
  if (!day || day === 'MSK') return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim())
  if (m) return `${m[3]}.${m[2]}.${m[1]}`
  return day
}

function eventRowClass(kind: string): string {
  if (kind === 'login_ok' || kind === 'generation_ok') {
    return 'border-l-4 border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/25'
  }
  if (kind === 'login_fail' || kind === 'generation_fail') {
    return 'border-l-4 border-l-red-500 bg-red-50/35 dark:bg-red-950/25'
  }
  if (kind === 'moderation_blocked') {
    return 'border-l-4 border-l-zinc-700 bg-zinc-100/60 dark:bg-zinc-900/40'
  }
  if (kind === 'moderation_error') {
    return 'border-l-4 border-l-yellow-400 bg-yellow-50/30 dark:bg-yellow-950/20'
  }
  return ''
}

function eventMetaLine(e: SiteEventRow): string | null {
  const m = e.meta
  const parts: string[] = []
  if (e.kind === 'generation_ok' || e.kind === 'generation_fail') {
    if (typeof m?.photoProvider === 'string' && m.photoProvider) parts.push(`провайдер:${m.photoProvider}`)
    if (typeof m?.neuroSpendUsd === 'number' && m.neuroSpendUsd > 0) {
      parts.push(`Neuro ~$${m.neuroSpendUsd}`)
    }
  }
  if (e.kind === 'moderation_blocked') {
    if (Array.isArray(m?.categories) && m.categories.length) {
      parts.push(`категории: ${(m.categories as string[]).join(', ')}`)
    }
    if (typeof m?.context === 'string' && m.context) parts.push(`контекст: ${m.context}`)
    if (typeof m?.textPreview === 'string' && m.textPreview) parts.push(`«${m.textPreview}»`)
  }
  if (e.kind === 'moderation_error') {
    if (typeof m?.context === 'string' && m.context) parts.push(`контекст: ${m.context}`)
    if (typeof m?.error === 'string' && m.error) parts.push(m.error)
  }
  return parts.length ? parts.join(' · ') : null
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function eventUserLabel(e: SiteEventRow): string {
  return (
    e.displayName ||
    e.email ||
    e.login ||
    (e.telegramUsername ? `@${e.telegramUsername}` : null) ||
    e.publicTag ||
    (e.userId ? e.userId.slice(0, 8) + '…' : '—')
  )
}

function StatCard({
  title,
  value,
  subtitle,
  subtitleClassName,
}: {
  title: string
  value: string
  subtitle?: string
  subtitleClassName?: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-600/80 bg-surface px-4 py-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p className="text-xl font-bold text-slate-900 dark:text-slate-50 mt-1 tabular-nums">{value}</p>
      {subtitle ? (
        <p
          className={`text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed ${subtitleClassName ?? ''}`}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  )
}

export default function AdminPanelPage() {
  const { token, user } = useAuth()
  const isApi = Boolean(token && token !== 'local-dev')
  const isMobile = useMediaQuery('(max-width: 639px)')

  const [stats, setStats] = useState<AdminStats | null>(null)
  const [supportUnread, setSupportUnread] = useState(0)
  const [threads, setThreads] = useState<SupportThread[]>([])
  const [selectedId, setSelectedId] = useAdminSupportThreadSelection()
  const [threadMessages, setThreadMessages] = useState<SupportMessage[]>([])
  const [replyDraft, setReplyDraft] = useState('')
  const [replyPendingFiles, setReplyPendingFiles] = useState<{ id: string; file: File; url: string }[]>([])
  const replyFileInputRef = useRef<HTMLInputElement>(null)
  const threadScrollRef = useRef<HTMLDivElement>(null)
  const [events, setEvents] = useState<SiteEventRow[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [promos, setPromos] = useState<PromoCodeRow[]>([])
  const [promoCode, setPromoCode] = useState('')
  const [promoCredits, setPromoCredits] = useState('100')
  const [promoMaxUses, setPromoMaxUses] = useState('')
  const [grantTarget, setGrantTarget] = useState('')
  const [grantCredits, setGrantCredits] = useState('50')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [supportUserTyping, setSupportUserTyping] = useState(false)
  const [kieTokenUsdEdit, setKieTokenUsdEdit] = useState('')
  const [usdRubEdit, setUsdRubEdit] = useState('')
  const [kieSaveBusy, setKieSaveBusy] = useState(false)
  const [photoModeBusy, setPhotoModeBusy] = useState(false)
  const [vlessOpen, setVlessOpen] = useState(false)
  const [vlessMasked, setVlessMasked] = useState<string | null>(null)
  const [vlessHasProxyOverride, setVlessHasProxyOverride] = useState(false)
  const [vlessDraft, setVlessDraft] = useState('')
  const [vlessSaving, setVlessSaving] = useState(false)
  const [apimartOpen, setApimartOpen] = useState(false)
  const [apimartEnabled, setApimartEnabled] = useState(false)
  const [apimartHasKey, setApimartHasKey] = useState(false)
  const [apimartKeyMasked, setApimartKeyMasked] = useState<string | null>(null)
  const [apimartKeyDraft, setApimartKeyDraft] = useState('')
  const [apimartBaseUrl, setApimartBaseUrl] = useState('https://api.apimart.ai/v1')
  const [apimartMaxConcurrent, setApimartMaxConcurrent] = useState('40')
  const [apimartSaving, setApimartSaving] = useState(false)
  const kieFormHydratedRef = useRef(false)
  const adminTypingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadAll = useCallback(async () => {
    if (!token || !isApi) return
    const settled = await Promise.allSettled([
      getAdminSummary(token),
      getAdminSupportThreads(token),
      getAdminPromoCodes(token),
    ])
    const [sumR, thR, prR] = settled
    if (sumR.status === 'fulfilled') {
      setStats(sumR.value.stats)
      setSupportUnread(sumR.value.supportUnread)
    }
    if (thR.status === 'fulfilled') setThreads(dedupeThreads(thR.value.threads))
    if (prR.status === 'fulfilled') setPromos(prR.value.codes)
  }, [token, isApi])

  const loadAllRef = useRef(loadAll)
  loadAllRef.current = loadAll

  const refreshSupportSidebar = useCallback(async () => {
    if (!token || !isApi) return
    const settled = await Promise.allSettled([getAdminSummary(token), getAdminSupportThreads(token)])
    const [sumR, thR] = settled
    if (sumR.status === 'fulfilled') {
      setStats(sumR.value.stats)
      setSupportUnread(sumR.value.supportUnread)
    }
    if (thR.status === 'fulfilled') setThreads(dedupeThreads(thR.value.threads))
  }, [token, isApi])

  const refreshSupportSidebarRef = useRef(refreshSupportSidebar)
  refreshSupportSidebarRef.current = refreshSupportSidebar

  const loadEvents = useCallback(async (options?: { silent?: boolean }) => {
    if (!token || !isApi) return
    const silent = Boolean(options?.silent)
    if (!silent) setEventsLoading(true)
    try {
      const resp = await getAdminEvents(token, ADMIN_EVENTS_LIMIT, 0)
      setEvents(Array.isArray(resp.events) ? resp.events : [])
    } finally {
      if (!silent) setEventsLoading(false)
    }
  }, [token, isApi])

  useEffect(() => {
    kieFormHydratedRef.current = false
    setKieTokenUsdEdit('')
    setUsdRubEdit('')
  }, [token])

  useEffect(() => {
    if (!token || !isApi) {
      setVlessMasked(null)
      setVlessHasProxyOverride(false)
      return
    }
    let cancelled = false
    void getAdminOpenAiVless(token)
      .then((state) => {
        if (cancelled) return
        setVlessMasked(state.vlessMasked ?? null)
        setVlessHasProxyOverride(Boolean(state.hasOpenAiProxy))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token, isApi])

  useEffect(() => {
    if (!token || !isApi) {
      setApimartEnabled(false)
      setApimartHasKey(false)
      setApimartKeyMasked(null)
      setApimartBaseUrl('https://api.apimart.ai/v1')
      setApimartMaxConcurrent('40')
      return
    }
    let cancelled = false
    void getAdminApimart(token)
      .then((state) => {
        if (cancelled) return
        setApimartEnabled(Boolean(state.enabled))
        setApimartHasKey(Boolean(state.hasKey))
        setApimartKeyMasked(state.keyMasked ?? null)
        setApimartBaseUrl(state.baseUrl || 'https://api.apimart.ai/v1')
        setApimartMaxConcurrent(String(state.maxConcurrent || 40))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token, isApi])

  useEffect(() => {
    if (!stats || kieFormHydratedRef.current) return
    if (stats.kieTokenUsd != null) setKieTokenUsdEdit(String(stats.kieTokenUsd))
    if (stats.usdRubRate != null) setUsdRubEdit(String(stats.usdRubRate))
    kieFormHydratedRef.current = true
  }, [stats])

  const saveKieEconomicsSettings = async () => {
    if (!token || !isApi) return
    setErr(null)
    setMsg(null)
    setKieSaveBusy(true)
    try {
      const econ = await patchKieEconomics(token, {
        kieTokenUsd: Number(String(kieTokenUsdEdit).replace(',', '.')),
        usdRubRate: Number(String(usdRubEdit).replace(',', '.')),
      })
      setKieTokenUsdEdit(String(econ.kieTokenUsd))
      setUsdRubEdit(String(econ.usdRubRate))
      setMsg('Настройки стоимости Kie сохранены')
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setKieSaveBusy(false)
    }
  }

  const savePhotoProviderMode = async (mode: 'kie' | 'hybrid' | 'apimart') => {
    if (!token || !isApi) return
    setErr(null)
    setMsg(null)
    setPhotoModeBusy(true)
    try {
      if (mode === 'apimart') {
        await putAdminApimart(token, { enabled: true })
        setApimartEnabled(true)
        setMsg('Режим APIMart-гибрид включен: поддерживаемые модели идут в APIMart, остальные — в Kie.')
      } else {
        await putAdminApimart(token, { enabled: false })
        setApimartEnabled(false)
        await patchKieEconomics(token, { photoProviderMode: mode })
        setMsg(
          mode === 'hybrid'
            ? 'Режим гибрида: Nano Banana 2 / Pro — через NeuroAPI (при сбое — Kie). GPT Image 2 и остальные фото — Kie. Видео и музыка всегда Kie.'
            : 'Режим только Kie.ai для всех моделей.',
        )
      }
      await loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить режим')
    } finally {
      setPhotoModeBusy(false)
    }
  }

  const saveOpenAiVless = async () => {
    if (!token || !isApi) return
    const uri = vlessDraft.trim()
    if (!uri) {
      setErr('Вставьте VLESS-ссылку')
      return
    }
    setErr(null)
    setMsg(null)
    setVlessSaving(true)
    try {
      const state = await putAdminOpenAiVless(token, uri)
      setVlessMasked(state.vlessMasked ?? null)
      setVlessHasProxyOverride(Boolean(state.hasOpenAiProxy))
      setVlessDraft('')
      setVlessOpen(false)
      setMsg('VLESS-ключ для GPT обновлён и применён сразу')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить VLESS-ключ')
    } finally {
      setVlessSaving(false)
    }
  }

  const saveApimart = async () => {
    if (!token || !isApi) return
    setErr(null)
    setMsg(null)
    const maxConcurrent = Number(String(apimartMaxConcurrent).trim())
    if (!Number.isFinite(maxConcurrent) || maxConcurrent < 1) {
      setErr('Укажите APIMART_MAX_CONCURRENT (целое число >= 1)')
      return
    }
    if (apimartEnabled && !apimartHasKey && !apimartKeyDraft.trim()) {
      setErr('Чтобы включить APIMart-гибрид, укажите APIMART_API_KEY')
      return
    }
    setApimartSaving(true)
    try {
      const state = await putAdminApimart(token, {
        enabled: apimartEnabled,
        apiKey: apimartKeyDraft.trim() || undefined,
        baseUrl: apimartBaseUrl.trim(),
        maxConcurrent: Math.round(maxConcurrent),
      })
      setApimartEnabled(Boolean(state.enabled))
      setApimartHasKey(Boolean(state.hasKey))
      setApimartKeyMasked(state.keyMasked ?? null)
      setApimartBaseUrl(state.baseUrl || 'https://api.apimart.ai/v1')
      setApimartMaxConcurrent(String(state.maxConcurrent || 40))
      setApimartKeyDraft('')
      setApimartOpen(false)
      setMsg(
        state.enabled
          ? 'APIMart-гибрид включен: поддерживаемые модели идут в APIMart, остальные — в Kie'
          : 'APIMart-гибрид выключен: используется стандартная маршрутизация',
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось сохранить APIMart')
    } finally {
      setApimartSaving(false)
    }
  }

  useEffect(() => {
    setEvents([])
    void loadEvents()
  }, [loadEvents, token, isApi])

  /** Новые события в «Операции» без перезагрузки страницы (как у чата поддержки). */
  useEffect(() => {
    if (!token || !isApi) return
    const tick = () => {
      void loadEvents({ silent: true })
    }
    const id = window.setInterval(tick, 8000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [token, isApi, loadEvents])

  useEffect(() => {
    loadAll()
    const t = window.setInterval(loadAll, 12_000)
    return () => window.clearInterval(t)
  }, [loadAll])

  useEffect(() => {
    if (!selectedId || !token || !isApi) {
      setThreadMessages([])
      return
    }
    let cancelled = false
    let firstLoad = true
    const load = async () => {
      try {
        const { messages } = await getAdminSupportMessages(token, selectedId)
        if (!cancelled) setThreadMessages(messages)
        await postAdminMarkRead(token, selectedId)
        if (!cancelled) void refreshSupportSidebarRef.current()
      } catch {
        if (!cancelled && firstLoad) setThreadMessages([])
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
  }, [selectedId, token, isApi])

  useEffect(() => {
    if (!selectedId || !token || !isApi) {
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
  }, [selectedId, token, isApi])

  useEffect(() => {
    if (!selectedId || !token || !isApi) return
    if (adminTypingDebounceRef.current) clearTimeout(adminTypingDebounceRef.current)
    if (!replyDraft.trim()) return
    adminTypingDebounceRef.current = setTimeout(() => {
      adminTypingDebounceRef.current = null
      void postAdminSupportTyping(token, selectedId)
    }, 450)
    return () => {
      if (adminTypingDebounceRef.current) clearTimeout(adminTypingDebounceRef.current)
    }
  }, [replyDraft, selectedId, token, isApi])

  const scrollAdminThreadToEnd = useStickToBottomSupportChat(threadScrollRef, [threadMessages, replyPendingFiles])

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

  const goBackFromChat = () => {
    setMsg(null)
    setErr(null)
    setSelectedId(null)
  }

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
          setErr('Файл не подошёл. Выберите фото или видео (JPEG, PNG, HEIC, MP4…).'),
        )
      } else if (added > 0) {
        queueMicrotask(() => setErr(null))
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

  const closeChatAndNotifyUser = async () => {
    if (!token || !selectedId) return
    setErr(null)
    setMsg(null)
    try {
      await postAdminSupportReply(token, selectedId, FAREWELL_CLOSE_MESSAGE)
      await postAdminCloseThread(token, selectedId)
      setMsg('Пользователю отправлено: «' + FAREWELL_CLOSE_MESSAGE + '»')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось отправить сообщение')
      return
    }
    setSelectedId(null)
    loadAll()
  }

  const sendReply = async () => {
    if (!token || !selectedId) return
    const text = replyDraft.trim()
    if (!text && replyPendingFiles.length === 0) return
    setErr(null)
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
      const { messages } = await getAdminSupportMessages(token, selectedId)
      setThreadMessages(messages)
      loadAll()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка отправки')
    }
  }

  const createPromo = async () => {
    if (!token) return
    setErr(null)
    setMsg(null)
    const code = promoCode.trim()
    const credits = Number(promoCredits)
    if (code.length < 3) {
      setErr('Код минимум 3 символа (латиница, цифры, _)')
      return
    }
    if (!Number.isFinite(credits) || credits <= 0) {
      setErr('Укажите число кредитов больше 0')
      return
    }
    let maxUses: number | null = null
    if (promoMaxUses.trim() !== '') {
      const m = Number(promoMaxUses)
      if (!Number.isFinite(m) || m < 1) {
        setErr('Лимит активаций — целое число ≥ 1 или пусто')
        return
      }
      maxUses = m
    }
    try {
      await postAdminPromoCode(token, { code, credits, maxUses })
      setPromoCode('')
      setMsg('Промокод создан')
      const pr = await getAdminPromoCodes(token)
      setPromos(pr.codes)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  const grant = async () => {
    if (!token) return
    setErr(null)
    setMsg(null)
    const target = grantTarget.trim()
    const credits = Number(grantCredits)
    if (!target) {
      setErr('Укажите пользователя: UUID, email, логин, тег или @Telegram')
      return
    }
    if (!Number.isFinite(credits) || credits <= 0) {
      setErr('Сумма начисления должна быть больше 0')
      return
    }
    try {
      await postAdminGrant(token, { target, credits })
      setMsg('Баланс начислен')
      setGrantTarget('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  if (!isApi) {
    return <Navigate to="/explore" replace />
  }
  if (user && user.isAdmin !== true) {
    return <Navigate to="/explore" replace />
  }

  if (isMobile) return <AdminLayout />

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-base text-slate-900 dark:text-slate-100 w-full max-w-[100vw]">
      <header className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-surface/95 backdrop-blur-sm z-10">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 truncate">Админ-панель</h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Чаты · операции · промокоды</p>
        </div>
        <Link
          to="/explore"
          className="text-sm font-medium text-[var(--color-brand)] hover:underline shrink-0"
        >
          В приложение
        </Link>
      </header>

      {msg ? (
        <p className="shrink-0 px-3 py-1.5 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-b border-emerald-500/20">
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="shrink-0 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 bg-red-500/10 border-b border-red-500/20">
          {err}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Список чатов слева — как в Telegram */}
        <aside
          className={`flex min-h-0 flex-col bg-slate-50/80 dark:bg-slate-900/40 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700 md:w-80 md:max-w-[min(100vw,360px)] md:shrink-0 md:self-stretch md:max-h-full ${
            selectedId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-100/90 dark:bg-slate-800/60">
            <span className="text-sm font-semibold">Чаты</span>
            {supportUnread > 0 ? (
              <span className="text-[11px] font-bold rounded-full bg-rose-500 text-white px-2 py-0.5">
                {supportUnread}
              </span>
            ) : null}
          </div>
          <div className="overflow-y-auto max-h-[60vh] md:flex-1 md:max-h-none md:min-h-0">
            {threads.length === 0 ? (
              <p className="p-3 text-xs text-slate-500">Нет пользователей</p>
            ) : (
              threads.map((t) => (
                <button
                  key={String(t.userId)}
                  type="button"
                  onClick={() => {
                    setErr(null)
                    setSelectedId(String(t.userId))
                  }}
                  className={`w-full text-left px-3 py-3 border-b border-slate-200/80 dark:border-slate-700/80 hover:bg-white/80 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 ${
                    String(selectedId) === String(t.userId)
                      ? 'bg-[var(--color-brand)]/15 ring-1 ring-inset ring-[var(--color-brand)]/25'
                      : ''
                  }`}
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
        </aside>

        {/* Справа: дашборд или полноэкранный чат */}
        <section
          className={`flex min-h-0 min-w-0 max-h-full flex-1 flex-col overflow-hidden ${
            selectedId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {selectedId ? (
            <div className="flex flex-1 flex-col min-h-0 bg-surface">
              <div className="shrink-0 flex items-center gap-2 px-2 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/90 dark:bg-slate-800/50">
                <button
                  type="button"
                  onClick={goBackFromChat}
                  className="shrink-0 rounded-xl p-2 hover:bg-slate-200/80 dark:hover:bg-slate-700/80"
                  aria-label="Назад к списку"
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
                  onClick={() => void closeChatAndNotifyUser()}
                  className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Закрыть чат
                </button>
              </div>
              <div
                ref={threadScrollRef}
                className="min-h-0 flex-1 basis-0 overflow-y-auto overscroll-contain p-3 space-y-2 touch-pan-y"
              >
                {threadMessages.map((m) => (
                  <div key={m.id} className={`flex ${m.isFromAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[min(90%,28rem)] rounded-2xl px-3 py-2 text-sm ${
                        m.isFromAdmin
                          ? 'bg-[var(--color-brand)] text-[var(--color-on-brand)]'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {m.body?.trim() ? (
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      ) : null}
                      {(m.attachments ?? []).length > 0 ? (
                        <div className={`flex flex-col gap-2 ${m.body?.trim() ? 'mt-2' : ''}`}>
                          {(m.attachments ?? []).map((a, i) => (
                            <div
                              key={`${m.id}-att-${i}`}
                              className={`rounded-xl overflow-hidden max-w-[240px] ${
                                m.isFromAdmin
                                  ? 'border border-[var(--color-on-brand)]/25'
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
                              {a.name ? (
                                <p className="text-[10px] opacity-80 px-2 py-1 truncate">{a.name}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <p className="text-[10px] opacity-70 mt-1">{formatTime(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
                    onFocus={() => scrollAdminThreadToEnd()}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || e.shiftKey) return
                      if ('isComposing' in e.nativeEvent && e.nativeEvent.isComposing) return
                      e.preventDefault()
                      if (!replyDraft.trim() && replyPendingFiles.length === 0) return
                      void sendReply()
                    }}
                    placeholder="Сообщение…"
                    rows={3}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2.5 text-sm resize-y min-h-[5.25rem] max-h-40"
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
          ) : (
            <div className="flex flex-1 flex-col min-h-0 overflow-y-auto gap-3 p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 shrink-0">
                <StatCard
                  title="Конверсия генераций (UTC-сутки)"
                  value={stats?.conversionPct != null ? `${stats.conversionPct}%` : '—'}
                  subtitleClassName="whitespace-pre-line"
                  subtitle={
                    stats
                      ? (() => {
                          const lines: string[] = []
                          lines.push(
                            `Всего: ${stats.generationsOk} положительных · ${stats.generationsFail} отрицательных`,
                          )
                          const nReq = stats.neuroHybridTried ?? 0
                          const nOk = stats.neuroGenerationsOk ?? 0
                          if (nReq > 0) {
                            const p =
                              stats.neuroConversionPct != null ? `${stats.neuroConversionPct}%` : '—'
                            lines.push(`Neuro · конверсия ${p} · запросов ${nReq}, положительных ${nOk}`)
                          } else {
                            lines.push('Neuro · нет запросов за день')
                          }
                          const kReq = (stats.kieRouteOk ?? 0) + (stats.kieRouteFail ?? 0)
                          const kOk = stats.kieRouteOk ?? 0
                          if (kReq > 0) {
                            const p =
                              stats.kieConversionPct != null ? `${stats.kieConversionPct}%` : '—'
                            lines.push(`Kie · конверсия ${p} · запросов ${kReq}, положительных ${kOk}`)
                          } else {
                            lines.push('Kie · нет запросов за день')
                          }
                          const aReq = (stats.apimartGenerationsOk ?? 0) + (stats.apimartRouteFail ?? 0)
                          const aOk = stats.apimartGenerationsOk ?? 0
                          if (aReq > 0) {
                            const p =
                              stats.apimartConversionPct != null ? `${stats.apimartConversionPct}%` : '—'
                            lines.push(`APIMart · конверсия ${p} · запросов ${aReq}, положительных ${aOk}`)
                          } else {
                            lines.push('APIMart · нет запросов за день')
                          }
                          return lines.join('\n')
                        })()
                      : undefined
                  }
                />
                <StatCard
                  title="Генерации за сегодня"
                  value={stats ? `${stats.generationsOk + stats.generationsFail}` : '—'}
                  subtitle="по журналу событий"
                />
                <StatCard
                  title="Расход API (Kie UTC · Neuro MSK)"
                  value={stats != null ? formatUsdMoney(stats.apiSpendUsd) : '—'}
                  subtitleClassName="whitespace-pre-line"
                  subtitle={
                    stats != null
                      ? (() => {
                          const kie = stats.kieApiSpendUsd ?? 0
                          const neuro = stats.neuroSpendUsd ?? 0
                          const apimart = stats.apimartSpendUsd ?? 0
                          const tokens = stats.kieTokensToday ?? stats.apiUnits
                          const neuroOk = stats.neuroGenerationsOk ?? 0
                          const apimartOk = stats.apimartGenerationsOk ?? 0
                          const rub =
                            stats.apiSpendRub != null ? `${formatRubMoney(stats.apiSpendRub)} ₽` : null
                          const lines: string[] = []
                          lines.push(
                            rub
                              ? `Итого ~${rub} (${formatUsdMoney(stats.apiSpendUsd)}: Kie ${formatUsdMoney(kie)} + APIMart ${formatUsdMoney(apimart)} + Neuro ${formatUsdMoney(neuro)})`
                              : `Итого ${formatUsdMoney(stats.apiSpendUsd)}: Kie ${formatUsdMoney(kie)} + APIMart ${formatUsdMoney(apimart)} + Neuro ${formatUsdMoney(neuro)}`,
                          )
                          lines.push(`Kie · UTC · ${formatUsdMoney(kie)} · ${tokens} ток.`)
                          lines.push(`APIMart · UTC · ${formatUsdMoney(apimart)} · ${apimartOk} запросов`)
                          if (stats.neuroSpendUsdBilling != null) {
                            const dh = formatBillingDayHuman(stats.neuroBillingMskDay)
                            lines.push(
                              `Neuro · ${formatUsdMoney(neuro)} · биллинг${dh ? ` за ${dh}` : ''} · ${neuroOk} neuro-only (UTC)`,
                            )
                          } else if (stats.neuroBillingUnit === 'unavailable') {
                            lines.push(
                              `Neuro · ${formatUsdMoney(neuro)} · ${neuroOk} neuro-only · биллинг API недоступен`,
                            )
                          } else {
                            lines.push(`Neuro · ${formatUsdMoney(neuro)} · ${neuroOk} neuro-only (UTC)`)
                          }
                          const logged = stats.neuroSpendUsdLogged ?? 0
                          const est = stats.neuroSpendUsdEstimated ?? 0
                          if (
                            stats.neuroSpendUsdBilling == null &&
                            neuroOk > 0 &&
                            logged === 0 &&
                            est > 0 &&
                            neuro === est
                          ) {
                            lines.push(
                              `Оценка Neuro ${formatUsdMoney(est)} (${formatUsdMoney(stats.neuroApiGenerationUnitUsd ?? 0.02)}/шт.; журнал $0)`,
                            )
                          } else if (
                            stats.neuroSpendUsdBilling == null &&
                            logged > 0 &&
                            est > 0 &&
                            Math.abs(logged - est) > 1e-6
                          ) {
                            lines.push(`Журнал Neuro ${formatUsdMoney(logged)} · оценка ${formatUsdMoney(est)}`)
                          }
                          if (stats.kieTokenUsd != null && stats.usdRubRate != null) {
                            lines.push(
                              `Курс ${stats.usdRubRate} ₽/$ · токен Kie ${formatUsdMoney(stats.kieTokenUsd)}`,
                            )
                          }
                          return lines.join('\n')
                        })()
                      : undefined
                  }
                />
                <StatCard
                  title="Зарегистрировано"
                  value={
                    stats?.registeredUsersTotal != null
                      ? stats.registeredUsersTotal.toLocaleString('ru-RU')
                      : '—'
                  }
                  subtitle="пользователей в системе"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface p-3 space-y-3 shrink-0">
                <h3 className="text-sm font-semibold">Режим провайдера AI</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  <strong className="font-medium text-slate-600 dark:text-slate-300">Только Kie</strong> — как сейчас, все модели через Kie.ai.{' '}
                  <strong className="font-medium text-slate-600 dark:text-slate-300">Гибрид</strong> — Google Nano Banana 2 и Nano Banana Pro по
                  умолчанию через NeuroAPI (нужен ключ в <code className="text-[10px]">NEUROAPI_API_KEY</code> или{' '}
                  <code className="text-[10px]">NEURO_API_KEY</code> в server/.env). GPT Image 2 и остальные фото-модели — Kie. Видео и
                  музыка всегда Kie. Если NeuroAPI возвращает ошибку по этим двум моделям, запрос одной генерации автоматически делается через Kie.{' '}
                  <strong className="font-medium text-slate-600 dark:text-slate-300">APIMart-гибрид</strong> — поддерживаемые модели через APIMart, остальные через Kie.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-600 p-1 gap-1">
                    {(['kie', 'hybrid', 'apimart'] as const).map((mode) => {
                      const isActive = mode === 'apimart'
                        ? apimartEnabled
                        : !apimartEnabled && stats?.photoProviderMode === mode
                      const label =
                        mode === 'kie'
                          ? 'Только Kie.ai'
                          : mode === 'hybrid'
                            ? 'Гибрид (NeuroAPI + Kie)'
                            : 'APIMart-гибрид'
                      return (
                        <button
                          key={mode}
                          type="button"
                          disabled={photoModeBusy || !stats || isActive}
                          onClick={() => void savePhotoProviderMode(mode)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                            isActive
                              ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  {photoModeBusy ? <span className="text-xs text-slate-400">Сохранение…</span> : null}
                </div>
                {stats?.photoProviderMode === 'hybrid' ? (
                  <p
                    className={`text-xs leading-relaxed ${
                      stats.neuroApiKeyPresent
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    {stats.neuroApiKeyPresent
                      ? 'Ключ NeuroAPI на сервере виден — гибрид для Nano Banana 2 / Pro может работать (см. логи: «photo via NeuroAPI» или fallback).'
                      : 'На сервере нет ключа NeuroAPI — запросы к картинке всё равно пойдут в Kie. Задайте NEUROAPI_API_KEY (или NEURO_API_KEY) в server/.env на VPS и перезапустите PM2.'}
                  </p>
                ) : null}
                {apimartEnabled ? (
                  <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-400">
                    APIMart-гибрид активен: поддерживаемые модели идут в APIMart, остальные — в Kie.
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface p-3 space-y-2 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">VLESS для GPT (OpenAI)</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Компактная замена ключа без перезапуска PM2.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVlessOpen((v) => !v)}
                    className="rounded-lg border border-slate-200 dark:border-slate-600 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {vlessOpen ? 'Скрыть' : 'Изменить'}
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 break-all">
                  Текущий: {vlessMasked ?? 'не задан'}
                </p>
                {vlessHasProxyOverride ? (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Внимание: включён OPENAI_PROXY — приоритет у него, а не у VLESS.
                  </p>
                ) : null}
                {vlessOpen ? (
                  <div className="pt-1 space-y-2">
                    <textarea
                      value={vlessDraft}
                      onChange={(e) => setVlessDraft(e.target.value)}
                      placeholder="vless://UUID@host:443?...security=reality&pbk=...&sni=...&sid=..."
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void saveOpenAiVless()}
                        disabled={vlessSaving || !vlessDraft.trim()}
                        className="rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-4 py-2 text-sm font-medium disabled:opacity-40"
                      >
                        {vlessSaving ? 'Сохранение…' : 'Сохранить и применить'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVlessDraft('')
                          setVlessOpen(false)
                        }}
                        className="rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-xs"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface p-3 space-y-2 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">APIMart (3-й провайдер)</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Если включено, поддерживаемые модели идут через APIMart, остальные — через Kie.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setApimartOpen((v) => !v)}
                    className="rounded-lg border border-slate-200 dark:border-slate-600 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {apimartOpen ? 'Скрыть' : 'Изменить'}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className={apimartEnabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}>
                    Режим: {apimartEnabled ? 'APIMart-гибрид (включён)' : 'стандартный (выключен)'}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">Ключ: {apimartHasKey ? (apimartKeyMasked ?? 'задан') : 'не задан'}</span>
                </div>
                {apimartOpen ? (
                  <div className="pt-1 space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Включение/выключение режима перенесено в общий тройной переключатель выше.
                    </p>
                    <input
                      type="password"
                      value={apimartKeyDraft}
                      onChange={(e) => setApimartKeyDraft(e.target.value)}
                      placeholder="Новый APIMART_API_KEY (оставьте пустым, чтобы не менять)"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-xs"
                    />
                    <input
                      value={apimartBaseUrl}
                      onChange={(e) => setApimartBaseUrl(e.target.value)}
                      placeholder="https://api.apimart.ai/v1"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-xs"
                    />
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={apimartMaxConcurrent}
                      onChange={(e) => setApimartMaxConcurrent(e.target.value)}
                      placeholder="APIMART_MAX_CONCURRENT"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void saveApimart()}
                        disabled={apimartSaving}
                        className="rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-4 py-2 text-sm font-medium disabled:opacity-40"
                      >
                        {apimartSaving ? 'Сохранение…' : 'Сохранить и применить'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setApimartKeyDraft('')
                          setApimartOpen(false)
                        }}
                        className="rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-xs"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface p-3 space-y-2 shrink-0">
                <h3 className="text-sm font-semibold">Стоимость токена Kie и курс USD→RUB</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  В логах хранится число токенов и сумма в $ на момент события. Сводка за день суммирует $ из логов; рубли = эта сумма × текущий курс ниже.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="block text-xs space-y-1">
                    <span className="text-slate-500 dark:text-slate-400">USD за 1 токен Kie</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={kieTokenUsdEdit}
                      onChange={(e) => setKieTokenUsdEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="block text-xs space-y-1">
                    <span className="text-slate-500 dark:text-slate-400">₽ за 1 USD</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={usdRubEdit}
                      onChange={(e) => setUsdRubEdit(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void saveKieEconomicsSettings()}
                  disabled={kieSaveBusy || !kieTokenUsdEdit.trim() || !usdRubEdit.trim()}
                  className="rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-4 py-2 text-sm font-medium disabled:opacity-40"
                >
                  {kieSaveBusy ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>

              <div className="flex flex-col lg:flex-row gap-3 shrink-0">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface p-3 space-y-2 flex-1">
                  <h3 className="text-sm font-semibold">Промокод</h3>
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Код (латиница, цифры)"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={promoCredits}
                      onChange={(e) => setPromoCredits(e.target.value)}
                      placeholder="Монет"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      value={promoMaxUses}
                      onChange={(e) => setPromoMaxUses(e.target.value)}
                      placeholder="Лимит (пусто = ∞)"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void createPromo()}
                    className="w-full rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 py-2 text-sm font-medium"
                  >
                    Создать промокод
                  </button>
                  <div className="max-h-28 overflow-y-auto text-[11px] text-slate-500 space-y-1">
                    {promos.slice(0, 12).map((p) => (
                      <div key={p.code} className="flex justify-between gap-2">
                        <span className="font-mono">{p.code}</span>
                        <span>
                          +{p.credits} ({p.usesCount}
                          {p.maxUses != null ? `/${p.maxUses}` : ''})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface p-3 space-y-2 flex-1 lg:max-w-md">
                  <h3 className="text-sm font-semibold">Начислить баланс</h3>
                  <input
                    value={grantTarget}
                    onChange={(e) => setGrantTarget(e.target.value)}
                    placeholder="UUID, email, логин, тег или @username"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    value={grantCredits}
                    onChange={(e) => setGrantCredits(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void grant()}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-sm font-medium"
                  >
                    Начислить
                  </button>
                </div>
              </div>

              <section className="shrink-0 rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-sm font-semibold">
                  Цены (фото и видео)
                </div>
                <PricesTab />
              </section>

              <section className="shrink-0 rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-sm font-semibold">
                  Заблокированные публикации
                </div>
                <div className="p-3">
                  <FeedModerationTab />
                </div>
              </section>

              <section className="shrink-0 rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-sm font-semibold">
                  Баннеры главной
                </div>
                <BannersTab />
              </section>

              <section className="shrink-0 rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-sm font-semibold">
                  Сайт: о сервисе и юридические тексты
                </div>
                <SiteSettingsTab />
              </section>

              <section className="shrink-0 rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-sm font-semibold">
                  Партнёры
                </div>
                <PartnersTab />
              </section>

              <section className="shrink-0 rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-sm font-semibold">
                  Пользователи
                </div>
                <UsersTab />
              </section>

              <section className="w-full shrink-0 rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface overflow-hidden flex flex-col min-h-0">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
                  <div className="text-sm font-semibold">Операции</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Последние {ADMIN_EVENTS_LIMIT} записей
                  </p>
                </div>
                <div
                  className="w-full overflow-y-auto min-h-0 divide-y divide-slate-100 dark:divide-slate-700/80 max-h-[50vh] min-h-[min(50vh,20rem)]"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {eventsLoading && events.length === 0 ? (
                    <p className="p-3 text-xs text-slate-500">Загрузка…</p>
                  ) : events.length === 0 ? (
                    <p className="p-3 text-xs text-slate-500">Нет событий</p>
                  ) : (
                    events.map((e) => {
                      const meta = eventMetaLine(e)
                      return (
                        <div
                          key={e.id}
                          className={`px-3 py-2.5 text-sm hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${eventRowClass(e.kind)}`}
                        >
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="font-medium">{KIND_LABEL[e.kind] ?? e.kind}</span>
                            <span className="text-slate-600 dark:text-slate-300 break-words">{e.label}</span>
                          </div>
                          {meta ? <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 break-words">{meta}</p> : null}
                          <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                            <span>{eventUserLabel(e)}</span>
                            <span>{formatTime(e.createdAt)}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
