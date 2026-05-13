import type { KieVideoPriceEntry } from '../lib/kieVideoQuote'

const _viteApi = import.meta.env.VITE_API_URL
const API_BASE = typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim() : ''

function normalizeEntry(raw: unknown): KieVideoPriceEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as { modelId?: unknown; tierKey?: unknown; coins?: unknown }
  const modelId = String(r.modelId ?? '').trim()
  const tierRaw = String(r.tierKey ?? '').trim().toLowerCase().replace(/\s+/g, '')
  const [qRaw, dRaw] = tierRaw.split('@')
  const dNum = Number(String(dRaw ?? '').replace(/[^\d]/g, ''))
  const d = Number.isFinite(dNum) && dNum > 0 ? String(Math.round(dNum)) : String(dRaw ?? '').trim()
  const tierKey = qRaw && d ? `${qRaw}@${d}` : tierRaw
  const coins = Number(r.coins)
  if (!modelId || !tierKey || !Number.isFinite(coins) || coins < 0) return null
  return { modelId, tierKey, coins: Math.round(coins) }
}

function fromJsonPayload(payload: unknown): KieVideoPriceEntry[] {
  if (!payload || typeof payload !== 'object') return []
  const p = payload as { entries?: unknown; models?: unknown }
  if (Array.isArray(p.entries)) return p.entries.map(normalizeEntry).filter(Boolean) as KieVideoPriceEntry[]
  // Fallback for alternative payload shape: { models: [{ id, tiers: [{ tierKey, coins }] }] }
  if (Array.isArray(p.models)) {
    const out: KieVideoPriceEntry[] = []
    for (const m of p.models) {
      if (!m || typeof m !== 'object') continue
      const mm = m as { id?: unknown; tiers?: unknown[] }
      const modelId = String(mm.id ?? '').trim()
      if (!modelId || !Array.isArray(mm.tiers)) continue
      for (const t of mm.tiers) {
        const tier = normalizeEntry({ modelId, tierKey: (t as { tierKey?: unknown })?.tierKey, coins: (t as { coins?: unknown })?.coins })
        if (tier) out.push(tier)
      }
    }
    return out
  }
  return []
}

export async function fetchKieVideoPriceEntries(): Promise<KieVideoPriceEntry[]> {
  const candidates = Array.from(
    new Set(
      [`${API_BASE}/kie-video-prices`, '/kie-video-prices', '/api/kie-video-prices'].filter(
        (u) => String(u).trim().length > 0
      )
    )
  )
  for (const url of candidates) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const j = (await res.json()) as unknown
      const entries = fromJsonPayload(j)
      if (entries.length) return entries
    } catch {
      // try next candidate
    }
  }
  return []
}
