/** Ключ уровня цены = значение качества из UI (как server kiePhotoPricesService.kiePhotoPriceTierKey). */
export function kiePhotoPriceTierKey(modelId: string, quality: string): string {
  const q = String(quality ?? '').toLowerCase()
  if (modelId === 'kie-nano-banana-2') {
    if (q === 'nb2-4k' || q === '4k') return 'nb2-4k'
    if (q === 'nb2-2k' || q === '2k') return 'nb2-2k'
    return 'nb2-1k'
  }
  if (modelId === 'kie-nano-banana-pro') {
    if (q === 'nbp-4k' || q === '4k') return 'nbp-4k'
    return 'nbp-12k'
  }
  if (modelId === 'kie-flux-2-pro') {
    if (q === 'f2p-2k' || q === '2k') return 'f2p-2k'
    return 'f2p-1k'
  }
  if (modelId === 'kie-gpt-image-2') {
    if (q === 'high' || q === '4k') return 'high'
    if (q === '2k') return '2k'
    return 'std'
  }
  if (
    modelId === 'kie-wan-27' ||
    modelId === 'kie-wan-27-pro' ||
    modelId === 'kie-seedream-45' ||
    modelId === 'kie-qwen2-image' ||
    modelId === 'kie-seedream-50-lite'
  ) {
    if (q === 'high' || q === '4k') return 'high'
    return 'std'
  }
  if (modelId === 'kie-suno') {
    const u = String(quality ?? 'V4_5PLUS')
      .toUpperCase()
      .replace(/-/g, '_')
    if (u === 'V5') return 'V5'
    return 'V4_5PLUS'
  }
  return '*'
}

export type KiePhotoPriceEntry = { modelId: string; qualityKey: string; coins: number }

/** Цена из ответа GET /kie-photo-prices (после загрузки с сервера). */
export function kiePhotoCostFromEntries(
  entries: KiePhotoPriceEntry[] | null | undefined,
  modelId: string,
  quality: string
): number | null {
  if (!entries?.length) return null
  const tier = kiePhotoPriceTierKey(modelId, quality)
  const exact = entries.find((e) => e.modelId === modelId && e.qualityKey === tier)
  if (exact) return exact.coins
  const star = entries.find((e) => e.modelId === modelId && e.qualityKey === '*')
  return star ? star.coins : null
}

/**
 * Списание в монетах для Kie-фото (fallback, если сервер ещё не отдал прайс).
 * Должно совпадать с server/src/services/kiePhotoCatalog.js.
 */
export function kiePhotoCostCoins(modelId: string, quality: string): number | null {
  switch (modelId) {
    case 'kie-gpt-image-2':
      return 40
    case 'kie-wan-27':
      return 20
    case 'kie-wan-27-pro':
      return 40
    case 'kie-seedream-45':
      return 20
    case 'kie-qwen2-image':
      return 15
    case 'kie-nano-banana-2': {
      const s = String(quality || 'nb2-1k').toLowerCase()
      if (s === 'nb2-4k' || s === '4k') return 20
      if (s === 'nb2-2k' || s === '2k') return 15
      return 10
    }
    case 'kie-nano-banana-pro': {
      const s = String(quality || 'nbp-12k').toLowerCase()
      if (s === 'nbp-4k' || s === '4k') return 30
      return 25
    }
    case 'kie-seedream-50-lite':
      return 7
    case 'kie-flux-2-pro': {
      const s = String(quality || 'f2p-1k').toLowerCase()
      if (s === 'f2p-2k' || s === '2k') return 12
      return 8
    }
    case 'kie-suno': {
      const s = String(quality || 'V4_5PLUS')
        .toUpperCase()
        .replace(/-/g, '_')
      if (s === 'V5') return 80
      return 70
    }
    default:
      return null
  }
}
