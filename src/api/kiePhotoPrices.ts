import type { KiePhotoPriceEntry } from '../lib/kiePhotoQuote'

const _viteApi = import.meta.env.VITE_API_URL
const API_BASE =
  typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim() : ''

export async function fetchKiePhotoPriceEntries(): Promise<KiePhotoPriceEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/kie-photo-prices`)
    if (!res.ok) return []
    const j = (await res.json()) as { entries?: KiePhotoPriceEntry[] }
    return Array.isArray(j.entries) ? j.entries : []
  } catch {
    return []
  }
}
