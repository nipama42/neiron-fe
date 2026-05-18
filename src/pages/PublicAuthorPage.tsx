import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import UserTemplateCard from '../components/ui/UserTemplateCard'
import MediaDownloadButton from '../components/ui/MediaDownloadButton'
import MusicCardCover from '../components/ui/MusicCardCover'
import GenerationDetailStatsDl from '../components/generation/GenerationDetailStatsDl'
import {
  getPublicFeed,
  getPublicAuthorProfile,
  likePublicGeneration,
  unlikePublicGeneration,
  type PublicAuthorProfile,
  type PublicFeedItem,
} from '../api/explore'
import { useAuth } from '../store/authStore'
import { saveCreateDraft } from '../lib/createDraftStorage'
import { ProfileSocialIcon, type ProfileSocialKey } from '../components/ui/ProfileSocialIcon'
import { onExternalAnchorClick } from '../lib/openExternalUrl'
import { avatarReferrerPolicy, resolveAvatarUrl } from '../lib/resolveAvatarUrl'
import { usePageSeo } from '../lib/seo'
function normalize(v: string | null | undefined): string {
  return String(v ?? '').trim().toLowerCase()
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

const SOCIAL_DEFS: { key: ProfileSocialKey; label: string }[] = [
  { key: 'telegramUrl', label: 'Telegram' },
  { key: 'instagramUrl', label: 'Instagram' },
]

function displayMediaUrl(item: PublicFeedItem): string | null {
  const next = item.resultDisplayUrl?.trim()
  if (next) return next
  const legacy = item.resultUrl?.trim()
  return legacy || null
}

function mainMediaUrl(item: PublicFeedItem): string | null {
  const next = item.resultMainUrl?.trim()
  if (next) return next
  const legacy = item.resultUrl?.trim()
  return legacy || null
}

export default function PublicAuthorPage() {
  const { authorRef = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { token, mergeUser } = useAuth()
  const [profile, setProfile] = useState<PublicAuthorProfile | null>(null)
  const [authorItems, setAuthorItems] = useState<PublicFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null)
  const [likeToast, setLikeToast] = useState<string | null>(null)

  const state = location.state as {
    authorId?: string | null
    authorTag?: string | null
    authorName?: string | null
    initialItem?: PublicFeedItem | null
  } | null
  const fallbackGenerationId = useMemo(() => {
    const queryGid = new URLSearchParams(location.search).get('gid')
    if (queryGid && queryGid.trim()) return queryGid.trim()
    return String(state?.initialItem?.id ?? '').trim()
  }, [location.search, state?.initialItem?.id])
  const refRaw = decodeURIComponent(authorRef)
  const refTagFromPath = useMemo(() => {
    const raw = refRaw.trim()
    if (!raw.startsWith('@')) return ''
    return normalize(raw)
  }, [refRaw])
  const refNameFromPath = useMemo(() => {
    const raw = refRaw.trim()
    if (!raw || raw.startsWith('@')) return ''
    return normalize(raw)
  }, [refRaw])
  const profileRef = useMemo(() => {
    const stateAuthorId = String(state?.authorId ?? '').trim()
    if (stateAuthorId) return stateAuthorId
    const stateTag = normalize(state?.authorTag).replace(/^@/, '')
    if (stateTag) return stateTag
    return refRaw
  }, [refRaw, state?.authorId, state?.authorTag])

  function mergeUniqueById(items: PublicFeedItem[]): PublicFeedItem[] {
    const byId = new Map<string, PublicFeedItem>()
    for (const item of items) byId.set(item.id, item)
    return [...byId.values()].sort((a, b) => {
      if (a.likes !== b.likes) return b.likes - a.likes
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }

  function filterByAuthorIdentity(
    feed: PublicFeedItem[],
    identity: { id?: string; tag?: string; name?: string }
  ): PublicFeedItem[] {
    const sourceId = String(identity.id ?? '').trim()
    const sourceTag = normalize(identity.tag)
    const sourceName = normalize(identity.name)
    return feed.filter((x) => {
      if (sourceId && x.authorId) return x.authorId === sourceId
      const tagOk = sourceTag ? normalize(x.authorTag) === sourceTag : false
      const nameOk = sourceName ? normalize(x.authorName) === sourceName : false
      return tagOk || nameOk
    })
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const out = await getPublicAuthorProfile(profileRef, {
          fallbackGenerationId: fallbackGenerationId || null,
        })
        if (!cancelled) {
          setProfile(out.profile)
          const initial = state?.initialItem
          const fallbackFeed = await getPublicFeed(300)
          let merged = out.items
          if (initial && !merged.some((x) => x.id === initial.id)) {
            merged = [initial, ...merged]
          }
          const extra = filterByAuthorIdentity(fallbackFeed, {
            id: initial?.authorId ?? out.profile.id,
            tag: initial?.authorTag ?? out.profile.authorTag ?? state?.authorTag ?? refTagFromPath,
            name: initial?.authorName ?? out.profile.authorName ?? state?.authorName ?? refNameFromPath,
          })
          setAuthorItems(mergeUniqueById([...merged, ...extra]))
        }
      } catch {
        if (!cancelled) {
          setProfile(null)
          const initial = state?.initialItem
          let fallbackItems = initial ? [initial] : []
          try {
            const fallbackFeed = await getPublicFeed(300)
            const extra = filterByAuthorIdentity(fallbackFeed, {
              id: initial?.authorId ?? '',
              tag: initial?.authorTag ?? state?.authorTag ?? refTagFromPath,
              name: initial?.authorName ?? state?.authorName ?? refNameFromPath,
            })
            fallbackItems = mergeUniqueById([...(initial ? [initial] : []), ...extra])
          } catch {
            // Keep at least initial card item visible.
          }
          setAuthorItems(fallbackItems)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profileRef, fallbackGenerationId, state?.initialItem])

  useEffect(() => {
    if (!likeToast) return
    const id = window.setTimeout(() => setLikeToast(null), 2600)
    return () => window.clearTimeout(id)
  }, [likeToast])

  const openedItem = useMemo(
    () => authorItems.find((item) => item.id === openedId) ?? null,
    [authorItems, openedId]
  )
  const openedVideoPoster = openedItem?.media?.video?.previewUrl?.trim() || ''

  const authorTitle = useMemo(() => {
    if (profile?.authorTag) return profile.authorTag
    if (profile?.authorName) return profile.authorName
    return state?.authorName ?? 'Профиль автора'
  }, [profile, state?.authorName])

  const authorCanonicalPath = `/profile/author/${encodeURIComponent(authorRef)}`

  usePageSeo({
    title: `${authorTitle} — NEIRON`,
    description: `Публичный профиль ${authorTitle} на NEIRON: работы с ИИ в ленте автора.`,
    canonicalPath: authorCanonicalPath,
  })

  const authorSubtitle = useMemo(() => {
    if (profile?.authorTag && profile?.authorName) return profile.authorName
    return ''
  }, [profile])

  const authorNameForAvatar = useMemo(() => {
    if (profile?.displayName) return profile.displayName
    if (profile?.authorName) return profile.authorName
    return state?.authorName ?? ''
  }, [profile, state?.authorName])

  /** Пока грузится API или пусто в профиле — картинка с карточки ленты */
  const displayAvatarUrl = useMemo(() => {
    const fromProfile = profile?.avatarUrl?.trim()
    if (fromProfile) return fromProfile
    const fromFeed = state?.initialItem?.authorAvatarUrl
    if (fromFeed && String(fromFeed).trim()) return String(fromFeed).trim()
    return ''
  }, [profile?.avatarUrl, state?.initialItem?.authorAvatarUrl])

  const activeSocials = useMemo(() => {
    if (!profile) return []
    return SOCIAL_DEFS.filter((d) => {
      const value = profile[d.key]
      return Boolean(value && String(value).trim())
    })
  }, [profile])

  /** Счётчик лайков: с бэка; если ещё не пришёл — сумма по карточкам (без Math.max — не дублировать одну цифру в двух смыслах). */
  const profileLikesUi = useMemo(() => {
    const fromProfile = Number(profile?.profileLikesCount)
    if (Number.isFinite(fromProfile) && fromProfile >= 0) return fromProfile
    return authorItems.reduce((sum, item) => sum + (Number(item.likes) || 0), 0)
  }, [profile?.profileLikesCount, authorItems])

  async function onLike(id: string) {
    if (!token) return
    const cur = authorItems.find((x) => x.id === id)
    if (!cur) return
    setLikeBusyId(id)
    if (cur.likedByMe) {
      setAuthorItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, likedByMe: false, likes: Math.max(0, x.likes - 1) } : x))
      )
      try {
        const r = await unlikePublicGeneration(token, id)
        mergeUser(r.user)
        const refreshed = await getPublicAuthorProfile(profileRef, {
          fallbackGenerationId: fallbackGenerationId || null,
        })
        setProfile(refreshed.profile)
      } catch {
        setAuthorItems((prev) =>
          prev.map((x) => (x.id === id ? { ...x, likedByMe: true, likes: x.likes + 1 } : x))
        )
        setLikeToast('Не удалось снять лайк.')
      }
    } else {
      setAuthorItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, likedByMe: true, likes: x.likes + 1 } : x))
      )
      try {
        const r = await likePublicGeneration(token, id)
        mergeUser(r.user)
        const refreshed = await getPublicAuthorProfile(profileRef, {
          fallbackGenerationId: fallbackGenerationId || null,
        })
        setProfile(refreshed.profile)
      } catch {
        setAuthorItems((prev) =>
          prev.map((x) => (x.id === id ? { ...x, likedByMe: false, likes: Math.max(0, x.likes - 1) } : x))
        )
        setLikeToast('Не удалось поставить лайк, попробуйте еще раз.')
      }
    }
    setLikeBusyId(null)
  }

  function onRepeat(item: PublicFeedItem) {
    const mode = item.mode === 'video' || item.mode === 'audio' || item.mode === 'music' ? item.mode : 'photo'
    const prompt = (item.prompt?.trim() || item.promptPreview || '').trim()
    saveCreateDraft({
      v: 1,
      mode,
      modelId: item.modelId || 'kie-gpt-image-2',
      prompt,
      aspect: item.aspect ?? '1:1',
      quality: item.quality ?? 'std',
      duration: mode === 'video' ? (item.duration ?? '5') : '5',
      publishPublic: false,
      attachments: [],
    })
    navigate('/create')
  }

  useEffect(() => {
    if (!openedId) return
    const exists = authorItems.some((x) => x.id === openedId)
    if (!exists) setOpenedId(null)
  }, [openedId, authorItems])

  useEffect(() => {
    if (!openedId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openedId])

  useEffect(() => {
    if (!openedId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [openedId])

  return (
    <div className="w-full max-w-lg lg:max-w-3xl xl:max-w-4xl mx-auto pb-10 pt-5">
      <div className="px-1 sm:px-0">
        {likeToast ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300">
            {likeToast}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <span aria-hidden>←</span>
          Назад
        </button>
      </div>

      <div className="relative rounded-3xl border border-slate-200/80 dark:border-slate-700/80 bg-surface shadow-sm">
        <div className="h-32 sm:h-36 bg-gradient-to-br from-[var(--color-brand)] via-[var(--color-brand-dark)] to-[var(--color-brand-dark)] dark:from-[var(--color-brand)] dark:via-[var(--color-brand-dark)] dark:to-[var(--color-base)] rounded-t-3xl" />
        <div className="relative z-10 px-4 pb-5 -mt-14 flex flex-col items-center">
          <div className="relative z-10">
            <div className="w-28 h-28 rounded-full border-4 border-[var(--color-body)] bg-surface shadow-xl overflow-hidden flex items-center justify-center ring-1 ring-black/5 dark:ring-white/10">
              {displayAvatarUrl ? (
                <img
                  key={displayAvatarUrl}
                  src={resolveAvatarUrl(displayAvatarUrl) ?? displayAvatarUrl}
                  alt=""
                  referrerPolicy={avatarReferrerPolicy(resolveAvatarUrl(displayAvatarUrl) ?? displayAvatarUrl)}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-[var(--color-brand)] dark:text-[var(--color-brand)]">
                  {initialsFromName(authorNameForAvatar)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 max-w-full">
            <h1 className="text-xl sm:text-2xl font-bold text-center text-slate-900 dark:text-white truncate">
              {authorTitle}
            </h1>
          </div>
          {authorSubtitle ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{authorSubtitle}</p>
          ) : null}

          {profile?.bio ? (
            <p className="mt-2 text-sm text-center text-slate-600 dark:text-slate-300 max-w-md leading-relaxed">
              {profile.bio}
            </p>
          ) : null}

          {activeSocials.length > 0 ? (
            <div className="relative z-20 mt-4 flex touch-manipulation flex-wrap justify-center gap-2">
              {activeSocials.map(({ key, label }) => (
                <a
                  key={key}
                  href={String(profile?.[key] ?? '#')}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onExternalAnchorClick}
                  className="box-border flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-xl border border-slate-200 bg-[var(--color-body)] text-slate-700 transition-colors hover:border-[var(--color-brand)]/40 active:scale-[0.98] dark:border-slate-600 dark:text-slate-200"
                  aria-label={label}
                  title={label}
                >
                  <ProfileSocialIcon kind={key} className="h-5 w-5" />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-1 sm:px-0 mt-5 space-y-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface p-4 shadow-sm grid grid-cols-2 gap-4 sm:gap-6 items-stretch">
          <div className="min-w-0 flex flex-col items-center justify-center text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Работ
            </p>
            <p className="text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 dark:text-white mt-0.5 leading-none">
              {(profile?.worksCount ?? authorItems.length).toLocaleString('ru-RU')}
            </p>
          </div>
          <div className="min-w-0 flex flex-col items-center justify-center text-center border-l border-slate-200 dark:border-slate-600 pl-4 sm:pl-6">
            <div
              className="flex items-center justify-center gap-1.5 text-rose-600 dark:text-rose-400 leading-none"
              aria-label={`Лайки на профиле: ${profileLikesUi.toLocaleString('ru-RU')}`}
            >
              <svg
                className="w-7 h-7 sm:w-8 sm:h-8 shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span className="text-2xl sm:text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                {profileLikesUi.toLocaleString('ru-RU')}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">Загружаем работы автора…</p>
        ) : authorItems.length > 0 ? (
          <div className="columns-2 md:columns-3 gap-3 [column-fill:_balance] space-y-3">
            {authorItems.map((item, index) => (
              <div key={item.id} className="break-inside-avoid">
                <UserTemplateCard
                  item={item}
                  mediaPriority={index < 10}
                  onLike={onLike}
                  onOpen={setOpenedId}
                  likeBusy={likeBusyId === item.id}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
            У этого автора пока нет доступных публичных работ
          </p>
        )}
      </div>

      {openedItem ? (
        <div
          className="fixed inset-0 z-[65] flex items-end justify-center bg-black/70 modal-backdrop-safe-tg animate-[fadeIn_.18s_ease-out] sm:items-center sm:px-3"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр публикации автора"
          onClick={() => setOpenedId(null)}
        >
          <div
            className="generation-detail-sheet flex max-h-[min(96dvh,100vh)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-surface shadow-2xl animate-[slideUp_.22s_cubic-bezier(.2,.8,.2,1)] dark:border-slate-600 sm:max-h-[min(90dvh,900px)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex shrink-0 items-start justify-between gap-2 border-b border-slate-200 py-2.5 pl-3 pr-2 dark:border-slate-700">
              <div className="min-w-0 flex-1 pr-10">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {new Date(openedItem.createdAt).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {openedItem.mode === 'music' && openedItem.musicTitle?.trim()
                    ? openedItem.musicTitle.trim()
                    : openedItem.modelLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenedId(null)}
                className="modal-detail-close absolute right-1.5 top-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Закрыть"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
              <div className="relative flex min-h-[min(32vh,220px)] max-h-[min(45vh,320px)] shrink-0 items-center justify-center bg-zinc-950 p-2 sm:max-h-none sm:min-h-[min(320px,52vh)] sm:w-[min(46%,420px)] sm:flex-none overflow-hidden">
                {openedItem.mode === 'photo' && displayMediaUrl(openedItem) ? (
                  <img
                    src={displayMediaUrl(openedItem) ?? undefined}
                    alt=""
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-55"
                    draggable={false}
                  />
                ) : openedItem.mode === 'video' && openedVideoPoster ? (
                  <img
                    src={openedVideoPoster}
                    alt=""
                    aria-hidden
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-55 pointer-events-none"
                    draggable={false}
                  />
                ) : openedItem.mode === 'video' && displayMediaUrl(openedItem) ? (
                  <div
                    className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black opacity-90 pointer-events-none"
                    aria-hidden
                  />
                ) : null}
                {openedItem.mode === 'photo' && displayMediaUrl(openedItem) ? (
                  <img
                    src={displayMediaUrl(openedItem) ?? undefined}
                    alt=""
                    loading="eager"
                    decoding="async"
                    fetchPriority="high"
                    className="relative z-[1] max-h-[min(42vh,300px)] max-w-full object-contain select-none sm:max-h-[min(72vh,640px)]"
                    draggable={false}
                  />
                ) : openedItem.mode === 'video' && mainMediaUrl(openedItem) ? (
                  <video
                    key={openedItem.id}
                    src={mainMediaUrl(openedItem) ?? undefined}
                    poster={openedVideoPoster || undefined}
                    autoPlay
                    loop
                    controls
                    muted
                    playsInline
                    preload="auto"
                    onLoadedData={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
                    className="relative z-[1] max-h-[min(42vh,300px)] max-w-full object-contain sm:max-h-[min(72vh,640px)]"
                  />
                ) : openedItem.mode === 'music' && mainMediaUrl(openedItem) ? (
                  <div className="relative z-[1] flex h-full min-h-[200px] w-full min-w-0 max-w-md flex-col justify-end">
                    <MusicCardCover className="absolute inset-0" />
                    <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                    <div className="relative z-[2] w-full p-3 pb-2">
                      <p className="text-center text-sm font-bold text-white drop-shadow-md line-clamp-2">
                        {openedItem.musicTitle?.trim() || openedItem.modelLabel}
                      </p>
                    </div>
                    <audio
                      src={mainMediaUrl(openedItem) ?? undefined}
                      controls
                      preload="metadata"
                      className="relative z-[2] w-full border-0 bg-black/40 px-2 pb-2 [filter:none]"
                    />
                  </div>
                ) : (
                  <p className="px-3 text-center text-sm text-white/70">Превью недоступно для этого типа.</p>
                )}
                {mainMediaUrl(openedItem) ? (
                  <MediaDownloadButton
                    url={mainMediaUrl(openedItem) ?? ''}
                    mode={openedItem.mode}
                    id={openedItem.id}
                    label={openedItem.musicTitle?.trim() || openedItem.modelLabel}
                  />
                ) : null}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <GenerationDetailStatsDl
                  modelLabel={openedItem.modelLabel || '—'}
                  aspect={openedItem.aspect}
                  quality={openedItem.quality}
                  modelId={openedItem.modelId}
                  mode={openedItem.mode}
                  duration={openedItem.duration}
                  cost={openedItem.cost ?? null}
                  showSocial
                  authorTag={openedItem.authorTag}
                  authorName={openedItem.authorName}
                  authorAvatarUrl={openedItem.authorAvatarUrl}
                  likes={openedItem.likes}
                  likedByMe={Boolean(openedItem.likedByMe)}
                  likeDisabled={!token}
                  likeBusy={likeBusyId === openedItem.id}
                  onLike={() => void onLike(openedItem.id)}
                />
                <div className="mt-3">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Промпт</p>
                  <textarea
                    readOnly
                    rows={7}
                    value={(openedItem.prompt?.trim() || openedItem.promptPreview || '').trim()}
                    className="min-h-[7.5rem] w-full resize-none rounded-xl border border-slate-200 dark:border-slate-600 bg-surface text-slate-900 dark:text-slate-100 text-xs leading-relaxed px-3 py-2"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onRepeat(openedItem)}
                  className="mt-3 h-11 w-full rounded-xl bg-[var(--color-brand)] text-[var(--color-on-brand)] px-4 text-sm font-semibold shadow-sm transition hover:bg-[var(--color-brand-dark)] active:opacity-80 sm:w-auto"
                >
                  Повторить
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
