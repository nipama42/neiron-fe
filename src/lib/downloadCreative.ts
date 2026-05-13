/**
 * Скачивание результата генерации. Сначала API-прокси (без CORS с CDN), иначе прямой fetch, иначе открытие URL.
 */
const _viteApi = import.meta.env.VITE_API_URL
const API_BASE =
  typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim().replace(/\/+$/, '') : ''

function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return Boolean(window.Telegram?.WebApp?.platform?.trim?.())
  } catch {
    return false
  }
}

/** Закрытие системного «Поделиться» без выбора действия — не открывать blob/новую вкладку. */
function isShareCanceledError(e: unknown): boolean {
  if (e == null || typeof e !== 'object') return false
  const name = 'name' in e && typeof (e as { name?: unknown }).name === 'string' ? (e as { name: string }).name : ''
  return name === 'AbortError' || name === 'NotAllowedError'
}

/** Скачивание штатным API Mini App — иначе ссылка открывается как превью и «выбивает» WebView. */
function tryTelegramWebAppDownload(url: string): boolean {
  const raw = String(url || '').trim()
  if (!raw.startsWith('https://')) return false
  const fn = window.Telegram?.WebApp?.downloadFile
  if (typeof fn !== 'function') return false
  try {
    void fn.call(window.Telegram!.WebApp, { url: raw })
    return true
  } catch {
    return false
  }
}

function sanitizeBase(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60) || 'neiro'
}

function extFromPath(url: string): string | null {
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.href : 'https://local.invalid')
    const last = u.pathname.split('/').pop() || ''
    const m = last.match(/\.([a-z0-9]+)$/i)
    if (m) return m[1]!.toLowerCase()
  } catch {
    /* ignore */
  }
  return null
}

function defaultExtForMode(mode: string): string {
  switch (mode) {
    case 'photo':
      return 'jpg'
    case 'video':
      return 'mp4'
    case 'music':
    case 'audio':
      return 'mp3'
    default:
      return 'bin'
  }
}

function parseFilenameFromContentDisposition(cd: string | null): string | null {
  if (!cd) return null
  const star = /filename\*=UTF-8''([^;\s]+)/i.exec(cd)
  if (star) {
    try {
      return decodeURIComponent(star[1]!.replace(/["']/g, ''))
    } catch {
      return null
    }
  }
  const quoted = /filename="([^"]+)"/.exec(cd)
  if (quoted) return quoted[1]!
  const plain = /filename=([^;\s]+)/.exec(cd)
  if (plain) return plain[1]!.replace(/["']/g, '')
  return null
}

async function fetchBlobViaApi(
  id: string,
  fallbackFilename: string
): Promise<{ blob: Blob; filename: string } | null> {
  const path = API_BASE
    ? `${API_BASE}/public/generations/${encodeURIComponent(id)}/file`
    : `/public/generations/${encodeURIComponent(id)}/file`
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : sessionStorage.getItem('token')
  const headers: HeadersInit = {}
  if (token && token !== 'local-dev') {
    headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(path, { headers })
  if (!res.ok) return null
  const fromHeader = parseFilenameFromContentDisposition(res.headers.get('Content-Disposition'))
  const filename = fromHeader && fromHeader.trim() ? fromHeader : fallbackFilename
  const blob = await res.blob()
  if (!blob || blob.size === 0) return null
  return { blob, filename }
}

/**
 * Web Share с файлом на десктопе с мышью открывает «Поделиться», а не «Загрузки».
 * На телефонах share даёт «Сохранить изображение» и не уводит WebView на полноэкранный blob:.
 */
function isDesktopMousePrimary(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(pointer: fine) and (hover: hover)').matches
  } catch {
    return false
  }
}

function shouldOfferNavigatorShareForFile(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  if (!('share' in navigator) || !('canShare' in navigator)) return false
  if (isDesktopMousePrimary()) return false
  return true
}

async function offerBlobDownload(
  blob: Blob,
  filename: string,
  opts?: { telegramFallbackHttps?: string }
): Promise<void> {
  const tg = String(opts?.telegramFallbackHttps || '').trim()

  // В Mini App сначала нативное скачивание — иначе после отмены «Поделиться» срабатывал blob+_blank и фото на весь экран.
  if (isTelegramWebApp() && tg.startsWith('https://') && tryTelegramWebAppDownload(tg)) {
    return
  }

  if (shouldOfferNavigatorShareForFile()) {
    try {
      const file = new File([blob], filename, { type: blob.type || `application/octet-stream` })
      const anyNav = navigator as Navigator & {
        share?: (d: ShareData) => Promise<void>
        canShare?: (d: ShareData) => boolean
      }
      const shareData: ShareData = { files: [file], title: filename }
      if (anyNav.canShare?.(shareData)) {
        await anyNav.share!(shareData)
        return
      }
    } catch (e) {
      if (isShareCanceledError(e)) return
      /* прочие ошибки — ниже anchor */
    }
  }

  const objectUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    a.rel = 'noopener'
    // На телефонах без новой вкладки WebKit/Telegram WebView часто открывает blob: на весь экран вместо загрузки.
    if (!isDesktopMousePrimary()) {
      a.target = '_blank'
    }
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function downloadCreativeFile(
  url: string,
  options: { mode: string; id: string; label?: string | null }
): Promise<void> {
  const raw = String(url || '').trim()
  if (!raw) return

  const fromPath = extFromPath(raw)
  const ext = fromPath && fromPath.length <= 5 ? fromPath : defaultExtForMode(String(options.mode || ''))
  const base =
    sanitizeBase(
      (options.label || 'creative').replace(/^[^a-zA-Zа-яА-Я0-9]+/u, '') || `neiro-${options.id.slice(0, 8)}`
    ) + `-${options.id.slice(0, 8)}`
  const filename = `${base}.${ext}`

  const triggerAnchor = (href: string, downloadName: string) => {
    const a = document.createElement('a')
    a.href = href
    a.download = downloadName
    a.rel = 'noopener noreferrer'
    if (!isDesktopMousePrimary()) {
      a.target = '_blank'
    }
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (options.id) {
    try {
      const via = await fetchBlobViaApi(String(options.id).trim(), filename)
      if (via) {
        await offerBlobDownload(via.blob, via.filename, { telegramFallbackHttps: raw })
        return
      }
    } catch {
      /* try direct */
    }
  }

  try {
    const res = await fetch(raw, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    await offerBlobDownload(blob, filename, { telegramFallbackHttps: raw })
  } catch {
    if (tryTelegramWebAppDownload(raw)) return
    try {
      triggerAnchor(raw, filename)
    } catch {
      if (!isTelegramWebApp()) {
        window.open(raw, '_blank', 'noopener,noreferrer')
      }
    }
  }
}
