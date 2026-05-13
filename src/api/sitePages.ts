const _viteApi = import.meta.env.VITE_API_URL
const API_BASE =
  typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim().replace(/\/+$/, '') : ''

export interface PublicSitePage {
  key: string
  title: string
  bodyHtml: string
  updatedAt: string | null
}

export async function getPublicSitePage(key: string): Promise<PublicSitePage> {
  const res = await fetch(`${API_BASE}/public/site-pages/${encodeURIComponent(key)}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<PublicSitePage>
}
