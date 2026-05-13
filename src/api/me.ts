import type { AuthUser, GenerationLogItem } from './auth'

const _viteApi = import.meta.env.VITE_API_URL
const API_BASE =
  typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim().replace(/\/+$/, '') : ''

export interface PatchProfileBody {
  displayName?: string | null
  avatarUrl?: string | null
  instagramUrl?: string | null
  telegramUrl?: string | null
  tiktokUrl?: string | null
  twitterUrl?: string | null
  youtubeUrl?: string | null
  vkUrl?: string | null
  bio?: string | null
  profilePublic?: boolean
  shareByDefault?: boolean
}

export interface PostGenerationBody {
  mode: string
  modelId: string
  modelLabel?: string
  prompt: string
  publishPublic?: boolean
  aspect?: string | null
  quality?: string | null
  duration?: string | null
  /** data:image/...;base64,... для Kie image-to-image (тот же modelId, что и text-to-image) */
  imageInputs?: string[]
  /** Suno (kie-suno): жанр → поле style API */
  musicGenre?: string | null
  musicTitle?: string | null
  musicInstrumental?: boolean
  /** m | f — если не инструментал */
  musicVocalGender?: 'm' | 'f' | null
}

export async function postGenerationReject(
  token: string,
  body: { mode: string; modelId: string; reason?: string }
): Promise<void> {
  await fetch(`${API_BASE}/me/generations/reject`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
}

export type PostGenerationResult =
  | { user: AuthUser; resultUrl?: string | null; resultImage?: string | null; accepted?: false }
  | {
      accepted: true
      user: AuthUser
      jobId: string
      generationId: string
    }

export async function postGenerationRecord(token: string, body: PostGenerationBody): Promise<PostGenerationResult> {
  const res = await fetch(`${API_BASE}/me/generations`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Generation save failed: ${res.status}`)
  }
  return res.json() as Promise<PostGenerationResult>
}

export async function deletePublicGeneration(
  token: string,
  id: string
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/me/public-generations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Delete failed: ${res.status}`)
  }
  return res.json()
}

export async function patchGenerationPublic(
  token: string,
  id: string,
  publishPublic: boolean
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/me/generations/${encodeURIComponent(id)}/public`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ publishPublic }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Publish toggle failed: ${res.status}`)
  }
  return res.json()
}

export async function deleteGenerationLogItem(
  token: string,
  id: string
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/me/generations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Delete generation failed: ${res.status}`)
  }
  return res.json()
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  } as const
}

export type ApiErrorWithStatus = Error & { status: number }

export async function getMe(token: string): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const message = (err as { error?: string }).error ?? `getMe failed: ${res.status}`
    const e = new Error(message) as ApiErrorWithStatus
    e.status = res.status
    throw e
  }
  return res.json()
}

export async function getMyGenerationsLogPage(
  token: string,
  opts?: { limit?: number; offset?: number }
): Promise<{ items: GenerationLogItem[]; total: number; limit: number; offset: number }> {
  const limit = Number.isFinite(Number(opts?.limit)) ? Number(opts?.limit) : 16
  const offset = Number.isFinite(Number(opts?.offset)) ? Number(opts?.offset) : 0
  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })
  const res = await fetch(`${API_BASE}/me/generations-log?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `getMyGenerationsLogPage failed: ${res.status}`)
  }
  return res.json()
}

export async function patchProfile(
  token: string,
  body: PatchProfileBody
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/me/profile`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `patchProfile failed: ${res.status}`)
  }
  return res.json()
}

export async function uploadProfileAvatar(
  token: string,
  dataUrl: string
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/me/avatar`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ dataUrl }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `uploadProfileAvatar failed: ${res.status}`)
  }
  return res.json()
}

export async function patchPublicTag(
  token: string,
  publicTag: string
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/me/tag`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ publicTag }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `patchTag failed: ${res.status}`)
  }
  return res.json()
}
