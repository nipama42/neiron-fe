import { useEffect, useRef, useState } from 'react'
import type { PublicFeedItem } from '../../api/explore'
import GenerationPhotoImg from '../generation/GenerationPhotoImg'
import MusicCardCover from './MusicCardCover'

interface Props {
  item: PublicFeedItem
  onLike?: (id: string) => void
  onOpen?: (id: string) => void
  likeBusy?: boolean
  /** Только админ: кнопка снятия с общей ленты */
  showAdminHideFromFeed?: boolean
  onAdminHideFromFeed?: () => void
  adminHideBusy?: boolean
  /** В сетке ленты: одно соотношение сторон у всех карточек — без пустых «дырок» между рядами */
  uniformAspect?: boolean
  /** Первые карточки: картинка eager + высокий fetchPriority (видео по-прежнему по видимости, без шторма запросов) */
  mediaPriority?: boolean
}

export default function UserTemplateCard({
  item,
  onLike,
  onOpen,
  likeBusy = false,
  showAdminHideFromFeed = false,
  onAdminHideFromFeed,
  adminHideBusy = false,
  uniformAspect = false,
  mediaPriority = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const displayUrl = item.resultDisplayUrl?.trim() || item.resultUrl?.trim() || ''
  const mainUrl = item.resultMainUrl?.trim() || item.resultUrl?.trim() || ''
  const videoPoster = item.media?.video?.previewUrl?.trim() || ''

  const [inView, setInView] = useState(false)
  const [videoSrcActive, setVideoSrcActive] = useState(false)

  useEffect(() => {
    if (item.mode !== 'video') return
    const root = articleRef.current
    if (!root) return
    const io = new IntersectionObserver(
      ([entry]) => {
        const on = Boolean(entry?.isIntersecting)
        setInView(on)
        if (on) setVideoSrcActive(true)
      },
      {
        rootMargin: '320px 0px 420px 0px',
        threshold: [0, 0.04, 0.12],
      }
    )
    io.observe(root)
    return () => io.disconnect()
  }, [item.mode, item.id])

  useEffect(() => {
    if (item.mode !== 'video') return
    const vid = videoRef.current
    if (!vid || !videoSrcActive || !displayUrl) return
    const tryPlay = () => {
      if (document.visibilityState === 'visible' && inView) void vid.play().catch(() => {})
    }
    if (inView && document.visibilityState === 'visible') {
      void vid.play().catch(() => {})
    } else {
      vid.pause()
    }
    const onReady = () => tryPlay()
    vid.addEventListener('loadeddata', onReady)
    vid.addEventListener('canplay', onReady)
    requestAnimationFrame(tryPlay)
    return () => {
      vid.removeEventListener('loadeddata', onReady)
      vid.removeEventListener('canplay', onReady)
    }
  }, [displayUrl, inView, item.mode, videoSrcActive])

  const ratio = (() => {
    if (uniformAspect) return 3 / 4
    if (item.mode === 'music') return 1
    const raw = String(item.aspect ?? '')
    if (!raw.includes(':')) return 3 / 4
    const [wRaw, hRaw] = raw.split(':')
    const w = Number(wRaw)
    const h = Number(hRaw)
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 3 / 4
    return w / h
  })()

  const cardTitle = item.modelLabel || item.promptPreview || 'Публичная работа'
  const musicTitleLine =
    item.mode === 'music' ? (item.musicTitle?.trim() || item.modelLabel || 'Музыка') : null

  const imgSizes =
    '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw'
  const imgDims = item.media?.image
  const imgW = typeof imgDims?.width === 'number' && imgDims.width > 0 ? Math.round(imgDims.width) : undefined
  const imgH = typeof imgDims?.height === 'number' && imgDims.height > 0 ? Math.round(imgDims.height) : undefined

  return (
    <article
      ref={articleRef}
      className="group relative w-full overflow-hidden rounded-2xl shadow-md bg-[var(--color-media-chrome-bg)]"
      style={{ aspectRatio: String(ratio) }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen?.(item.id)
        }
      }}
    >
      {item.mode === 'video' && displayUrl ? (
        <video
          key={item.id}
          ref={videoRef}
          src={videoSrcActive ? displayUrl : undefined}
          poster={videoPoster || undefined}
          autoPlay
          loop
          muted
          playsInline
          preload={videoSrcActive ? 'metadata' : 'none'}
          onLoadedData={() => {
            if (inView && document.visibilityState === 'visible') {
              void videoRef.current?.play().catch(() => {})
            }
          }}
          onCanPlay={() => {
            if (inView && document.visibilityState === 'visible') {
              void videoRef.current?.play().catch(() => {})
            }
          }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : item.mode === 'music' ? (
        <MusicCardCover />
      ) : displayUrl ? (
        <GenerationPhotoImg
          item={item}
          alt=""
          width={imgW}
          height={imgH}
          sizes={imgSizes}
          priority={mediaPriority}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-900 to-slate-950" aria-hidden />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />
      {item.isNew ? (
        <span className="absolute top-2.5 left-2.5 z-[1] rounded-full bg-emerald-500/95 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white shadow">
          NEW
        </span>
      ) : null}

      {showAdminHideFromFeed ? (
        <button
          type="button"
          disabled={adminHideBusy}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onAdminHideFromFeed?.()
          }}
          className="absolute top-2 right-2 z-[4] rounded-lg bg-black/55 px-2 py-1 text-[10px] font-semibold text-white shadow backdrop-blur-sm hover:bg-black/75 disabled:opacity-50"
        >
          {adminHideBusy ? '…' : 'Скрыть'}
        </button>
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 z-[2] flex flex-col text-white">
        <div className="p-3 pb-2">
          {item.mode === 'music' ? (
            <h3 className="text-sm font-bold leading-snug line-clamp-2 drop-shadow-md">{musicTitleLine}</h3>
          ) : (
            <h3 className="text-sm font-semibold leading-snug line-clamp-2 drop-shadow-md">{cardTitle}</h3>
          )}
          <div className="flex items-center justify-between gap-2 mt-2 text-xs text-white/90">
            <span className="truncate">{item.authorTag ?? item.authorName}</span>
            <button
              type="button"
              disabled={likeBusy}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onLike?.(item.id)
              }}
              className="relative z-[3] inline-flex items-center gap-2 shrink-0 tabular-nums text-[13px] font-semibold text-white/95 disabled:opacity-65"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
                className={`h-5 w-5 shrink-0 ${item.likedByMe ? 'text-rose-400' : 'text-rose-300'}`}
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span>{item.likes.toLocaleString('ru-RU')}</span>
            </button>
          </div>
        </div>
        {item.mode === 'music' && mainUrl ? (
          <audio
            ref={audioRef}
            src={mainUrl}
            controls
            preload="metadata"
            className="h-10 w-full shrink-0 border-0 bg-black/50 px-1 [filter:none]"
            onClick={(e) => e.stopPropagation()}
          />
        ) : null}
      </div>
    </article>
  )
}
