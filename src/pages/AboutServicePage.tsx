import { useEffect, useState } from 'react'
import LegalPageLayout from '../components/LegalPageLayout'
import { getPublicSitePage } from '../api/sitePages'
import { usePageSeo } from '../lib/seo'

export default function AboutServicePage() {
  const [title, setTitle] = useState('О сервисе')
  const [bodyHtml, setBodyHtml] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  usePageSeo({
    title: ready ? `${title} — NEIRON` : 'О сервисе — NEIRON',
    description:
      'NEIRON — платформа для генерации фото, видео и музыки с помощью ИИ: Nano Banana, GPT Image 2, Kling, Google Veo 3 и другие модели.',
    canonicalPath: '/about',
  })

  useEffect(() => {
    getPublicSitePage('about')
      .then((p) => {
        setTitle((p.title ?? '').trim() || 'О сервисе')
        const h = (p.bodyHtml ?? '').trim()
        setBodyHtml(h || null)
      })
      .catch(() => {
        setTitle('О сервисе')
        setBodyHtml(null)
      })
      .finally(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <LegalPageLayout>
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-brand)] border-t-transparent animate-spin" />
        </div>
      </LegalPageLayout>
    )
  }

  return (
    <LegalPageLayout>
      <article className="space-y-6 text-sm leading-relaxed text-[var(--color-brand)]/90">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-brand)] tracking-tight">{title}</h1>
        {bodyHtml ? (
          <div className="cms-legal" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        ) : (
          <p className="text-[var(--color-muted)]">
            Здесь будет описание сервиса. Текст можно задать в админ-панели во вкладке «Сайт».
          </p>
        )}
      </article>
    </LegalPageLayout>
  )
}
