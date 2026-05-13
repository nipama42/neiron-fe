/**
 * Соцссылки профиля (дублирует логику server/src/profileUrlValidate.js) — до отправки на API.
 */
const HTTPS = /^https:\/\//i

function parseUrl(s: string): { ok: true; url: URL } | { ok: false; message: string } {
  if (!s.trim()) return { ok: false, message: 'Пусто' }
  if (!HTTPS.test(s)) return { ok: false, message: 'Нужен адрес, начинающийся с https://' }
  let url: URL
  try {
    url = new URL(s.trim())
  } catch {
    return { ok: false, message: 'Некорректный адрес' }
  }
  if (url.protocol !== 'https:') return { ok: false, message: 'Только https://' }
  return { ok: true, url }
}

export function validateInstagramField(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const p = parseUrl(t)
  if (!p.ok) return p.message
  const h = p.url.hostname.toLowerCase()
  if (h === 'instagram.com' || h === 'www.instagram.com' || h === 'm.instagram.com') return null
  return 'Только ссылка на Instagram (instagram.com …)'
}

export function validateTelegramField(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const p = parseUrl(t)
  if (!p.ok) return p.message
  const h = p.url.hostname.toLowerCase()
  if (h === 't.me' || h === 'telegram.me') return null
  return 'Только ссылка t.me/… или telegram.me/…'
}
