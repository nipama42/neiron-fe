import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import landingPhotoExmpl from '../assets/landing-photo-exmpl.png'
import { getPublicFeed, type PublicFeedItem } from '../api/explore'
import SeoJsonLd from '../components/SeoJsonLd'
import { LANDING_FAQ_ITEMS } from '../lib/landingFaq'
import { buildLandingJsonLd, DEFAULT_PAGE_DESCRIPTION, DEFAULT_PAGE_TITLE, usePageSeo } from '../lib/seo'

const LANDING_STYLES = `
.landing-page {
  --color-base: #0a0a0a;
  --color-body: #0a0a0a;
  --color-surface: rgba(20, 20, 22, 0.72);
  --color-surface-solid: #141416;
  --color-brand: #f5f4f0;
  --color-on-brand: #0f0f0f;
  --color-brand-light: rgba(255,255,255,0.10);
  --color-brand-strong: rgba(255,255,255,0.22);
  --color-brand-dark: #e0e0e0;
  --color-muted: rgba(245,244,240,0.55);
  --color-muted-soft: rgba(245,244,240,0.35);

  --color-type-photo: rgba(255,255,255,0.12);
  --color-type-video: rgba(200,200,200,0.18);
  --color-type-voice: rgba(120,151,142,0.55);
  --color-type-chat:  rgba(200,200,200,0.18);

  --color-type-photo-icon: rgba(245,244,240,1);
  --color-type-video-icon: rgba(220,220,220,1);
  --color-type-voice-icon: rgba(120,151,142,1);
  --color-type-chat-icon:  rgba(220,220,220,1);

  background: #0a0a0a;
  color: var(--color-brand);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  min-height: 100vh;
  scroll-behavior: smooth;
}

.landing-page .bg-neuro {
  position: fixed; inset: 0; z-index: 0;
  background-image: url('/neironauto.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  animation: landing-bg-drift 60s ease-in-out infinite alternate;
}
.landing-page .bg-neuro::before {
  content: ""; position: absolute; inset: 0;
  background:
    radial-gradient(60% 50% at 20% 15%, rgba(255,255,255,0.08), transparent 60%),
    radial-gradient(55% 45% at 80% 85%, rgba(120,151,142,0.10), transparent 60%),
    linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.78) 60%, rgba(0,0,0,0.92) 100%);
}
@keyframes landing-bg-drift {
  from { transform: scale(1) translate(0,0); }
  to   { transform: scale(1.05) translate(-1.5%, -1%); }
}

.landing-page .section-veil { background: linear-gradient(180deg, rgba(10,10,10,0.0) 0%, rgba(10,10,10,0.55) 50%, rgba(10,10,10,0.92) 100%); }
.landing-page .section-solid { background: rgba(10,10,10,0.92); backdrop-filter: blur(8px); }

.landing-page .text-brand { color: var(--color-brand); }
.landing-page .text-muted { color: var(--color-muted); }
.landing-page .text-muted-soft { color: var(--color-muted-soft); }
.landing-page .bg-brand { background: var(--color-brand); color: var(--color-on-brand); }

.landing-page .glass {
  background: rgba(20,20,22,0.55);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid var(--color-brand-light);
}
.landing-page .glass-strong {
  background: rgba(15,15,17,0.78);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  border: 1px solid var(--color-brand-light);
}

.landing-page .nav-blur {
  backdrop-filter: saturate(180%) blur(18px);
  -webkit-backdrop-filter: saturate(180%) blur(18px);
  background: rgba(10,10,10,0.55);
  border-bottom: 1px solid var(--color-brand-light);
}

@keyframes landing-aurora-drift {
  0%,100% { transform: translate(0,0) scale(1); opacity: .55; }
  40%     { transform: translate(8%, -6%) scale(1.1); opacity: .8; }
  70%     { transform: translate(-6%, 8%) scale(.95); opacity: .65; }
}
.landing-page .aurora { position:absolute; border-radius:9999px; filter: blur(80px); pointer-events:none; }
.landing-page .aurora-1 { animation: landing-aurora-drift 9s ease-in-out infinite; }
.landing-page .aurora-2 { animation: landing-aurora-drift 11s ease-in-out infinite .8s; }

@keyframes landing-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.landing-page .marquee-track { display: flex; gap: 14px; width: max-content; animation: landing-marquee 60s linear infinite; }

.landing-page .tilt-1 { transform: rotate(-3deg) translateY(8px); }
.landing-page .tilt-2 { transform: rotate(2deg)  translateY(-6px); }
.landing-page .tilt-3 { transform: rotate(4deg)  translateY(14px); }

.landing-page .pill { display:inline-flex; align-items:center; gap:6px; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 500; }
.landing-page .pill-dot { width: 8px; height: 8px; border-radius: 9999px; }

.landing-page .card-hover { transition: transform .25s ease, border-color .25s ease, background .25s ease; }
.landing-page .card-hover:hover { transform: translateY(-4px); border-color: var(--color-brand-strong); background: rgba(28,28,30,0.65); }

.landing-page .badge {
  display:inline-block;
  font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
  padding: 4px 10px; border-radius: 999px;
  background: rgba(255,255,255,0.06); color: var(--color-muted);
  border: 1px solid var(--color-brand-light);
}

.landing-page .ph {
  position: relative; overflow: hidden; border-radius: 16px;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  border: 1px solid var(--color-brand-light);
}
.landing-page .ph-photo,
.landing-page .ph-video,
.landing-page .ph-voice {
  border: none;
}
.landing-page .ph-photo { background: linear-gradient(135deg,#3b3a36,#1a1a18); }
.landing-page .ph-video::after { content:""; position:absolute; inset:0; z-index: 2; pointer-events: none; background: radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,.35), transparent 50%); }
.landing-page .ph-voice::after { content:""; position:absolute; inset:0; background: radial-gradient(120% 80% at 70% 30%, rgba(120,151,142,.55), transparent 55%); }

.landing-page .btn-primary {
  background: var(--color-brand);
  color: var(--color-on-brand);
  transition: opacity .2s ease, transform .2s ease;
}
.landing-page .btn-primary:hover { opacity: .92; }
.landing-page .btn-primary:active { transform: scale(.98); }

.landing-page .btn-ghost {
  background: rgba(255,255,255,0.06);
  color: var(--color-brand);
  border: 1px solid var(--color-brand-light);
  backdrop-filter: blur(10px);
  transition: background .2s ease, border-color .2s ease;
}
.landing-page .btn-ghost:hover { background: rgba(255,255,255,0.12); border-color: var(--color-brand-strong); }

.landing-page .hairline { border-top: 1px solid var(--color-brand-light); }
.landing-page .eq-bar { background: rgba(255,255,255,0.7); width: 5px; }

.landing-page .faq-plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transform-origin: center center;
  transition: transform .28s ease;
}
.landing-page .faq-plus.open {
  transform: rotate(45deg);
}
.landing-page .faq-panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows .32s ease;
}
.landing-page .faq-panel.open {
  grid-template-rows: 1fr;
}
.landing-page .faq-panel-inner {
  overflow: hidden;
}
.landing-page .faq-answer {
  margin-top: 12px;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity .24s ease, transform .24s ease;
}
.landing-page .faq-panel.open .faq-answer {
  opacity: 1;
  transform: translateY(0);
}

.landing-page a.nav-link { cursor: pointer; transition: color .2s ease; }
.landing-page a.nav-link:hover { color: var(--color-brand); }
.landing-page [id] { scroll-margin-top: 88px; }
`

const COMMUNITY_CAROUSEL_MEDIA_LIMIT = 15
/** Берём с запасом: в ответе могут быть аудио/чат — после фильтра остаётся до N фото/видео. */
const COMMUNITY_FEED_FETCH_LIMIT = 48

function isVideoPlaybackUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0].toLowerCase()
  return /\.(mp4|webm|mov|m4v|ogv)(\s|$)/i.test(path)
}

function isRasterImageUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0].toLowerCase()
  return /\.(webp|png|jpe?g|gif|avif)(\s|$)/i.test(path)
}

type LandingMarqueeVisual = { kind: 'video'; src: string } | { kind: 'img'; src: string }

/** Превью в ленте: display часто webp, полное видео — в main/result; иначе картинка или последняя попытка как video. */
function landingMarqueeVideoVisual(item: PublicFeedItem): LandingMarqueeVisual | null {
  if (item.mode !== 'video') return null
  const candidates = [item.resultDisplayUrl, item.resultMainUrl, item.resultUrl]
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean) as string[]
  if (!candidates.length) return null
  const videoLike = candidates.find((u) => isVideoPlaybackUrl(u))
  if (videoLike) return { kind: 'video', src: videoLike }
  const raster = candidates.find((u) => isRasterImageUrl(u))
  if (raster) return { kind: 'img', src: raster }
  return { kind: 'video', src: candidates[0] }
}

function landingMarqueePhotoUrl(item: PublicFeedItem): string | null {
  const display = item.resultDisplayUrl?.trim()
  if (display) return display
  const fallback = item.resultUrl?.trim()
  return fallback || null
}

function hasLandingMarqueeVisual(item: PublicFeedItem): boolean {
  if (item.mode === 'video') return Boolean(landingMarqueeVideoVisual(item))
  if (item.mode === 'photo') return Boolean(landingMarqueePhotoUrl(item))
  return false
}

function LandingMarqueeVideo({ src, eager }: { src: string; eager: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const tryPlay = () => {
      void el.play().catch(() => {})
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) tryPlay()
        else el.pause()
      },
      { root: null, rootMargin: '100px 0px 180px 0px', threshold: [0, 0.05, 0.1] }
    )
    io.observe(el)
    el.addEventListener('loadeddata', tryPlay)
    el.addEventListener('canplay', tryPlay)
    return () => {
      io.disconnect()
      el.removeEventListener('loadeddata', tryPlay)
      el.removeEventListener('canplay', tryPlay)
    }
  }, [src])
  return (
    <video
      ref={ref}
      src={src}
      className="relative z-[1] h-full w-full object-cover"
      muted
      loop
      playsInline
      preload={eager ? 'auto' : 'metadata'}
    />
  )
}

export default function LandingPage() {
  const [communityFeed, setCommunityFeed] = useState<PublicFeedItem[]>([])
  const [openFaqIds, setOpenFaqIds] = useState<string[]>(['howtogenerate'])

  usePageSeo({
    title: DEFAULT_PAGE_TITLE,
    description: DEFAULT_PAGE_DESCRIPTION,
    canonicalPath: '/',
  })

  const landingJsonLd = useMemo(() => buildLandingJsonLd(), [])

  useEffect(() => {
    let cancelled = false
    void getPublicFeed(COMMUNITY_FEED_FETCH_LIMIT, {
      offset: 0,
      order: 'latest',
      cache: 'no-store',
    })
      .then((items) => {
        if (cancelled) return
        const photoOrVideo = items.filter((i) => i.mode === 'photo' || i.mode === 'video')
        const withVisual = photoOrVideo.filter(hasLandingMarqueeVisual)
        setCommunityFeed(withVisual.slice(0, COMMUNITY_CAROUSEL_MEDIA_LIMIT))
      })
      .catch(() => {
        if (!cancelled) setCommunityFeed([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const communityMarqueeItems = useMemo(
    () => (communityFeed.length > 0 ? [...communityFeed, ...communityFeed] : []),
    [communityFeed]
  )
  const communityCycleLen = communityFeed.length || 1

  return (
    <div className="landing-page">
      <SeoJsonLd id="landing" data={landingJsonLd} />
      <style>{LANDING_STYLES}</style>

      {/* ============ ФОН ============ */}
      <div className="bg-neuro"></div>

      <div className="relative z-10">
        {/* ============ NAV ============ */}
        <header className="sticky top-0 z-50 nav-blur">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2 font-bold tracking-tight text-[17px]">
                <div className="h-7 w-7 rounded-lg bg-brand grid place-items-center">
                <img src="../../favicon.png" alt="" />
                </div>
                NEIRON
              </div>
              <nav className="hidden md:flex items-center gap-6 text-sm text-muted">
                <a href="#features" className="nav-link">Возможности</a>
                <a href="#models" className="nav-link">Модели</a>
                {/* <a href="#pricing" className="nav-link">Цены</a> */}
                <a href="#community" className="nav-link">Сообщество</a>
                <a href="#partners" className="nav-link">Партнёрам</a>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/login" className="text-sm text-muted hover:text-brand px-3 h-9 inline-flex items-center transition-colors">
                Войти
              </Link>
              <Link to="/login" className="btn-primary text-sm font-semibold px-4 h-9 rounded-full inline-flex items-center gap-1.5">
                Начать бесплатно
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </header>

        {/* ============ HERO ============ */}
        <section className="relative overflow-hidden">
          <div className="aurora aurora-1" style={{ width: 520, height: 520, top: -120, left: -120, background: 'rgba(255,255,255,.14)' }}></div>
          <div className="aurora aurora-2" style={{ width: 480, height: 480, bottom: -160, right: -100, background: 'rgba(120,151,142,.20)' }}></div>

          <div className="max-w-7xl mx-auto px-6 pt-24 pb-32 grid lg:grid-cols-2 gap-16 items-center relative">
            <div>
              <div className="pill glass mb-6">
                <span className="pill-dot bg-emerald-400"></span>
                Без VPN · На русском · Все модели в одном месте
              </div>
              <h1 className="text-[56px] leading-[1.02] lg:text-[80px] lg:leading-[0.98] font-bold tracking-tight">
                AI-генерация<br />
                <span className="text-muted">нового поколения</span>
              </h1>
              <p className="mt-6 text-lg text-muted max-w-xl">
                Генерируйте фото, видео и музыку, общайтесь с нейросетью —
                всё в одном приложении. GPT-Image, Veo 3, Suno и десятки других моделей.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/login" className="btn-primary h-12 px-6 rounded-full text-sm font-semibold inline-flex items-center gap-2">
                  Начать бесплатно
                  <span aria-hidden="true">→</span>
                </Link>
                <Link to="/login" className="btn-ghost h-12 px-6 rounded-full text-sm font-semibold inline-flex items-center gap-2">
                  ▶ Посмотреть работы
                </Link>
                <span className="text-xs text-muted-soft ml-1">~2 генерации бесплатно · без карты</span>
              </div>
            </div>

            {/* стек превью */}
            <div className="relative h-[520px] hidden lg:block">
              <div className="absolute inset-0">
                <div className="absolute right-10 top-2 w-[260px] h-[340px] ph ph-photo tilt-1 shadow-2xl">
                  <div className="absolute top-3 left-3 badge">PHOTO · GPT-Image</div>
                  <img src={landingPhotoExmpl} alt="." /> 

                </div>
                <div className="absolute left-0 top-24 w-[300px] h-[180px] ph ph-video tilt-2 shadow-2xl">
                  <div className="absolute top-3 left-3 badge">VIDEO · Veo 3</div>
                  <div className="absolute inset-0 grid place-items-center">
                    <div className="h-12 w-12 rounded-full bg-white/15 grid place-items-center backdrop-blur">
                      <span className="text-white text-lg pl-0.5">▶</span>
                    </div>
                  </div>
                </div>
                <div className="absolute right-2 bottom-2 w-[260px] h-[150px] ph ph-voice tilt-3 shadow-2xl">
                  <div className="absolute top-3 left-3 badge">AUDIO · Suno v4</div>
                  <div className="absolute inset-x-4 bottom-4 flex items-end gap-1 h-10">
                    <div className="eq-bar" style={{ height: '30%' }}></div>
                    <div className="eq-bar" style={{ height: '60%' }}></div>
                    <div className="eq-bar" style={{ height: '80%' }}></div>
                    <div className="eq-bar" style={{ height: '45%' }}></div>
                    <div className="eq-bar" style={{ height: '90%' }}></div>
                    <div className="eq-bar" style={{ height: '55%' }}></div>
                    <div className="eq-bar" style={{ height: '70%' }}></div>
                    <div className="eq-bar" style={{ height: '35%' }}></div>
                    <div className="eq-bar" style={{ height: '65%' }}></div>
                    <div className="eq-bar" style={{ height: '85%' }}></div>
                    <div className="eq-bar" style={{ height: '50%' }}></div>
                    <div className="eq-bar" style={{ height: '25%' }}></div>
                  </div>
                </div>
                <div className="absolute left-12 bottom-10 w-[230px] h-[120px] rounded-2xl glass-strong shadow-xl p-4">
                  <div className="text-[10px] uppercase tracking-wider text-muted-soft">CHAT</div>
                  <div className="text-xs mt-1 leading-snug text-brand">Придумай 3 идеи постера для<br />осенней коллекции бренда…</div>
                  <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> печатает…
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ ВОЗМОЖНОСТИ ============ */}
        <section id="features" className="section-veil border-t border-[var(--color-brand-light)]">
          <div className="max-w-7xl mx-auto px-6 py-24">
            <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
              <div>
                <div className="badge mb-3">Возможности</div>
                <h2 className="text-4xl lg:text-5xl font-bold tracking-tight max-w-2xl">
                  Четыре направления — <br></br>один сервис
                </h2>
              </div>
              <p className="text-muted max-w-md">
                Не нужно платить за пять разных сервисов. Все ведущие модели уже подключены и работают на одном балансе.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-hover glass rounded-2xl p-6 flex flex-col gap-4">
                <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: 'var(--color-type-photo)', color: 'var(--color-type-photo-icon)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M8 5l1.5-2h5L16 5" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-lg">Фото</div>
                  <p className="text-sm text-muted mt-1">Реалистичные изображения, аватары, обложки за ~1 минуту.</p>
                </div>
                <div className="mt-auto pt-4 hairline text-[11px] text-muted-soft">
                  GPT-Image · Flux · Nano-Banana · Wan
                </div>
              </div>
              <div className="card-hover glass rounded-2xl p-6 flex flex-col gap-4">
                <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: 'var(--color-type-video)', color: 'var(--color-type-video-icon)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="6" width="14" height="12" rx="2" /><path d="M21 8l-4 4 4 4V8z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-lg">Видео</div>
                  <p className="text-sm text-muted mt-1">Короткие ролики из текста или одного кадра. До 15 секунд, 1080p.</p>
                </div>
                <div className="mt-auto pt-4 hairline text-[11px] text-muted-soft">
                  Veo 3 · Kling · Sora 2 · Kling
                </div>
              </div>
              <div className="card-hover glass rounded-2xl p-6 flex flex-col gap-4">
                <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: 'var(--color-type-voice)', color: 'var(--color-type-voice-icon)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M9 18V6l10-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-lg">Музыка и голос</div>
                  <p className="text-sm text-muted mt-1">Полноценные треки и озвучка из текстового описания.</p>
                </div>
                <div className="mt-auto pt-4 hairline text-[11px] text-muted-soft">
                  Voice Studio . SFX Labs
                </div>
              </div>
              <div className="card-hover glass rounded-2xl p-6 flex flex-col gap-4">
                <div className="h-10 w-10 rounded-xl grid place-items-center" style={{ background: 'var(--color-type-chat)', color: 'var(--color-type-chat-icon)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M21 12a8 8 0 11-3.2-6.4L21 4l-1 4.2A8 8 0 0121 12z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-lg">AI-чат</div>
                  <p className="text-sm text-muted mt-1">Промпты, идеи, тексты, переводы. Помощник под рукой.</p>
                </div>
                <div className="mt-auto pt-4 hairline text-[11px] text-muted-soft">
                  GPT-5.4
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ ВИТРИНА ============ */}
        <section id="community" className="section-solid border-y border-[var(--color-brand-light)]">
          <div className="max-w-7xl mx-auto px-6 pt-20 pb-10">
            <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
              <div>
                <div className="badge mb-3">Лента работ</div>
                <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">Создано в NEIRON</h2>
                <p className="text-muted mt-2 max-w-lg">Тысячи работ от сообщества каждый день. Любую можно повторить в один клик.</p>
              </div>
              <Link to="/login" className="btn-ghost h-11 px-5 rounded-full text-sm font-semibold inline-flex items-center gap-2">
                Открыть ленту →
              </Link>
            </div>
          </div>

          <div className="overflow-hidden pb-20">
            <div className="marquee-track px-6">
              {communityMarqueeItems.length > 0 ? communityMarqueeItems.map((item, idx) => {
                const mediaUrl = landingMarqueePhotoUrl(item)
                const sizeClass =
                  idx % 5 === 0
                    ? 'w-[180px] h-[240px]'
                    : idx % 5 === 1
                      ? 'w-[280px] h-[180px]'
                      : idx % 5 === 2
                        ? 'w-[200px] h-[200px]'
                        : idx % 5 === 3
                          ? 'w-[160px] h-[220px]'
                          : 'w-[260px] h-[180px]'
                const modeClass =
                  item.mode === 'video' ? 'ph-video' : item.mode === 'audio' || item.mode === 'music' ? 'ph-voice' : 'ph-photo'
                const videoVisual = item.mode === 'video' ? landingMarqueeVideoVisual(item) : null
                const slotInCycle = idx % communityCycleLen

                return (
                  <div key={`${item.id}-${idx}`} className={`ph ${modeClass} ${sizeClass}`}>
                    {videoVisual?.kind === 'video' ? (
                      <LandingMarqueeVideo src={videoVisual.src} eager={slotInCycle < 4} />
                    ) : videoVisual?.kind === 'img' ? (
                      <img
                        src={videoVisual.src}
                        alt={item.promptPreview || item.modelLabel}
                        className="relative z-[1] h-full w-full object-cover"
                        loading={idx < 6 ? 'eager' : 'lazy'}
                        decoding="async"
                        fetchPriority={idx < 4 ? 'high' : 'low'}
                      />
                    ) : mediaUrl ? (
                      <img
                        src={mediaUrl}
                        alt={item.promptPreview || item.modelLabel}
                        className="h-full w-full object-cover"
                        loading={idx < 6 ? 'eager' : 'lazy'}
                        decoding="async"
                        fetchPriority={idx < 4 ? 'high' : 'low'}
                      />
                    ) : null}
                  </div>
                )
              }) : (
                <>
                  <div className="ph ph-photo w-[180px] h-[240px]"></div>
                  <div className="ph ph-video w-[280px] h-[180px]"></div>
                  <div className="ph ph-voice w-[200px] h-[200px]"></div>
                  <div className="ph ph-photo w-[160px] h-[220px]"></div>
                  <div className="ph ph-video w-[320px] h-[200px]"></div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ============ КАК ЭТО РАБОТАЕТ ============ */}
        <section id="models" className="section-solid">
          <div className="max-w-7xl mx-auto px-6 py-24">
            <div className="badge mb-3">Как это работает</div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight max-w-2xl mb-14">Генерация за 3 шага</h2>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="relative glass rounded-2xl p-8 overflow-hidden">
                <div className="text-[140px] leading-none font-black text-white/[0.04] absolute right-2 -top-3 select-none">1</div>
                <div className="relative">
                  <div className="badge mb-4">Шаг 1</div>
                  <h3 className="font-semibold text-xl">Опишите идею</h3>
                  <p className="text-sm text-muted mt-2">«Космонавт верхом на коне на Марсе, киноосвещение, 35мм».</p>
                </div>
              </div>
              <div className="relative glass rounded-2xl p-8 overflow-hidden">
                <div className="text-[140px] leading-none font-black text-white/[0.04] absolute right-2 -top-3 select-none">2</div>
                <div className="relative">
                  <div className="badge mb-4">Шаг 2</div>
                  <h3 className="font-semibold text-xl">Выберите модель</h3>
                  <p className="text-sm text-muted mt-2">GPT-Image для фото, Veo 3 для видео, Suno для музыки.</p>
                </div>
              </div>
              <div className="relative glass rounded-2xl p-8 overflow-hidden">
                <div className="text-[140px] leading-none font-black text-white/[0.04] absolute right-2 -top-3 select-none">3</div>
                <div className="relative">
                  <div className="badge mb-4">Шаг 3</div>
                  <h3 className="font-semibold text-xl">Получите результат</h3>
                  <p className="text-sm text-muted mt-2">30-60 секунд — и готовый файл. Сохраните или опубликуйте.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ ПРЕИМУЩЕСТВА ============ */}
        <section className="section-solid border-y border-[var(--color-brand-light)]">
          <div className="max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-16">
            <div>
              <div className="badge mb-3">Почему NEIRON</div>
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">Создано для тех, кто работает с контентом</h2>
              <p className="text-muted mt-4 max-w-md">Мы убрали трение: VPN, отдельные подписки, английский интерфейс. Просто откройте и создавайте.</p>

              <div className="mt-8 inline-flex items-center gap-3 glass rounded-2xl p-4 pr-6">
                <div className="h-12 w-12 rounded-xl grid place-items-center bg-brand">
                <img src="../../favicon.png" alt="" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Несколько генераций при регистрации</div>
                  <div className="text-xs text-muted">~ 3 фото или 2 видео — попробовать без вложений</div>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="glass rounded-2xl p-5">
                <div className="text-2xl mb-2">🇷🇺</div>
                <div className="font-semibold">На русском</div>
                <p className="text-sm text-muted mt-1">Промпты, интерфейс, поддержка — на русском языке.</p>
              </div>
              <div className="glass rounded-2xl p-5">
                <div className="text-2xl mb-2">⚡</div>
                <div className="font-semibold">Без VPN и карт</div>
                <p className="text-sm text-muted mt-1">Прямой доступ к моделям из России. Оплата привычными способами.</p>
              </div>
              <div className="glass rounded-2xl p-5">
                <div className="text-2xl mb-2">💎</div>
                <div className="font-semibold">Все модели сразу</div>
                <p className="text-sm text-muted mt-1">Не нужно платить за 5 разных подписок — один баланс на всё.</p>
              </div>
              <div className="glass rounded-2xl p-5">
                <div className="text-2xl mb-2">🤝</div>
                <div className="font-semibold">Сообщество и заработок</div>
                <p className="text-sm text-muted mt-1">Публикуйте работы и получайте бонусы за приглашения.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============ ЦЕНЫ ============ */}
        <section id="pricing" className="section-solid" style={{display: 'none'}}>
          <div className="max-w-7xl mx-auto px-6 py-24">
            <div className="text-center mb-14">
              <div className="badge mb-3">Тарифы</div>
              <h2 className="text-4xl lg:text-5xl font-bold tracking-tight">Прозрачные цены</h2>
              <p className="text-muted mt-3">Внутренняя валюта — neiron-coin. Тратьте только на то, что создаёте.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
              <div className="glass rounded-2xl p-7 flex flex-col">
                <div className="font-semibold uppercase text-xs tracking-wider text-muted">Free</div>
                <div className="mt-4 flex items-end gap-2">
                  <div className="text-5xl font-bold">240</div>
                  <div className="text-sm text-muted mb-1">coin / старт</div>
                </div>
                <p className="text-sm text-muted mt-2">Чтобы попробовать без вложений.</p>
                <ul className="mt-6 space-y-2 text-sm">
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span> Фото-генерация</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span> AI-чат</li>
                  <li className="flex gap-2 text-muted"><span>·</span> Без видео и аудио</li>
                </ul>
                <div className="mt-auto pt-6">
                  <Link to="/login" className="btn-ghost w-full h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center">Начать</Link>
                </div>
              </div>

              <div className="rounded-2xl p-7 flex flex-col relative shadow-2xl scale-[1.02]" style={{ background: 'var(--color-brand)', color: 'var(--color-on-brand)' }}>
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 badge" style={{ background: '#0f0f0f', color: '#f5f4f0', borderColor: 'rgba(255,255,255,0.2)' }}>★ Популярный</div>
                <div className="font-semibold uppercase text-xs tracking-wider opacity-60">Pro</div>
                <div className="mt-4 flex items-end gap-2">
                  <div className="text-5xl font-bold">2 500</div>
                  <div className="text-sm opacity-60 mb-1">coin / мес</div>
                </div>
                <p className="text-sm opacity-70 mt-2">Для регулярной работы и продакшна.</p>
                <ul className="mt-6 space-y-2 text-sm">
                  <li className="flex gap-2"><span>✓</span> Всё из Free</li>
                  <li className="flex gap-2"><span>✓</span> Видео и музыка</li>
                  <li className="flex gap-2"><span>✓</span> 4K качество</li>
                  <li className="flex gap-2"><span>✓</span> Приватные генерации</li>
                </ul>
                <div className="mt-auto pt-6">
                  <Link to="/login" className="w-full h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center" style={{ background: '#0f0f0f', color: '#f5f4f0' }}>Подключить Pro</Link>
                </div>
              </div>

              <div className="glass rounded-2xl p-7 flex flex-col">
                <div className="font-semibold uppercase text-xs tracking-wider text-muted">Studio</div>
                <div className="mt-4 flex items-end gap-2">
                  <div className="text-5xl font-bold">10K</div>
                  <div className="text-sm text-muted mb-1">coin / мес</div>
                </div>
                <p className="text-sm text-muted mt-2">Команды, агентства, контент-фабрики.</p>
                <ul className="mt-6 space-y-2 text-sm">
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span> Всё из Pro</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span> Приоритетная очередь</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span> API-доступ</li>
                  <li className="flex gap-2"><span className="text-emerald-400">✓</span> Персональный менеджер</li>
                </ul>
                <div className="mt-auto pt-6">
                  <Link to="/login" className="btn-ghost w-full h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center">Связаться</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section id="partners" className="section-solid border-y border-[var(--color-brand-light)]">
          <div className="max-w-4xl mx-auto px-6 py-24">
            <div className="badge mb-3">FAQ</div>
            <h2 className="text-4xl lg:text-5xl font-bold tracking-tight mb-10">Часто спрашивают</h2>

            <div className="divide-y divide-[var(--color-brand-light)]">
              {LANDING_FAQ_ITEMS.map((item) => {
                const isOpen = openFaqIds.includes(item.id)
                return (
                  <div key={item.id} className="py-5">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenFaqIds((prev) =>
                          prev.includes(item.id)
                            ? prev.filter((id) => id !== item.id)
                            : [...prev, item.id]
                        )
                      }
                      className="w-full flex items-center justify-between cursor-pointer text-lg font-semibold text-left"
                    >
                      {item.question}
                      <span className={`faq-plus text-muted text-2xl leading-none ${isOpen ? 'open' : ''}`}>+</span>
                    </button>
                    <div className={`faq-panel ${isOpen ? 'open' : ''}`}>
                      <div className="faq-panel-inner">
                        <p className="faq-answer text-muted text-sm leading-relaxed">{item.answer}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ============ ФИНАЛЬНЫЙ CTA ============ */}
        <section className="relative overflow-hidden section-solid">
          <div className="aurora aurora-1" style={{ width: 600, height: 600, bottom: -200, left: -100, background: 'rgba(255,255,255,.12)' }}></div>
          <div className="aurora aurora-2" style={{ width: 520, height: 520, top: -150, right: -120, background: 'rgba(120,151,142,.18)' }}></div>

          <div className="max-w-4xl mx-auto px-6 py-32 text-center relative">
            <h2 className="text-5xl lg:text-7xl font-bold tracking-tight">Готовы попробовать?</h2>
            <p className="text-muted text-lg mt-6 max-w-xl mx-auto">Несколько генераций сразу после регистрации. Без карты.</p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/login" className="btn-primary h-14 px-8 rounded-full text-base font-semibold inline-flex items-center gap-2">
                Начать бесплатно
                <span aria-hidden="true">→</span>
              </Link>
              <Link to="/login" className="btn-ghost h-14 px-8 rounded-full text-base font-semibold inline-flex items-center gap-2">
                Войти через Telegram
              </Link>
            </div>
          </div>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="section-solid border-t border-[var(--color-brand-light)]">
          <div className="max-w-7xl mx-auto px-6 py-14 grid md:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2 font-bold">
                <div className="h-7 w-7 rounded-lg bg-brand grid place-items-center">
                  <img src="../../favicon.png" alt="" />
                </div>
                NEIRON
              </div>
              <p className="text-sm text-muted mt-3 max-w-xs">AI-генерация фото, видео, музыки и чат. На русском, без VPN.</p>
            </div>
            <div>
              <div className="text-sm font-semibold mb-3">Продукт</div>
              <ul className="space-y-2 text-sm text-muted">
                <li><a href="#features" className="hover:text-brand transition-colors">Возможности</a></li>
                <li><a href="#models" className="hover:text-brand transition-colors">Модели</a></li>
                <li>
                  <a
                    href="https://t.me/NeironAiBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand transition-colors"
                  >
                    Telegram-бот
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-semibold mb-3">Сообщество</div>
              <ul className="space-y-2 text-sm text-muted">
                <li><a href="#community" className="hover:text-brand transition-colors">Лента работ</a></li>
                <li>
                  <a
                    href="https://t.me/neironsup"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-brand transition-colors"
                  >
                    Поддержка
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-sm font-semibold mb-3">Юр. информация</div>
              <ul className="space-y-2 text-sm text-muted">
                <li><Link to="/terms" className="hover:text-brand transition-colors">Условия использования</Link></li>
                <li><Link to="/privacy" className="hover:text-brand transition-colors">Конфиденциальность</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[var(--color-brand-light)] text-xs text-muted-soft text-center py-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span>© 2026 NEIRON</span>
            <span className="text-[var(--color-brand-light)]" aria-hidden="true">
              ·
            </span>
            <span className="font-medium text-muted tracking-wide">Verify</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
