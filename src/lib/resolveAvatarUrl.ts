const _api = import.meta.env.VITE_API_URL
const API_BASE = typeof _api === 'string' && _api.trim() !== '' ? _api.trim().replace(/\/+$/, '') : ''

function originForRequest(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

function isTelegramImageHost(h: string): boolean {
  return (
    h === 'api.telegram.org' ||
    h.endsWith('.cdn.telegram.org') ||
    h.endsWith('.telegram-cdn.org') ||
    /^cdn[0-9]*\.telesco\.pe$/i.test(h)
  )
}

/**
 * Политика referrer для <img> аватаров.
 * Прокси `/public/avatar-proxy` — тот же сайт; `no-referrer` на iOS Safari иногда давал пустые превью.
 */
export function avatarReferrerPolicy(_resolvedSrc: string | null | undefined): undefined {
  return undefined
}

/**
 * URL для <img> аватара: /public/avatars/ — относительный путь (тот же origin вкладки);
 * Telegram CDN — через /public/avatar-proxy на бэке.
 */
export function resolveAvatarUrl(url: string | null | undefined): string | null {
  if (url == null) return null
  const s = String(url).trim()
  if (!s) return null
  if (s.startsWith('data:') || s.startsWith('blob:')) return s
  if (s.startsWith('/public/avatars/')) {
    return s
  }
  let parsed: URL
  try {
    parsed = new URL(s)
  } catch {
    return s
  }
  if (parsed.pathname.startsWith('/public/avatars/') && (parsed.protocol === 'https:' || parsed.protocol === 'http:')) {
    return `${parsed.pathname}${parsed.search}`
  }
  const h = parsed.hostname
  if (isTelegramImageHost(h)) {
    const base = (API_BASE || originForRequest()).replace(/\/+$/, '')
    const q = `url=${encodeURIComponent(s)}`
    // Всегда через прокси (прямой Telegram CDN с Referer сайта часто пустой в мобильном Safari).
    if (base) return `${base}/public/avatar-proxy?${q}`
    return `/public/avatar-proxy?${q}`
  }
  return s
}
