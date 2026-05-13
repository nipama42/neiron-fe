import { useEffect, useState } from 'react'
import LegalPageLayout from '../components/LegalPageLayout'
import { getPublicSitePage } from '../api/sitePages'
import PrivacyDefaultArticle from './legal/PrivacyDefaultArticle'

export default function PrivacyPolicyPage() {
  const [title, setTitle] = useState('Политика конфиденциальности')
  const [bodyHtml, setBodyHtml] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    getPublicSitePage('privacy')
      .then((p) => {
        setTitle((p.title ?? '').trim() || 'Политика конфиденциальности')
        const h = (p.bodyHtml ?? '').trim()
        setBodyHtml(h ? h : null)
      })
      .catch(() => {
        setTitle('Политика конфиденциальности')
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
      {bodyHtml ? (
        <article className="space-y-6 text-sm leading-relaxed text-[var(--color-brand)]/90">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-brand)] tracking-tight">{title}</h1>
          <div className="cms-legal" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </article>
      ) : (
        <PrivacyDefaultArticle />
      )}
    </LegalPageLayout>
  )
}
