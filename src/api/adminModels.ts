const _viteApi = import.meta.env.VITE_API_URL
const API_BASE =
  typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim() : ''

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } as const
}

export interface AdminModelQualityOpt {
  value: string
  label: string
}

export interface AdminModelPrice {
  qualityKey: string
  coins: number
}

export interface AdminModel {
  id: string
  label: string
  modes: string[]
  showDuration: boolean
  aspectRatios: string[]
  qualityOpts: AdminModelQualityOpt[]
  mediaMaxFiles: number
  mediaAccept: string
  mediaMaxSizeMb: number
  mediaHint: string
  sortOrder: number
  isActive: boolean
  prices: AdminModelPrice[]
}

export async function getAdminModels(token: string): Promise<AdminModel[]> {
  const res = await fetch(`${API_BASE}/admin/models`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Ошибка загрузки моделей (${res.status})`)
  const data = await res.json() as { models: AdminModel[] }
  return data.models
}

export async function saveAdminModel(token: string, model: AdminModel): Promise<AdminModel> {
  const res = await fetch(`${API_BASE}/admin/models/${encodeURIComponent(model.id)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(model),
  })
  if (!res.ok) {
    const text = await res.text()
    let msg = `Ошибка сохранения (${res.status})`
    try { msg = (JSON.parse(text) as { error?: string }).error ?? msg } catch { /* */ }
    throw new Error(msg)
  }
  const data = await res.json() as { model: AdminModel }
  return data.model
}

/** Только флаг «в списке Создать» (is_active в БД). */
export async function patchAdminModelActive(token: string, modelId: string, isActive: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/models/${encodeURIComponent(modelId)}/active`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ isActive }),
  })
  if (!res.ok) {
    const text = await res.text()
    let msg = `Ошибка (${res.status})`
    try {
      msg = (JSON.parse(text) as { error?: string }).error ?? msg
    } catch {
      /* */
    }
    throw new Error(msg)
  }
}
