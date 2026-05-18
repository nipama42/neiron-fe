import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelegram } from '../hooks/useTelegram'
import BannerCarousel from '../components/ui/BannerCarousel'
import GenerationPhotoImg from '../components/generation/GenerationPhotoImg'
import UserTemplateCard from '../components/ui/UserTemplateCard'
import MediaDownloadButton from '../components/ui/MediaDownloadButton'
import MusicCardCover from '../components/ui/MusicCardCover'
import GenerationDetailStatsDl from '../components/generation/GenerationDetailStatsDl'
import { getPublicFeed, likePublicGeneration, unlikePublicGeneration, type PublicFeedItem } from '../api/explore'
import { postAdminRemoveFeedItem } from '../api/admin'
import { useAuth } from '../store/authStore'
import { saveCreateDraft } from '../lib/createDraftStorage'
import { useExploreFilter, type ExploreFilterType } from '../store/exploreFilterContext'
import { usePageSeo } from '../lib/seo'

type FeedFilter = ExploreFilterType

const FILTER_OPTIONS: { value: FeedFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'photo', label: 'Фото' },
  { value: 'video', label: 'Видео' },
  { value: 'new', label: 'Новые' },
]
const FEED_PAGE_SIZE = 30

function compareFeedByPopularity(a: PublicFeedItem, b: PublicFeedItem): number {
  const an = a.isNew ? 1 : 0
  const bn = b.isNew ? 1 : 0
  if (an !== bn) return bn - an
  if (a.isNew && b.isNew) {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  }
  if (a.likes !== b.likes) return b.likes - a.likes
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

function compareFeedByLatest(a: PublicFeedItem, b: PublicFeedItem): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

/** Порядок карточек фиксируется после загрузки ленты; при лайке счётчики меняются без перестановки. */
function applyStableFeedOrder(
  items: PublicFeedItem[],
  stableIds: string[],
  sortFn: (a: PublicFeedItem, b: PublicFeedItem) => number
): PublicFeedItem[] {
  if (!stableIds.length) {
    return [...items].sort(sortFn)
  }
  const map = new Map(items.map((i) => [i.id, i]))
  const out: PublicFeedItem[] = []
  const seen = new Set<string>()
  for (const id of stableIds) {
    const it = map.get(id)
    if (it) {
      out.push(it)
      seen.add(id)
    }
  }
  const extra = items.filter((i) => !seen.has(i.id))
  extra.sort(sortFn)
  return [...out, ...extra]
}

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

export default function ExplorePage() {
  usePageSeo({
    title: 'Лента NEIRON — публичные работы с ИИ',
    description:
      'Смотрите фото и видео, созданные пользователями NEIRON: Nano Banana, GPT Image 2, Kling, Veo 3 и другие модели в одной ленте.',
    canonicalPath: '/explore',
  })

  const { token, user, mergeUser } = useAuth()
  const canModerateFeed = user?.isAdmin === true && Boolean(token && token !== 'local-dev')
  const navigate = useNavigate()
  const { feedFilter, setFeedFilter } = useExploreFilter()
  /** Вкладка «Новые» — чистая сортировка по дате с бэка; остальное — топ по лайкам с бустом свежих */
  const feedListOrder = feedFilter === 'new' ? 'latest' : 'popular'
  const [feed, setFeed] = useState<PublicFeedItem[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedLoadingMore, setFeedLoadingMore] = useState(false)
  const [feedError, setFeedError] = useState(false)
  const [feedHasMore, setFeedHasMore] = useState(true)
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null)
  const [likeToast, setLikeToast] = useState<string | null>(null)
  const [moderationToast, setModerationToast] = useState<string | null>(null)
  const [adminHideBusyId, setAdminHideBusyId] = useState<string | null>(null)
  const [openedId, setOpenedId] = useState<string | null>(null)
  /** Порядок id после последней полной загрузки ленты (сортировка по лайкам и т.д.). */
  const feedStableOrderRef = useRef<string[]>([])
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const { ready } = useTelegram()

  useEffect(() => {
    ready()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!likeToast) return
    const id = window.setTimeout(() => setLikeToast(null), 2600)
    return () => window.clearTimeout(id)
  }, [likeToast])

  useEffect(() => {
    if (!moderationToast) return
    const id = window.setTimeout(() => setModerationToast(null), 3200)
    return () => window.clearTimeout(id)
  }, [moderationToast])

  useEffect(() => {
    let cancelled = false
    setFeedLoading(true)
    setFeedError(false)

    async function tryLoad(attempt: number) {
      try {
        const items = await getPublicFeed(FEED_PAGE_SIZE, { offset: 0, order: feedListOrder })
        if (!cancelled) {
          const sortFn = feedListOrder === 'latest' ? compareFeedByLatest : compareFeedByPopularity
          feedStableOrderRef.current = [...items].sort(sortFn).map((x) => x.id)
          setFeed(items)
          setFeedHasMore(items.length >= FEED_PAGE_SIZE)
          setFeedError(false)
        }
      } catch {
        if (cancelled) return
        if (attempt < 3) {
          setTimeout(() => tryLoad(attempt + 1), 1200 * attempt)
        } else {
          // Все попытки исчерпаны — сохраняем то что было, показываем индикатор ошибки
          setFeedError(true)
        }
      } finally {
        if (!cancelled && attempt >= 3) setFeedLoading(false)
        if (!cancelled && attempt < 3) {
          // промежуточные попытки — не снимаем лоадер
        }
      }
    }
    void tryLoad(1).then(() => { if (!cancelled) setFeedLoading(false) })
    return () => { cancelled = true }
  }, [token, feedListOrder])

  const loadMoreFeed = useMemo(
    () => async () => {
      if (feedLoading || feedLoadingMore || !feedHasMore) return
      setFeedLoadingMore(true)
      try {
        const next = await getPublicFeed(FEED_PAGE_SIZE, {
          offset: feed.length,
          order: feedListOrder,
        })
        if (next.length === 0) {
          setFeedHasMore(false)
          return
        }
        setFeed((prev) => {
          const seen = new Set(prev.map((x) => x.id))
          const unique = next.filter((x) => !seen.has(x.id))
          return unique.length ? [...prev, ...unique] : prev
        })
        setFeedHasMore(next.length >= FEED_PAGE_SIZE)
      } catch {
        // ignore silent load-more errors
      } finally {
        setFeedLoadingMore(false)
      }
    },
    [feed.length, feedHasMore, feedLoading, feedLoadingMore, feedListOrder]
  )

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || !feedHasMore) return
    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first?.isIntersecting) {
          void loadMoreFeed()
        }
      },
      { rootMargin: '480px 0px' }
    )
    io.observe(target)
    return () => io.disconnect()
  }, [feedHasMore, loadMoreFeed])

  const sortedTemplates = useMemo(() => {
    const sortFn = feedListOrder === 'latest' ? compareFeedByLatest : compareFeedByPopularity
    const list = applyStableFeedOrder(feed, feedStableOrderRef.current, sortFn)
    if (feedFilter === 'all' || feedFilter === 'new') return list
    return list.filter((t) => t.mode === feedFilter)
  }, [feed, feedFilter, feedListOrder])

  const openedItem = useMemo(() => feed.find((x) => x.id === openedId) ?? null, [feed, openedId])
  const openedVideoPoster = openedItem?.media?.video?.previewUrl?.trim() || ''

  async function onAdminHideFromFeed(id: string) {
    if (!token || !canModerateFeed) return
    setAdminHideBusyId(id)
    setModerationToast(null)
    try {
      await postAdminRemoveFeedItem(token, id)
      setFeed((prev) => prev.filter((x) => x.id !== id))
      feedStableOrderRef.current = feedStableOrderRef.current.filter((x) => x !== id)
      if (openedId === id) setOpenedId(null)
    } catch (e) {
      setModerationToast(e instanceof Error ? e.message : 'Не удалось скрыть публикацию.')
    } finally {
      setAdminHideBusyId(null)
    }
  }

  async function onLike(id: string) {
    if (!token) return
    const cur = feed.find((x) => x.id === id)
    if (!cur) return
    setLikeBusyId(id)
    if (cur.likedByMe) {
      setFeed((prev) =>
        prev.map((x) => (x.id === id ? { ...x, likedByMe: false, likes: Math.max(0, x.likes - 1) } : x))
      )
      try {
        const r = await unlikePublicGeneration(token, id)
        mergeUser(r.user)
      } catch {
        setFeed((prev) =>
          prev.map((x) => (x.id === id ? { ...x, likedByMe: true, likes: x.likes + 1 } : x))
        )
        setLikeToast('Не удалось снять лайк.')
      }
    } else {
      setFeed((prev) =>
        prev.map((x) => (x.id === id ? { ...x, likedByMe: true, likes: x.likes + 1 } : x))
      )
      try {
        const r = await likePublicGeneration(token, id)
        mergeUser(r.user)
      } catch {
        setFeed((prev) =>
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

  function openAuthorProfile(item: PublicFeedItem) {
    const ref = item.authorTag?.trim() || item.authorName.trim()
    if (!ref) return
    const gid = encodeURIComponent(item.id)
    setOpenedId(null)
    navigate(`/profile/author/${encodeURIComponent(ref)}?gid=${gid}`, {
      state: {
        authorId: item.authorId ?? null,
        authorTag: item.authorTag,
        authorName: item.authorName,
        initialItem: item,
      },
    })
  }

  useEffect(() => {
    if (!openedId) return
    const exists = feed.some((x) => x.id === openedId)
    if (!exists) setOpenedId(null)
  }, [openedId, feed])

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
    <div className="container pt-5 pb-4  space-y-4">
      {likeToast ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/70 dark:bg-red-950/60 dark:text-red-300">
          {likeToast}
        </div>
      ) : null}
      {moderationToast ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100">
          {moderationToast}
        </div>
      ) : null}
      <div className="-mx-3 sm:mx-0">
        <BannerCarousel />
      </div>

      <section>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-sm lg:text-base font-semibold text-slate-700 dark:text-slate-200">
            Публичные работы
          </h2>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {feedFilter === 'new' ? 'по дате' : 'по лайкам'}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFeedFilter(opt.value)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${feedFilter === opt.value
                  ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200'
                  : 'bg-surface text-slate-600 border-slate-200 dark:text-slate-400 dark:border-slate-600 dark:bg-slate-800/50'
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {feedLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">Загружаем ленту…</p>
        ) : feedError && sortedTemplates.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">Не удалось загрузить публикации</p>
            <button
              type="button"
              onClick={() => {
                setFeedLoading(true)
                setFeedError(false)
                void getPublicFeed(FEED_PAGE_SIZE, { offset: 0, order: feedListOrder })
                  .then((items) => {
                    const sortFn = feedListOrder === 'latest' ? compareFeedByLatest : compareFeedByPopularity
                    feedStableOrderRef.current = [...items].sort(sortFn).map((x) => x.id)
                    setFeed(items)
                    setFeedHasMore(items.length >= FEED_PAGE_SIZE)
                  })
                  .catch(() => setFeedError(true))
                  .finally(() => setFeedLoading(false))
              }}
              className="text-xs px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            >
              Повторить
            </button>
          </div>
        ) : sortedTemplates.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-4 auto-rows-min items-start">
              {sortedTemplates.map((item, index) => (
                <div key={item.id} className="min-w-0">
                  <UserTemplateCard
                    item={item}
                    uniformAspect
                    mediaPriority={index < 12}
                    onLike={onLike}
                    onOpen={setOpenedId}
                    likeBusy={likeBusyId === item.id}
                    showAdminHideFromFeed={canModerateFeed}
                    onAdminHideFromFeed={() => void onAdminHideFromFeed(item.id)}
                    adminHideBusy={adminHideBusyId === item.id}
                  />
                </div>
              ))}
            </div>
            <div ref={loadMoreRef} className="h-8" />
            {feedLoadingMore ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-1 text-center">Загружаем еще…</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
            Пока нет публичных работ в этой категории
          </p>
        )}
      </section>

      {openedItem ? (
        <div
          className="fixed inset-0 z-[65] flex items-end justify-center bg-black/70 animate-[fadeIn_.18s_ease-out] modal-backdrop-safe-tg sm:items-center sm:px-3"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр публикации"
          onClick={() => setOpenedId(null)}
        >
          <div
            className="generation-detail-sheet flex max-h-[min(96dvh,100vh)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-surface shadow-2xl animate-[slideUp_.22s_cubic-bezier(.2,.8,.2,1)] dark:border-slate-600 sm:max-h-[min(90dvh,900px)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex shrink-0 items-start justify-between gap-2 border-b border-slate-200 pt-2 pb-2.5 pl-3 pr-2 dark:border-slate-700 sm:py-2.5">
              {canModerateFeed ? (
                <button
                  type="button"
                  disabled={adminHideBusyId === openedItem.id}
                  onClick={() => void onAdminHideFromFeed(openedItem.id)}
                  className="absolute right-14 top-2 z-[2] shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 shadow-sm hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/70"
                >
                  {adminHideBusyId === openedItem.id ? '…' : 'Скрыть из ленты'}
                </button>
              ) : null}
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
                  {openedItem.modelLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenedId(null)}
                className="modal-detail-close absolute flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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
                  <GenerationPhotoImg
                    item={openedItem}
                    alt=""
                    priority
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-55"
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
                  <GenerationPhotoImg
                    item={openedItem}
                    alt=""
                    priority
                    className="relative z-[1] max-h-[min(42vh,300px)] max-w-full object-contain select-none sm:max-h-[min(72vh,640px)]"
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
                  cost={openedItem.cost}
                  showSocial
                  authorTag={openedItem.authorTag ?? openedItem.authorName}
                  authorName={openedItem.authorName}
                  authorAvatarUrl={openedItem.authorAvatarUrl}
                  onAuthorClick={() => openAuthorProfile(openedItem)}
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
