/** Минимум полей для показа фото + резервного webp (лог, публичная карточка, лента). */
export type GenerationMediaLike = {
  mode?: string
  resultDisplayUrl?: string | null
  resultUrl?: string | null
  media?: unknown
}

function readMedia(entry: GenerationMediaLike | null | undefined) {
  const m = entry?.media
  if (!m || typeof m !== 'object') return {}
  const rec = m as Record<string, unknown>
  const image = rec.image
  const webUrl =
    image && typeof image === 'object' && typeof (image as Record<string, unknown>).webUrl === 'string'
      ? ((image as Record<string, unknown>).webUrl as string).trim()
      : ''
  return { webUrl }
}

/** Сжатый CDN/WebP после optimize (DigitalOcean / локально). */
export function generationPhotoOptimizedUrl(entry: GenerationMediaLike | null | undefined): string {
  const w = readMedia(entry).webUrl
  return w || ''
}

/**
 * Основной URL показа (часто временный Kie) и запасной (хранилище), если они разные.
 */
export function generationPhotoSrcPair(entry: GenerationMediaLike | null | undefined): {
  primary: string
  fallback?: string
} | null {
  if (!entry || String(entry.mode) !== 'photo') return null
  const compressed = generationPhotoOptimizedUrl(entry)
  const primaryRaw = (
    typeof entry.resultDisplayUrl === 'string' ? entry.resultDisplayUrl : ''
  ).trim() || (typeof entry.resultUrl === 'string' ? entry.resultUrl : '').trim()

  const primary = primaryRaw || compressed
  if (!primary) return null
  if (!compressed || compressed === primary) return { primary }
  return { primary, fallback: compressed }
}

/**
 * Однократно качает WebP из CDN сразу после готовности (без авторизации через API).
 */
export async function triggerOptimizedPhotoDownload(compactUrl: string, generationId: string): Promise<boolean> {
  try {
    const res = await fetch(compactUrl, { mode: 'cors', credentials: 'omit', cache: 'no-store' })
    if (!res.ok) return false
    const blob = await res.blob()
    const u = URL.createObjectURL(blob)
    const safeId = generationId.replace(/-/g, '').slice(0, 12)
    const a = document.createElement('a')
    a.href = u
    a.download = `neiro-${safeId}.webp`
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(u), 20_000)
    return true
  } catch {
    return false
  }
}
