import { useEffect, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay } from 'swiper/modules'
import type { Swiper as SwiperType } from 'swiper'
import 'swiper/css'

interface BannerItem {
  slot: number
  imageUrl: string
  linkUrl: string | null
}

const PLACEHOLDER_BANNERS = [
  {
    slot: 1,
    title: 'Создавай с нейросетями',
    subtitle: 'Фото, видео, аудио — всё в одном месте',
    gradient: 'from-zinc-900 via-neutral-800 to-zinc-950',
  },
  {
    slot: 2,
    title: 'Новые инструменты',
    subtitle: 'Следите за обновлениями',
    gradient: 'from-neutral-900 via-zinc-800 to-slate-950',
  },
  {
    slot: 3,
    title: 'Лучшие работы недели',
    subtitle: 'Рейтинг по лайкам',
    gradient: 'from-slate-900 via-neutral-800 to-zinc-950',
  },
]

export default function BannerCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [swiper, setSwiper] = useState<SwiperType | null>(null)
  const [apiBanners, setApiBanners] = useState<BannerItem[] | null>(null)
  const [failedSlots, setFailedSlots] = useState<Set<number>>(new Set())

  useEffect(() => {
    let mounted = true
    const apiBase = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? ''

    async function tryLoad(attempt: number) {
      try {
        const r = await fetch(`${apiBase}/banners`)
        if (!r.ok) throw new Error(`${r.status}`)
        const d = await r.json() as { banners: BannerItem[] }
        if (!mounted) return
        if (d?.banners?.length) {
          setApiBanners(d.banners)
        } else if (attempt < 3) {
          setTimeout(() => tryLoad(attempt + 1), 1500 * attempt)
        }
      } catch {
        if (mounted && attempt < 3) {
          setTimeout(() => tryLoad(attempt + 1), 1500 * attempt)
        }
      }
    }
    tryLoad(1)
    return () => { mounted = false }
  }, [])

  const hasApiBanners = apiBanners && apiBanners.length > 0

  /** Высота: мобильный → планшет → десктоп (главная в браузере чуть выше и ниже по вертикали) */
  const slideHeight =
    'h-[9.5rem] sm:h-40 lg:h-[13rem] xl:h-[13.5rem]'

  return (
    <div className="w-full lg:mt-0 lg:pt-0">
      <Swiper
        modules={[Autoplay]}
        autoplay={{ delay: 5200, disableOnInteraction: false }}
        loop
        onSwiper={setSwiper}
        onSlideChange={(s) => setActiveIndex(s.realIndex)}
        className="rounded-2xl shadow-md ring-1 ring-black/5 dark:ring-white/10 overflow-hidden"
      >
        {hasApiBanners
          ? apiBanners.map((b) => (
            <SwiperSlide key={b.slot}>
              <a
                href={b.linkUrl ?? undefined}
                target={b.linkUrl ? '_blank' : undefined}
                rel={b.linkUrl ? 'noopener noreferrer' : undefined}
                className={`block relative ${slideHeight} bg-zinc-900 overflow-hidden${b.linkUrl ? ' cursor-pointer' : ''}`}
              >
                {!failedSlots.has(b.slot) ? (
                  <img
                    src={b.imageUrl}
                    alt={`Баннер ${b.slot}`}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={() => setFailedSlots((prev) => new Set([...prev, b.slot]))}
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-neutral-800 to-zinc-950" />
                )}
              </a>
            </SwiperSlide>
          ))
          : PLACEHOLDER_BANNERS.map((b) => (
            <SwiperSlide key={b.slot}>
              <div
                className={`relative ${slideHeight} bg-gradient-to-br ${b.gradient} px-5 py-4 flex flex-col justify-end`}
              >
                <div className="absolute inset-0 bg-black/10 pointer-events-none" />
                <p className="relative text-white font-semibold text-base sm:text-lg leading-snug drop-shadow-sm">
                  {b.title}
                </p>
                <p className="relative text-white/85 text-xs sm:text-sm mt-1 drop-shadow-sm">
                  {b.subtitle}
                </p>
              </div>
            </SwiperSlide>
          ))}
      </Swiper>
      <div className="banner-pagination">
        {(hasApiBanners ? apiBanners : PLACEHOLDER_BANNERS).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Слайд ${i + 1}`}
            onClick={() => swiper?.slideToLoop(i)}
            className={`banner-pagination-bullet${i === activeIndex ? ' active' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
