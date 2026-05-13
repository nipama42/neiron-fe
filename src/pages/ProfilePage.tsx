import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { AuthUser, PublicGenerationItem } from '../api/auth'
import TechSupport from '../components/TechSupport'
import {
  deletePublicGeneration,
  getMe,
  patchProfile,
  patchPublicTag,
  type PatchProfileBody,
  uploadProfileAvatar,
} from '../api/me'
import TopUpModal from '../components/TopUpModal'
import { loadPendingOrder, clearPendingOrder } from '../lib/pendingPaymentStore'
import { getPaymentOrderStatus } from '../api/wallet'
import { likePublicGeneration, unlikePublicGeneration } from '../api/explore'
import { useAuth } from '../store/authStore'
import CreditCoin from '../components/ui/CreditCoin'
import { ProfileSocialIcon, type ProfileSocialKey } from '../components/ui/ProfileSocialIcon'
import { saveCreateDraft } from '../lib/createDraftStorage'
import MusicCardCover from '../components/ui/MusicCardCover'
import MediaDownloadButton from '../components/ui/MediaDownloadButton'
import GenerationDetailStatsDl from '../components/generation/GenerationDetailStatsDl'
import { validateInstagramField, validateTelegramField } from '../lib/socialUrlValidate'
import { onExternalAnchorClick } from '../lib/openExternalUrl'
import { avatarReferrerPolicy, resolveAvatarUrl } from '../lib/resolveAvatarUrl'
import { shrinkImageFileToJpegDataUrl } from '../lib/shrinkImageForUpload'
import {
  publicProfilePathRef,
  publicProfileWebUrl,
  publicProfileTelegramMiniAppUrl,
} from '../lib/profileShareLinks'

function initials(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '?'
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[1][0]).toUpperCase()
}

function profileDisplayName(u: AuthUser) {
  if (u.displayName?.trim()) return u.displayName.trim()
  if (u.tgFirstName?.trim()) return u.tgFirstName.trim()
  if (u.email) return u.email.split('@')[0] ?? 'Профиль'
  return 'Профиль'
}

function displayHandle(u: AuthUser) {
  if (u.publicTag) return `@${u.publicTag}`
  if (u.tgUsername) return `@${u.tgUsername}`
  return null
}

async function copyTextRobust(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fallback */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;left:-9999px;top:0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

const TAG_RE = /^[a-z0-9_]{3,24}$/


function ledgerKindLabel(kind: string): string {
  switch (kind) {
    case 'topup':
      return 'Пополнение'
    case 'promo':
      return 'Промокод'
    case 'roulette':
      return 'Рулетка'
    case 'spend':
      return 'Списание'
    default:
      return kind
  }
}

function modeLabel(mode: string): string {
  switch (mode) {
    case 'photo':
      return 'Фото'
    case 'video':
      return 'Видео'
    case 'audio':
      return 'Аудио'
    case 'music':
      return 'Музыка'
    default:
      return mode
  }
}

function formatGenerationDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function aspectToRatio(aspect?: string | null): number {
  const raw = String(aspect ?? '').trim()
  if (!raw.includes(':')) return 1
  const [wRaw, hRaw] = raw.split(':')
  const w = Number(wRaw)
  const h = Number(hRaw)
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 1
  return w / h
}

const SOCIAL_DEFS: { key: ProfileSocialKey; label: string; hint: string }[] = [
  { key: 'telegramUrl', label: 'Telegram / канал', hint: 'https://t.me/username' },
  { key: 'instagramUrl', label: 'Instagram', hint: 'https://www.instagram.com/username/' },
]

export default function ProfilePage() {
  const { token, user, mergeUser, clearAuth } = useAuth()
  const navigate = useNavigate()
  const isApi = Boolean(token && token !== 'local-dev')
  const [supportOpen, setSupportOpen] = useState(false)
  const savedScrollRef = useRef(0)
  const [editOpen, setEditOpen] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)

  const [genBusyId, setGenBusyId] = useState<string | null>(null)
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null)
  const [openedPubId, setOpenedPubId] = useState<string | null>(null)
  const closeTopUp = useCallback(() => setTopUpOpen(false), [])

  const [draftTag, setDraftTag] = useState('')
  const [draftBio, setDraftBio] = useState('')
  const [draftDisplayName, setDraftDisplayName] = useState('')
  /** Object URL превью выбранного файла */
  const [avatarBlobUrl, setAvatarBlobUrl] = useState<string | null>(null)
  /** data URL для POST /me/avatar */
  const [avatarPendingDataUrl, setAvatarPendingDataUrl] = useState<string | null>(null)
  const [avatarMarkRemove, setAvatarMarkRemove] = useState(false)
  const avatarFileInputRef = useRef<HTMLInputElement>(null)
  const profileLinkInputRef = useRef<HTMLInputElement>(null)
  const [draftUrls, setDraftUrls] = useState<Record<string, string>>({})
  const [profileLinkFeedback, setProfileLinkFeedback] = useState<{ ok: boolean; text: string } | null>(
    null
  )

  useEffect(() => {
    if (!token || token === 'local-dev') return
    getMe(token)
      .then((r) => mergeUser(r.user))
      .catch(() => { })
  }, [token, mergeUser])

  // При открытии профиля проверяем незавершённый платёж (например, пользователь
  // закрыл модальное окно до того, как оплата была подтверждена).
  useEffect(() => {
    if (!token || token === 'local-dev') return
    const pending = loadPendingOrder()
    if (!pending) return
    getPaymentOrderStatus(token, pending.orderId)
      .then((r) => {
        if (r.status === 'paid') {
          clearPendingOrder()
          if (r.user) mergeUser(r.user)
        } else if (r.status === 'failed' || r.status === 'expired') {
          clearPendingOrder()
        }
      })
      .catch(() => { /* тихо игнорируем */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  function closeEdit() {
    if (avatarBlobUrl) {
      URL.revokeObjectURL(avatarBlobUrl)
    }
    setAvatarBlobUrl(null)
    setAvatarPendingDataUrl(null)
    setAvatarMarkRemove(false)
    setEditOpen(false)
  }

  function openEdit() {
    if (!user) return
    setFormErr(null)
    setDraftTag(user.publicTag ?? '')
    setDraftBio(user.bio ?? '')
    setDraftDisplayName(user.displayName ?? profileDisplayName(user))
    if (avatarBlobUrl) {
      URL.revokeObjectURL(avatarBlobUrl)
    }
    setAvatarBlobUrl(null)
    setAvatarPendingDataUrl(null)
    setAvatarMarkRemove(false)
    const u: Record<string, string> = {}
    for (const { key } of SOCIAL_DEFS) {
      u[key] = user[key] ?? ''
    }
    setDraftUrls(u)
    setEditOpen(true)
  }

  useEffect(() => {
    return () => {
      if (avatarBlobUrl) URL.revokeObjectURL(avatarBlobUrl)
    }
  }, [avatarBlobUrl])

  const activeSocials = useMemo(() => {
    if (!user) return []
    return SOCIAL_DEFS.filter((d) => user[d.key])
  }, [user])

  const generationsLogById = useMemo(() => {
    const map = new Map<string, NonNullable<AuthUser['generationsLog']>[number]>()
    for (const item of user?.generationsLog ?? []) {
      if (item?.id) map.set(item.id, item)
    }
    return map
  }, [user?.generationsLog])

  const publicCards = useMemo(() => {
    return [...(user?.publicGenerations ?? [])]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((g) => ({
        ...g,
        resultUrl: g.resultUrl ?? generationsLogById.get(g.id)?.resultUrl ?? null,
        musicTitle: generationsLogById.get(g.id)?.musicTitle ?? g.musicTitle ?? null,
        promptFull:
          generationsLogById.get(g.id)?.prompt?.trim() ||
          generationsLogById.get(g.id)?.promptPreview?.trim() ||
          g.promptPreview,
        quality: generationsLogById.get(g.id)?.quality ?? null,
        duration: generationsLogById.get(g.id)?.duration ?? null,
      }))
  }, [user?.publicGenerations, generationsLogById])

  async function likePubGen(item: PublicGenerationItem) {
    if (!isApi || !token) return
    setLikeBusyId(item.id)
    try {
      if (item.likedByMe) {
        const r = await unlikePublicGeneration(token, item.id)
        mergeUser(r.user)
      } else {
        const r = await likePublicGeneration(token, item.id)
        mergeUser(r.user)
      }
    } catch {
      /* optional toast */
    } finally {
      setLikeBusyId(null)
    }
  }

  const openedPubItem = useMemo(
    () => publicCards.find((g) => g.id === openedPubId) ?? null,
    [publicCards, openedPubId]
  )

  /** Путь для React Router (тот же encode, что и в ленте). */
  const profilePublicRoute = useMemo(() => {
    if (!user) return ''
    return `/profile/author/${encodeURIComponent(publicProfilePathRef(user))}`
  }, [user])
  const profileShareUrlLive = useMemo(() => (user ? publicProfileWebUrl(user) : null), [user])
  const profileTelegramMiniUrl = useMemo(
    () => (user ? publicProfileTelegramMiniAppUrl(user) : null),
    [user]
  )

  useEffect(() => {
    if (!openedPubId) return
    const exists = publicCards.some((g) => g.id === openedPubId)
    if (!exists) setOpenedPubId(null)
  }, [openedPubId, publicCards])

  useEffect(() => {
    if (!openedPubId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenedPubId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openedPubId])

  useEffect(() => {
    if (!openedPubId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [openedPubId])

  async function saveProfile() {
    if (!user) return
    setFormErr(null)

    const trimmedTag = draftTag.trim().toLowerCase()
    if (trimmedTag && !TAG_RE.test(trimmedTag)) {
      setFormErr('Тег: 3–24 символа, строчные латинские буквы, цифры и подчёркивание')
      return
    }
    const igErr = validateInstagramField(draftUrls.instagramUrl ?? '')
    if (igErr) {
      setFormErr(`Instagram: ${igErr}`)
      return
    }
    const tgErr = validateTelegramField(draftUrls.telegramUrl ?? '')
    if (tgErr) {
      setFormErr(`Telegram: ${tgErr}`)
      return
    }

    const isLocal = !token || token === 'local-dev'

    setBusy(true)
    try {
      if (isLocal) {
        let nextAvatar: string | null = user.avatarUrl ?? null
        if (avatarMarkRemove && !avatarPendingDataUrl) {
          nextAvatar = null
        } else if (avatarPendingDataUrl) {
          nextAvatar = avatarPendingDataUrl
        }
        mergeUser({
          displayName: draftDisplayName.trim() || null,
          avatarUrl: nextAvatar,
          instagramUrl: (draftUrls.instagramUrl ?? '').trim() || null,
          telegramUrl: (draftUrls.telegramUrl ?? '').trim() || null,
          tiktokUrl: null,
          twitterUrl: null,
          youtubeUrl: null,
          vkUrl: null,
          bio: draftBio.trim() || null,
          publicTag: trimmedTag || null,
        })
        closeEdit()
        return
      }

      const tagNow = (user.publicTag ?? '').toLowerCase()
      if (trimmedTag !== tagNow) {
        const tr = await patchPublicTag(token!, trimmedTag)
        mergeUser(tr.user)
      }

      if (avatarPendingDataUrl) {
        const ar = await uploadProfileAvatar(token!, avatarPendingDataUrl)
        mergeUser(ar.user)
      }

      const profileBody: PatchProfileBody = {
        displayName: draftDisplayName.trim() || null,
        instagramUrl: (draftUrls.instagramUrl ?? '').trim() || null,
        telegramUrl: (draftUrls.telegramUrl ?? '').trim() || null,
        tiktokUrl: null,
        twitterUrl: null,
        youtubeUrl: null,
        vkUrl: null,
        bio: draftBio.trim() || null,
      }
      if (avatarMarkRemove && !avatarPendingDataUrl) {
        profileBody.avatarUrl = null
      }

      const pr = await patchProfile(token!, profileBody)
      mergeUser(pr.user)
      closeEdit()
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  async function shareProfile() {
    if (!user) return
    const webUrl = publicProfileWebUrl(user)
    if (!webUrl) return
    const tgUrl = publicProfileTelegramMiniAppUrl(user)
    const urlToShare = tgUrl ?? webUrl
    const title = profileDisplayName(user)
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title, text: 'Мой публичный профиль', url: urlToShare })
        setProfileLinkFeedback({ ok: true, text: 'Открыто окно «Поделиться»' })
        window.setTimeout(() => setProfileLinkFeedback(null), 2500)
        return
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      /* иначе — копируем ниже */
    }
    const ok = await copyTextRobust(urlToShare)
    setProfileLinkFeedback(
      ok
        ? { ok: true, text: 'Ссылка скопирована в буфер' }
        : {
            ok: false,
            text: 'Не удалось скопировать — выделите ссылку в поле ниже и скопируйте вручную',
          }
    )
    window.setTimeout(() => setProfileLinkFeedback(null), 4000)
  }

  async function copyProfileLink() {
    if (!user) return
    const url = publicProfileWebUrl(user)
    if (!url) return
    try {
      const el = profileLinkInputRef.current
      if (el) {
        el.focus()
        el.select()
        el.setSelectionRange(0, url.length)
      }
    } catch {
      /* старые WebView */
    }
    const ok = await copyTextRobust(url)
    setProfileLinkFeedback(
      ok
        ? { ok: true, text: 'Ссылка скопирована в буфер' }
        : {
            ok: false,
            text: 'Не удалось скопировать — выделите текст в поле и скопируйте вручную',
          }
    )
    window.setTimeout(() => setProfileLinkFeedback(null), 4000)
  }



  async function removePubGen(item: PublicGenerationItem) {
    if (!isApi || !token) return
    setGenBusyId(item.id)
    try {
      const r = await deletePublicGeneration(token, item.id)
      mergeUser(r.user)
    } catch {
      /* toast optional */
    } finally {
      setGenBusyId(null)
    }
  }

  function repeatFromPublic() {
    if (!openedPubItem) return
    const mode =
      openedPubItem.mode === 'video' || openedPubItem.mode === 'audio' || openedPubItem.mode === 'music'
        ? openedPubItem.mode
        : 'photo'
    const prompt = (openedPubItem.promptFull?.trim() || openedPubItem.promptPreview || '').trim()
    saveCreateDraft({
      v: 1,
      mode,
      modelId: openedPubItem.modelId || 'kie-gpt-image-2',
      prompt,
      aspect: openedPubItem.aspect ?? '1:1',
      quality: openedPubItem.quality ?? 'std',
      duration: openedPubItem.mode === 'video' ? (openedPubItem.duration ?? '5') : '5',
      publishPublic: false,
      attachments: [],
    })
    setOpenedPubId(null)
    navigate('/create')
  }

  if (supportOpen) {
    return (
      <div className="flex min-h-0 flex-1 flex-col h-full w-full">
        <TechSupport
          onBack={() => {
            setSupportOpen(false)
            requestAnimationFrame(() => {
              const el = document.getElementById('main-scroll')
              if (el) el.scrollTop = savedScrollRef.current
            })
          }}
        />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">Нет данных</div>
    )
  }

  const name = profileDisplayName(user)
  const handle = displayHandle(user)
  const avatarResolved =
    user.avatarUrl?.trim() ? resolveAvatarUrl(user.avatarUrl.trim()) ?? user.avatarUrl.trim() : null
  const ledger = user.ledger ?? []
  const publicGens = publicCards
  const stats = user.generationStats ?? { total: 0, publicCount: publicGens.length }
  const likes = user.profileLikesCount ?? 0

  return (
    <div className="w-full max-w-lg lg:max-w-3xl xl:max-w-4xl mx-auto pb-10 pt-5">
      <div className="relative rounded-3xl border border-slate-200/80 dark:border-slate-700/80 bg-surface shadow-sm">
        <div className="h-32 sm:h-36 rounded-t-3xl bg-gradient-to-br from-[var(--color-brand)] via-[var(--color-brand-dark)] to-[var(--color-brand-dark)] dark:from-[var(--color-brand)] dark:via-[var(--color-brand-dark)] dark:to-[var(--color-base)]" />
        <div className="relative z-10 px-4 pb-5 -mt-14 flex flex-col items-center">
          <div className="relative z-10">
            <div className="w-28 h-28 rounded-full border-4 border-[var(--color-body)] bg-surface shadow-xl overflow-hidden flex items-center justify-center ring-1 ring-black/5 dark:ring-white/10">
              {avatarResolved ? (
                <img
                  src={avatarResolved}
                  alt=""
                  referrerPolicy={avatarReferrerPolicy(avatarResolved)}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-[var(--color-brand)] dark:text-[var(--color-brand)]">
                  {initials(name)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={openEdit}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[var(--color-brand)] text-[var(--color-on-brand)] shadow-md flex items-center justify-center text-sm hover:brightness-110 active:scale-95 transition-transform"
              aria-label="Редактировать профиль"
            >
              ✎
            </button>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 max-w-full px-2">
            <h1 className="text-xl sm:text-2xl font-bold text-center text-slate-900 dark:text-white truncate">
              {name}
            </h1>
          </div>

          {handle ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{handle}</p>
          ) : null}

          {user.bio ? (
            <p className="mt-2 text-sm text-center text-slate-600 dark:text-slate-300 max-w-md leading-relaxed">
              {user.bio}
            </p>
          ) : null}

          {activeSocials.length > 0 ? (
            <div className="relative z-20 mt-4 flex touch-manipulation flex-wrap justify-center gap-2">
              {activeSocials.map(({ key }) => {
                const href = user[key] as string
                return (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onExternalAnchorClick}
                    className="box-border flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-[var(--color-body)] text-slate-700 transition-colors hover:border-[var(--color-brand)]/40 active:scale-[0.98] dark:border-slate-600 dark:text-slate-200"
                    aria-label={SOCIAL_DEFS.find((s) => s.key === key)?.label}
                  >
                    <ProfileSocialIcon kind={key} className="h-5 w-5" />
                  </a>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-1 sm:px-0 mt-5 space-y-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Баланс
            </p>
            <p className="text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 dark:text-white mt-0.5 flex items-center gap-2">
              <span>{user.creditsBalance}</span>
              <CreditCoin className="w-8 h-8 sm:w-9 sm:h-9" />
            </p>
          </div>
          {isApi ? (
            <button
              type="button"
              onClick={() => setTopUpOpen(true)}
              className="shrink-0 rounded-2xl px-5 py-3 text-sm font-semibold text-[var(--color-on-brand)] bg-[var(--color-brand)] hover:brightness-110 shadow-md shadow-[var(--color-brand)]/25 active:scale-[0.98] transition-all"
            >
              Пополнить
            </button>
          ) : (
            <span className="text-xs text-amber-700 dark:text-amber-400">Войдите для баланса</span>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-[var(--color-body)]/60 dark:bg-slate-900/40 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex flex-nowrap items-center justify-center gap-5 sm:gap-10">
            <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
              <p className="text-base sm:text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {stats.total}
              </p>
              <p className="text-[9px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Всего генераций
              </p>
            </div>
            <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
              <p className="text-base sm:text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                {stats.publicCount}
              </p>
              <p className="text-[9px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                В открытом доступе
              </p>
            </div>
            <div className="flex min-w-0 flex-col items-center justify-center gap-0.5 text-center">
              <div className="flex items-center justify-center gap-1 text-rose-600 dark:text-rose-400">
                <svg
                  className="h-4 w-4 shrink-0 sm:h-5 sm:w-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <span className="text-base sm:text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                  {likes.toLocaleString('ru-RU')}
                </span>
              </div>
              <p className="text-[9px] sm:text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Лайки
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-[var(--color-brand)]" />
            Публичные генерации
          </h2>
          {publicGens.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-600 py-10 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
              Пока нет публичных работ. Создайте генерацию и отметьте публикацию в профиле.
            </div>
          ) : (
            <ul className="columns-2 md:columns-3 gap-3 [column-fill:_balance] space-y-3">
              {publicGens.map((g) => (
                <li
                  key={g.id}
                  className="break-inside-avoid overflow-hidden rounded-2xl bg-[var(--color-media-chrome-bg)] shadow-md"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenedPubId(g.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setOpenedPubId(g.id)
                      }
                    }}
                    className="group relative block w-full overflow-hidden text-left"
                  >
                    {g.mode === 'photo' && g.resultUrl ? (
                      <img
                        src={g.resultUrl}
                        alt={g.modelLabel}
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        className="block w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        style={{ aspectRatio: String(aspectToRatio(g.aspect ?? null)) }}
                      />
                    ) : g.mode === 'video' && g.resultUrl ? (
                      <video
                        src={g.resultUrl}
                        className="block w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        onCanPlay={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                      />
                    ) : g.mode === 'music' && g.resultUrl ? (
                      <div className="relative w-full aspect-square overflow-hidden bg-[var(--color-media-chrome-bg)]">
                        <MusicCardCover />
                        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                        <div className="absolute inset-x-0 bottom-9 z-[3] space-y-0.5 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-2.5 pb-1 pt-6 text-left">
                          <p className="truncate text-[11px] font-semibold text-white">
                            {g.musicTitle?.trim() || g.modelLabel}
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[10px] text-white/80">
                              {new Date(g.createdAt).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                            <button
                              type="button"
                              disabled={!isApi || likeBusyId === g.id}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                void likePubGen(g)
                              }}
                              className="pointer-events-auto inline-flex items-center gap-2 text-[13px] font-semibold text-white/95 tabular-nums disabled:opacity-70"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden
                                className={`h-5 w-5 shrink-0 ${g.likedByMe ? 'text-rose-400' : 'text-rose-300'}`}
                              >
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                              </svg>
                              <span>{g.likes.toLocaleString('ru-RU')}</span>
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">Музыка</span>
                            {isApi ? (
                              <button
                                type="button"
                                disabled={genBusyId === g.id}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  void removePubGen(g)
                                }}
                                className="text-[11px] font-semibold text-red-200 hover:text-red-100 disabled:opacity-50"
                              >
                                Скрыть
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <audio
                          src={g.resultUrl}
                          controls
                          preload="metadata"
                          className="absolute bottom-0 left-0 right-0 z-[4] h-9 w-full border-0 bg-black/55 px-1 [filter:none]"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ) : (
                      <div className="flex min-h-[9rem] w-full items-center justify-center bg-slate-900/15 px-3 py-6 text-center">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {modeLabel(g.mode)} · {g.modelLabel}
                        </span>
                      </div>
                    )}
                    {g.mode === 'music' && g.resultUrl ? null : (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-2.5 pb-2 pt-8">
                        <p className="truncate text-[11px] font-semibold text-white">{g.modelLabel}</p>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-[10px] text-white/80">
                            {new Date(g.createdAt).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                          <button
                            type="button"
                            disabled={!isApi || likeBusyId === g.id}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              void likePubGen(g)
                            }}
                            className="pointer-events-auto inline-flex items-center gap-2 text-[13px] font-semibold text-white/95 tabular-nums disabled:opacity-70"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden
                              className={`h-5 w-5 shrink-0 ${g.likedByMe ? 'text-rose-400' : 'text-rose-300'}`}
                            >
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                            <span>{g.likes.toLocaleString('ru-RU')}</span>
                          </button>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">
                            {modeLabel(g.mode)}
                          </span>
                          {isApi ? (
                            <button
                              type="button"
                              disabled={genBusyId === g.id}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                void removePubGen(g)
                              }}
                              className="pointer-events-auto text-[11px] font-semibold text-red-200 hover:text-red-100 disabled:opacity-50"
                            >
                              Скрыть
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {openedPubItem ? (
          <div
            className="fixed inset-0 z-[65] flex items-end justify-center bg-black/70 animate-[fadeIn_.18s_ease-out] modal-backdrop-safe-tg sm:items-center sm:px-3"
            role="dialog"
            aria-modal="true"
            aria-label="Просмотр публичной генерации"
            onClick={() => setOpenedPubId(null)}
          >
            <div
              className="generation-detail-sheet flex max-h-[min(96dvh,100vh)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-surface shadow-2xl animate-[slideUp_.22s_cubic-bezier(.2,.8,.2,1)] dark:border-slate-600 sm:max-h-[min(90dvh,900px)] sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative flex shrink-0 items-start justify-between gap-2 border-b border-slate-200 py-2.5 pl-3 pr-2 dark:border-slate-700">
                <div className="min-w-0 flex-1 pr-10">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {formatGenerationDate(openedPubItem.createdAt)}
                  </p>
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {openedPubItem.mode === 'music' && openedPubItem.musicTitle?.trim()
                      ? openedPubItem.musicTitle.trim()
                      : openedPubItem.modelLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenedPubId(null)}
                  className="modal-detail-close absolute flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                  aria-label="Закрыть"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
                <div className="relative flex min-h-[min(32vh,220px)] max-h-[min(45vh,320px)] shrink-0 items-center justify-center bg-[var(--color-media-chrome-bg)] p-2 sm:max-h-none sm:min-h-[min(320px,52vh)] sm:w-[min(46%,420px)] sm:flex-none overflow-hidden">
                  {openedPubItem.mode === 'photo' && openedPubItem.resultUrl ? (
                    <img
                      src={openedPubItem.resultUrl}
                      alt=""
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-55"
                      draggable={false}
                    />
                  ) : openedPubItem.mode === 'video' && openedPubItem.resultUrl ? (
                    <video
                      src={openedPubItem.resultUrl}
                      className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-55 pointer-events-none"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : null}
                  {openedPubItem.mode === 'photo' && openedPubItem.resultUrl ? (
                    <img
                      src={openedPubItem.resultUrl}
                      alt=""
                      loading="eager"
                      decoding="async"
                      fetchPriority="high"
                      className="relative z-[1] max-h-[min(42vh,300px)] max-w-full object-contain select-none sm:max-h-[min(72vh,640px)]"
                      draggable={false}
                    />
                  ) : openedPubItem.mode === 'video' && openedPubItem.resultUrl ? (
                    <video
                      src={openedPubItem.resultUrl}
                      autoPlay
                      loop
                      controls
                      playsInline
                      preload="metadata"
                      className="relative z-[1] max-h-[min(42vh,300px)] max-w-full object-contain sm:max-h-[min(72vh,640px)]"
                    />
                  ) : openedPubItem.mode === 'music' && openedPubItem.resultUrl ? (
                    <div className="relative z-[1] flex h-full min-h-[200px] w-full min-w-0 max-w-md flex-col justify-end">
                      <MusicCardCover className="absolute inset-0" />
                      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                      <div className="relative z-[2] w-full p-3 pb-2">
                        <p className="text-center text-sm font-bold text-white drop-shadow-md line-clamp-2">
                          {openedPubItem.musicTitle?.trim() || openedPubItem.modelLabel}
                        </p>
                      </div>
                      <audio
                        src={openedPubItem.resultUrl}
                        controls
                        preload="metadata"
                        className="relative z-[2] w-full border-0 bg-black/40 px-2 pb-2 [filter:none]"
                      />
                    </div>
                  ) : (
                    <p className="px-3 text-center text-sm text-white/70">Превью недоступно для этого типа.</p>
                  )}
                  {openedPubItem.resultUrl?.trim() ? (
                    <MediaDownloadButton
                      url={openedPubItem.resultUrl}
                      mode={openedPubItem.mode}
                      id={openedPubItem.id}
                      label={openedPubItem.musicTitle?.trim() || openedPubItem.modelLabel}
                    />
                  ) : null}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  <GenerationDetailStatsDl
                    modelLabel={openedPubItem.modelLabel || '—'}
                    aspect={openedPubItem.aspect}
                    quality={openedPubItem.quality}
                    modelId={openedPubItem.modelId}
                    mode={openedPubItem.mode}
                    duration={openedPubItem.duration}
                    cost={generationsLogById.get(openedPubItem.id)?.cost ?? null}
                    showSocial
                    authorTag={user?.publicTag}
                    authorName={user?.displayName ?? user?.publicTag}
                    authorAvatarUrl={user?.avatarUrl}
                    likes={openedPubItem.likes}
                    likedByMe={Boolean(openedPubItem.likedByMe)}
                    likeDisabled={!isApi}
                    likeBusy={likeBusyId === openedPubItem.id}
                    onLike={() => void likePubGen(openedPubItem)}
                  />
                  <div className="mt-3">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Промпт</p>
                    <textarea
                      readOnly
                      rows={7}
                      value={openedPubItem.promptFull}
                      className="min-h-[7.5rem] w-full resize-none rounded-xl border border-slate-200 dark:border-slate-600 bg-surface text-slate-900 dark:text-slate-100 text-xs leading-relaxed px-3 py-2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={repeatFromPublic}
                    className="mt-3 h-11 w-full rounded-xl bg-[var(--color-brand)] text-[var(--color-on-brand)] px-4 text-sm font-semibold shadow-sm transition hover:bg-[var(--color-brand-dark)] active:opacity-80 sm:w-auto"
                  >
                    Повторить
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {ledger.length > 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
              История операций
            </h3>
            <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {ledger.slice(0, 40).map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-700/80 bg-[var(--color-body)]/50 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-800 dark:text-slate-100 font-medium truncate">{e.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {ledgerKindLabel(e.kind)} ·{' '}
                      {new Date(e.at).toLocaleString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-semibold tabular-nums ${e.delta >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                      }`}
                  >
                    {e.delta >= 0 ? '+' : ''}
                    {e.delta}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {profileShareUrlLive && profilePublicRoute ? (
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-600/80 bg-gradient-to-b from-surface to-slate-50/40 dark:from-surface dark:to-slate-900/30 p-4 sm:p-5 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/40">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand)]/12 text-[var(--color-brand)] dark:bg-[var(--color-brand)]/20" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Ссылка на профиль</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Одна страница для гостей{handle ? ` (${handle})` : ''}. Ниже — адрес сайта; «Поделиться» при настройке бота отдаёт ссылку на мини-приложение в Telegram.
                </p>
              </div>
            </div>

            <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Адрес в браузере
            </label>
            <input
              ref={profileLinkInputRef}
              readOnly
              value={profileShareUrlLive}
              onFocus={(e) => e.target.select()}
              className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white/90 dark:bg-slate-950/50 px-3 py-2.5 text-xs sm:text-sm font-mono text-slate-800 dark:text-slate-100 shadow-inner outline-none ring-0 focus:border-[var(--color-brand)]/50 focus:ring-2 focus:ring-[var(--color-brand)]/20"
              spellCheck={false}
              autoComplete="off"
            />
            {profileTelegramMiniUrl ? (
              <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 leading-snug">
                Для открытия в клиенте Telegram задайте в сборке{' '}
                <span className="font-mono text-[10px]">VITE_TELEGRAM_BOT_USERNAME</span> и{' '}
                <span className="font-mono text-[10px]">VITE_TELEGRAM_WEBAPP_SHORT_NAME</span>.
              </p>
            ) : null}

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void copyProfileLink()}
                className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--color-on-brand)] bg-[var(--color-brand)] hover:brightness-110 shadow-md shadow-[var(--color-brand)]/20 active:scale-[0.98] transition-all min-h-[44px]"
              >
                Копировать
              </button>
              <button
                type="button"
                onClick={() => void shareProfile()}
                className="rounded-xl px-3 py-2.5 text-sm font-semibold border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 bg-[var(--color-body)]/90 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.98] transition-all min-h-[44px]"
              >
                Поделиться
              </button>
            </div>

            <div className="mt-3 flex justify-center">
              <Link
                to={profilePublicRoute}
                className="text-sm font-medium text-[var(--color-brand)] hover:underline underline-offset-2"
              >
                Открыть предпросмотр
              </Link>
            </div>

            {profileLinkFeedback ? (
              <p
                className={`text-xs font-medium mt-3 text-center ${profileLinkFeedback.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}
                role="status"
              >
                {profileLinkFeedback.text}
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => { savedScrollRef.current = document.getElementById('main-scroll')?.scrollTop ?? 0; setSupportOpen(true) }}
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface py-3 px-4 text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-between"
        >
          <span className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--color-brand)]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Техподдержка
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => navigate('/partner')}
          className="w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-black p-0 shadow-sm hover:opacity-95 active:opacity-90 dark:hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          aria-label="Партнёрская программа"
        >
          <img
            src="/partners.jpg"
            alt="NEIRON Partners Program"
            className="w-full h-[6.5rem] sm:h-[7.25rem] object-cover object-center block"
            decoding="async"
            loading="lazy"
          />
        </button>

        <button
          type="button"
          className="lg:hidden w-full rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface py-3 px-4 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 active:scale-[0.99] transition-all mt-3"
          onClick={() => {
            clearAuth()
            navigate('/explore', { replace: true })
          }}
        >
          Выйти
        </button>
      </div>

      {topUpOpen && token ? (
        <TopUpModal
          token={token}
          onClose={closeTopUp}
          onSuccess={(updatedUser) => mergeUser(updatedUser)}
        />
      ) : null}

      {editOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-backdrop-safe-tg bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-edit-title"
        >
          <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-surface shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="sticky top-0 bg-surface border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
              <h2 id="profile-edit-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                Профиль
              </h2>
              <button
                type="button"
                onClick={closeEdit}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              {formErr ? (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{formErr}</p>
              ) : null}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Имя в профиле
                </label>
                <input
                  value={draftDisplayName}
                  onChange={(e) => setDraftDisplayName(e.target.value)}
                  placeholder="Как вас видят другие"
                  maxLength={80}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Фото профиля
                </span>
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-20 h-20 rounded-full border border-slate-200 dark:border-slate-600 overflow-hidden bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-lg font-semibold text-slate-600 dark:text-slate-300">
                    {user
                      ? (() => {
                        const src = avatarMarkRemove
                          ? null
                          : (avatarBlobUrl || user.avatarUrl?.trim() || null)
                        return src ? (
                          <img
                            src={src.startsWith('data:') || src.startsWith('blob:') ? src : (resolveAvatarUrl(src) ?? src)}
                            alt=""
                            referrerPolicy={
                              src.startsWith('data:') || src.startsWith('blob:')
                                ? undefined
                                : avatarReferrerPolicy(resolveAvatarUrl(src) ?? src)
                            }
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{initials((draftDisplayName || profileDisplayName(user)).trim() || '?')}</span>
                        )
                      })()
                      : null}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <input
                      ref={avatarFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        e.currentTarget.value = ''
                        if (!f) return
                        if (!/^image\/(jpeg|png|webp)$/i.test(f.type)) {
                          setFormErr('Фото: формат JPEG, PNG или WebP')
                          return
                        }
                        if (f.size > 2.5 * 1024 * 1024) {
                          setFormErr('Фото: не больше 2,5 МБ')
                          return
                        }
                        setFormErr(null)
                        void (async () => {
                          try {
                            const dataUrl = await shrinkImageFileToJpegDataUrl(f, {
                              maxSide: 1280,
                              quality: 0.86,
                            })
                            const approximatePayloadChars =
                              typeof dataUrl === 'string' ? Math.ceil(dataUrl.length * 0.75) : 0
                            if (approximatePayloadChars > 2 * 1024 * 1024) {
                              setFormErr('После сжатия фото всё ещё слишком большое — возьмите снимок с меньшим разрешением.')
                              return
                            }
                            if (avatarBlobUrl) URL.revokeObjectURL(avatarBlobUrl)
                            setAvatarBlobUrl(URL.createObjectURL(f))
                            setAvatarPendingDataUrl(dataUrl)
                            setAvatarMarkRemove(false)
                          } catch {
                            setFormErr('Не удалось подготовить фото к отправке')
                          }
                        })()
                      }}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => avatarFileInputRef.current?.click()}
                        className="rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm text-slate-900 dark:text-white"
                      >
                        Выбрать фото
                      </button>
                      {(user?.avatarUrl?.trim() || avatarBlobUrl) && !avatarMarkRemove ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (avatarBlobUrl) URL.revokeObjectURL(avatarBlobUrl)
                            setAvatarBlobUrl(null)
                            setAvatarPendingDataUrl(null)
                            setAvatarMarkRemove(true)
                          }}
                          className="rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                        >
                          Убрать фото
                        </button>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">JPEG, PNG или WebP, до 2,5 МБ</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Публичный тег (3–24, a-z, цифры, _)
                </label>
                <input
                  value={draftTag}
                  onChange={(e) => setDraftTag(e.target.value)}
                  placeholder="my_nick"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm text-slate-900 dark:text-white"
                />
                <p className="text-xs text-slate-500 mt-1">
                  После смены тега повторно его можно задать не раньше чем через неделю.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">О себе</label>
                <textarea
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm text-slate-900 dark:text-white resize-none"
                />
              </div>
              {SOCIAL_DEFS.map(({ key, label, hint }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-2">
                    <ProfileSocialIcon kind={key} />
                    {label}
                  </label>
                  <input
                    value={draftUrls[key] ?? ''}
                    onChange={(e) => setDraftUrls((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder={hint}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm text-slate-900 dark:text-white"
                  />
                </div>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveProfile()}
                className="w-full rounded-2xl bg-[var(--color-brand)] hover:brightness-110 disabled:opacity-60 text-[var(--color-on-brand)] font-medium py-3"
              >
                {busy ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

