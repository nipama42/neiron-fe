/**
 * Подписи «качества» для истории и публичных карточек.
 * Для видео `std` не равно фото «1K» — учитываем modelId.
 */
export function qualityUiLabel(value: string | null | undefined, modelId?: string | null): string {
  const q = String(value ?? '').trim().toLowerCase()
  const m = String(modelId ?? '')
  if (!q) return '—'
  if (q === 'std') {
    if (m === 'kie-kling-21-std') return '720p'
    if (m === 'kie-kling-21-pro') return '1080p'
    if (m === 'kie-kling-26') return '720p (API)'
    if (m === 'kie-kling-25-turbo') return 'Turbo'
    if (m === 'kie-openai-sora-2') return 'Sora 2'
    if (m === 'kie-kling-30') return '720p (Std)'
    return '1K'
  }
  if (q === 'pro' && m === 'kie-kling-30') return '1080p (Pro)'
  if (m === 'kie-google-veo-31') {
    if (q === '720p' || q === 'lite') return '720p'
    if (q === '1080p' || q === 'fast' || q === 'quality') return '1080p'
  }
  if (q === 'lite') return 'Lite 720p'
  if (q === 'fast') return 'Fast 1080p'
  if (q === 'quality') return 'Quality 1080p'
  if (q === 'high') return '4K'
  if (q === '2k') return '2K'
  if (q === '4k') return '4K'
  if (q === '1k') return '1K'
  if (q === 'nb2-1k') return '1K'
  if (q === 'nb2-2k') return '2K'
  if (q === 'nb2-4k') return '4K'
  if (q === 'nbp-12k') return '2K'
  if (q === 'nbp-4k') return '4K'
  if (q === 'f2p-1k') return '1K'
  if (q === 'f2p-2k') return '2K'
  return String(value)
}
