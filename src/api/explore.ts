const _viteApi = import.meta.env.VITE_API_URL
const API_BASE =
  typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim() : ''

export interface PublicFeedItem {
  id: string
  createdAt: string
  mode: string
  modelId: string
  modelLabel: string
  promptPreview: string
  /** Название трека (Suno) — для ленты и карточек */
  musicTitle?: string | null
  prompt?: string | null
  aspect: string | null
  quality?: string | null
  cost?: number | null
  duration?: string | null
  likes: number
  resultUrl: string | null
  resultDisplayUrl?: string | null
  resultMainUrl?: string | null
  media?: {
    originalUrl?: string | null
    image?: {
      webUrl?: string | null
      mime?: string | null
      width?: number | null
      height?: number | null
      bytes?: number | null
      sourceBytes?: number | null
      targetBytes?: number | null
      withinLimit?: boolean | null
    } | null
    video?: {
      previewUrl?: string | null
      previewBytes?: number | null
      previewTargetBytes?: number | null
      previewWithinLimit?: boolean | null
      previewDurationSec?: number | null
      mainUrl?: string | null
      mainBytes?: number | null
      mime?: string | null
      sourceBytes?: number | null
    } | null
  } | null
  likedByMe?: boolean
  isNew?: boolean
  authorId?: string
  authorAvatarUrl?: string | null
  authorTag: string | null
  authorName: string
}

export interface PublicAuthorProfile {
  id: string
  publicTag: string | null
  authorTag: string | null
  authorName: string
  displayName: string | null
  avatarUrl: string | null
  bio: string | null
  instagramUrl: string | null
  telegramUrl: string | null
  worksCount: number
  profileLikesCount: number
}

export interface PublicAuthorProfileResponse {
  profile: PublicAuthorProfile
  items: PublicFeedItem[]
}

export async function getPublicFeed(
  limit = 120,
  opts?: { offset?: number; order?: 'popular' | 'latest'; cache?: RequestCache }
): Promise<PublicFeedItem[]> {
  const token = (typeof localStorage !== 'undefined' ? localStorage : sessionStorage).getItem('token')
  const offset = Number.isFinite(Number(opts?.offset)) ? Number(opts?.offset) : 0
  const order = opts?.order === 'latest' ? 'latest' : 'popular'
  const qs = `limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}&order=${encodeURIComponent(order)}`
  const url = token
    ? `${API_BASE}/me/public-feed?${qs}`
    : `${API_BASE}/public/feed?${qs}`
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined
  /** Анонимная лента: HTTP-кэш по Cache-Control с бэка; с токеном — без агрессивного кэша (лайки). */
  const cache = opts?.cache ?? 'default'
  const res = await fetch(url, { headers, cache })
  if (!res.ok) {
    throw new Error(`Feed load failed: ${res.status}`)
  }
  const data = await res.json()
  return Array.isArray(data?.items) ? data.items : []
}

export async function likePublicGeneration(token: string, id: string): Promise<{ user: import('./auth').AuthUser; already: boolean }> {
  const paths = [
    `${API_BASE}/me/public-feed/${encodeURIComponent(id)}/like`,
    `${API_BASE}/public/generations/${encodeURIComponent(id)}/like`,
  ]
  let lastError: string | null = null
  for (const url of paths) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return res.json()
    const err = await res.json().catch(() => ({}))
    lastError = (err as { error?: string }).error ?? `Like failed: ${res.status}`
  }
  throw new Error(lastError ?? 'Like failed')
}

export async function unlikePublicGeneration(
  token: string,
  id: string
): Promise<{ user: import('./auth').AuthUser; notLiked?: boolean; removed?: boolean }> {
  const paths = [
    `${API_BASE}/me/public-feed/${encodeURIComponent(id)}/unlike`,
    `${API_BASE}/public/generations/${encodeURIComponent(id)}/unlike`,
  ]
  let lastError: string | null = null
  for (const url of paths) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return res.json()
    const err = await res.json().catch(() => ({}))
    lastError = (err as { error?: string }).error ?? `Unlike failed: ${res.status}`
  }
  throw new Error(lastError ?? 'Unlike failed')
}

export async function getPublicAuthorProfile(
  authorRef: string,
  opts?: { fallbackGenerationId?: string | null }
): Promise<PublicAuthorProfileResponse> {
  const token = (typeof localStorage !== 'undefined' ? localStorage : sessionStorage).getItem('token')
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  const gid = String(opts?.fallbackGenerationId ?? '').trim()
  const query = gid ? `?gid=${encodeURIComponent(gid)}` : ''
  const res = await fetch(
    `${API_BASE}/public/profiles/${encodeURIComponent(String(authorRef).trim())}${query}`,
    { headers }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Public profile load failed: ${res.status}`)
  }
  const data = await res.json()
  return {
    profile: data?.profile as PublicAuthorProfile,
    items: Array.isArray(data?.items) ? data.items : [],
  }
}
