import { useEffect, useState } from 'react'
import LegalPageLayout from '../components/LegalPageLayout'
import { getPublicSitePage } from '../api/sitePages'
import { usePageSeo } from '../lib/seo'
import TermsDefaultArticle from './legal/TermsDefaultArticle'

export default function TermsOfServicePage() {
  const [customHtml, setCustomHtml] = useState<string | null>(null)
  const [customTitle, setCustomTitle] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  usePageSeo({
    title: ready && customTitle ? `${customTitle} — NEIRON` : 'Условия использования — NEIRON',
    description: 'Условия использования сервиса NEIRON: права, обязанности пользователей и правила генерации контента с ИИ.',
    canonicalPath: '/terms',
  })

  useEffect(() => {
    getPublicSitePage('terms')
      .then((p) => {
        const h = (p.bodyHtml ?? '').trim()
        setCustomHtml(h ? h : null)
        setCustomTitle((p.title ?? '').trim() || null)
      })
      .catch(() => {
        setCustomHtml(null)
        setCustomTitle(null)
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
      {customHtml ? (
        <article className="space-y-6 text-sm leading-relaxed text-[var(--color-brand)]/90">
          {customTitle ? (
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-brand)] tracking-tight">{customTitle}</h1>
          ) : null}
          <div className="cms-legal" dangerouslySetInnerHTML={{ __html: customHtml }} />
        </article>
      ) : (
        <TermsDefaultArticle />
      )}
    </LegalPageLayout>
  )
}
