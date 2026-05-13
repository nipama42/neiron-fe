import type { AuthUser } from '../api/auth'

/** Сегмент /profile/author/:ref — как в ленте. */
export function publicProfilePathRef(u: AuthUser): string {
  const tag = u.publicTag?.trim()
  if (tag) return `@${tag}`
  return u.id
}

/** Каноническая ссылка: браузер и обычный веб. */
export function publicProfileWebUrl(u: AuthUser | null): string | null {
  if (!u?.id) return null
  const ref = publicProfilePathRef(u)
  if (typeof window === 'undefined') return null
  return `${window.location.origin}/profile/author/${encodeURIComponent(ref)}`
}

/**
 * Ссылка для Mini App в Telegram: открывает приложение в клиенте.
 * Задайте VITE_TELEGRAM_BOT_USERNAME (без @) и VITE_TELEGRAM_WEBAPP_SHORT_NAME (как в BotFather).
 */
export function publicProfileTelegramMiniAppUrl(u: AuthUser | null): string | null {
  if (!u?.id) return null
  const rawBot = String(
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TELEGRAM_BOT_USERNAME ?? ''
  ).trim()
  const shortName = String(
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TELEGRAM_WEBAPP_SHORT_NAME ?? ''
  ).trim()
  if (!rawBot || !shortName) return null
  const bot = rawBot.replace(/^@/, '')
  const ref = publicProfilePathRef(u)
  const startapp = `pa_${encodeURIComponent(ref)}`
  return `https://t.me/${bot}/${shortName}?startapp=${encodeURIComponent(startapp)}`
}

/** Декодирование start_param для редиректа в приложении. */
export function parseProfileStartParam(startParam: string | undefined): string | null {
  if (!startParam || typeof startParam !== 'string') return null
  const sp = startParam.trim()
  if (!sp.startsWith('pa_')) return null
  try {
    const decoded = decodeURIComponent(sp.slice(3))
    return decoded || null
  } catch {
    return null
  }
}
