import { useEffect } from 'react'
import { LANDING_FAQ_ITEMS } from './landingFaq'

/** Канонический origin сайта (без завершающего слеша). */
export const SITE_ORIGIN = 'https://neiron.space'

export const DEFAULT_PAGE_TITLE =
  'NEIRON — Нано Банана, GPT Image 2, Kling, Veo 3 и другие нейросети'

export const DEFAULT_PAGE_DESCRIPTION =
  'Нано Банана, Нано Банана 2, Нано Банана Про, GPT Image 2, Клинг, Google Veo 3 — фото, видео и музыка с ИИ в одном сервисе. Публичная лента, профили, бонусы.'

export const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/mainlogo.png`

export type PageSeoOptions = {
  title?: string
  description?: string
  /** Путь для canonical и og:url, например `/about`. */
  canonicalPath?: string
  noindex?: boolean
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`
  let el = document.querySelector(selector) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function upsertCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

export function absoluteUrl(path: string): string {
  if (!path || path === '/') return `${SITE_ORIGIN}/`
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${SITE_ORIGIN}${normalized}`
}

/** Обновляет title, description, OG/Twitter и canonical в `<head>` (SPA). */
export function usePageSeo({
  title,
  description,
  canonicalPath,
  noindex = false,
}: PageSeoOptions) {
  const resolvedTitle = title ?? DEFAULT_PAGE_TITLE
  const resolvedDescription = description ?? DEFAULT_PAGE_DESCRIPTION
  const canonicalHref = canonicalPath ? absoluteUrl(canonicalPath) : absoluteUrl('/')

  useEffect(() => {
    document.title = resolvedTitle
    upsertMeta('name', 'description', resolvedDescription)
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow')
    upsertCanonical(canonicalHref)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:site_name', 'NEIRON')
    upsertMeta('property', 'og:locale', 'ru_RU')
    upsertMeta('property', 'og:url', canonicalHref)
    upsertMeta('property', 'og:title', resolvedTitle)
    upsertMeta('property', 'og:description', resolvedDescription)
    upsertMeta('property', 'og:image', DEFAULT_OG_IMAGE)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', resolvedTitle)
    upsertMeta('name', 'twitter:description', resolvedDescription)
    upsertMeta('name', 'twitter:image', DEFAULT_OG_IMAGE)
  }, [resolvedTitle, resolvedDescription, canonicalHref, noindex])
}

export function buildLandingJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'NEIRON',
        url: `${SITE_ORIGIN}/`,
        inLanguage: 'ru-RU',
      },
      {
        '@type': 'Organization',
        name: 'NEIRON',
        url: `${SITE_ORIGIN}/`,
        logo: DEFAULT_OG_IMAGE,
      },
      {
        '@type': 'FAQPage',
        mainEntity: LANDING_FAQ_ITEMS.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      },
    ],
  }
}
