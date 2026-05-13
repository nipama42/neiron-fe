const _viteApi = import.meta.env.VITE_API_URL
const API_BASE = typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim() : ''

export interface PublicModel {
  id: string
  label: string
  modes: string[]
  showDuration: boolean
  aspectRatios: string[]
  qualityOptions: { value: string; label: string }[]
  media: { maxFiles: number; accept: string; maxSizeMb: number; hint: string }
  sortOrder: number
}

export async function fetchModels(): Promise<PublicModel[]> {
  const res = await fetch(`${API_BASE}/models`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as { models: PublicModel[] }
  return Array.isArray(data.models) ? data.models : []
}

/** ID моделей с is_active=false в БД — скрыть их в выборе на «Создать». */
export async function fetchDisabledModelIds(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/models/disabled-ids`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as { disabledIds?: unknown }
  const raw = data.disabledIds
  return Array.isArray(raw) ? raw.map((x) => String(x)) : []
}

export async function fetchRuntimeProviderMode(): Promise<{ apimartForced: boolean }> {
  const res = await fetch(`${API_BASE}/runtime/provider-mode`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as { apimartForced?: unknown }
  return { apimartForced: data.apimartForced === true }
}
