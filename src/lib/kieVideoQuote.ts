function normalizeDurationToken(raw: string): string {
  const s = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return ''
  const n = Number(s.replace(/[^\d]/g, ''))
  if (Number.isFinite(n) && n > 0) return String(Math.round(n))
  return s
}

/**
 * Builds tier key in the form "720p@5".
 * Accepts two calling conventions:
 *   kieVideoPriceTierKey(quality, duration)            — 2 args
 *   kieVideoPriceTierKey(modelId, quality, duration)   — 3 args (modelId is ignored, kept for compat)
 */
export function kieVideoPriceTierKey(
  qualityOrModelId: string,
  qualityOrDuration: string,
  durationMaybe?: string
): string {
  const quality = durationMaybe !== undefined ? qualityOrDuration : qualityOrModelId
  const duration = durationMaybe !== undefined ? durationMaybe : qualityOrDuration
  const q = String(quality ?? '').trim().toLowerCase() || '720p'
  const d = normalizeDurationToken(String(duration ?? '').trim()) || '5'
  return `${q}@${d}`
}

export type KieVideoPriceEntry = { modelId: string; tierKey: string; coins: number }

export function kieVideoCostFromEntries(
  entries: KieVideoPriceEntry[] | null | undefined,
  modelId: string,
  quality: string,
  duration: string
): number | null {
  if (!entries?.length) return null
  const tier = kieVideoPriceTierKey(quality, duration).trim().toLowerCase()
  const model = String(modelId ?? '').trim().toLowerCase()
  const exact = entries.find(
    (e) =>
      String(e.modelId ?? '').trim().toLowerCase() === model &&
      String(e.tierKey ?? '').trim().toLowerCase() === tier
  )
  if (exact) return exact.coins
  return null
}
