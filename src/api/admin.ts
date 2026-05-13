import type { SupportAttachmentPayload } from '../lib/supportAttachments'

const _viteApi = import.meta.env.VITE_API_URL
const API_BASE =
  typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim() : ''

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  } as const
}

async function adminErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text()
  if (!text.trim()) {
    if (res.status === 403) return 'Нет прав администратора'
    if (res.status === 401) return 'Сессия истекла — войдите снова'
    return `${fallback} (HTTP ${res.status})`
  }
  try {
    const j = JSON.parse(text) as { error?: string }
    if (typeof j?.error === 'string' && j.error) return j.error
  } catch {
    /* не JSON (например HTML от nginx) */
  }
  const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 180)
  return snippet ? `${fallback}: ${snippet}` : `${fallback} (HTTP ${res.status})`
}

export interface AdminStats {
  generationsOk: number
  generationsFail: number
  generationsTotal: number
  conversionPct: number | null
  /** Доля успехов Neuro с первого ответа среди гибридных фото, где Neuro вызывался (UTC-сутки) */
  neuroConversionPct?: number | null
  /** Доля успешных генераций с маршрутом Kie (не чистый neuro-only фото), UTC-сутки */
  kieConversionPct?: number | null
  neuroHybridTried?: number
  /** Неуспех ответа Neuro с первого вызова: потом Kie спас (kieAfterNeuroOk) или оба упали (kieAfterNeuroFail) */
  neuroFirstShotFail?: number
  kieAfterNeuroOk?: number
  kieAfterNeuroFail?: number
  kieRouteOk?: number
  kieRouteFail?: number
  /** Сумма токенов Kie за UTC-сутки (раньше — «условные единицы») */
  apiUnits: number
  apiSpendUsd: number
  apiSpendRub?: number
  kieTokensToday?: number
  kieTokenUsd?: number
  usdRubRate?: number
  /** kie — все фото через Kie; hybrid — только Nano Banana 2/Pro через NeuroAPI (остальное — Kie) */
  photoProviderMode?: 'kie' | 'hybrid'
  /** Есть непустой NEUROAPI_API_KEY (или NEURO_API_KEY) на сервере */
  neuroApiKeyPresent?: boolean
  /**
   * $ за Neuro в итоге дня: при успешном GET NeuroAPI /dashboard/billing/usage — дельта за календарный день MSK (см. neuroSpendUsdBilling);
   * иначе сумма meta.neuroSpendUsd за UTC или оценка neuroGenerationsOk × neuroApiGenerationUnitUsd.
   */
  neuroSpendUsd?: number
  /** Дельта $ за московский день из биллинга NeuroAPI (если доступно) */
  neuroSpendUsdBilling?: number | null
  neuroSpendRubBilling?: number
  neuroBillingUnit?: 'cents_usd' | 'rub' | 'none' | 'unavailable'
  neuroBillingMskDay?: string
  neuroBillingTotalUsageRaw?: number
  /** Сумма meta.neuroSpendUsd за UTC-сутки (0, если в событиях не писали) */
  neuroSpendUsdLogged?: number
  /** neuroGenerationsOk × neuroApiGenerationUnitUsd */
  neuroSpendUsdEstimated?: number
  /** Успешных генераций с photoProvider=neuroapi за UTC-сутки */
  neuroGenerationsOk?: number
  /** Расход $ только Kie (токены×kieTokenUsd и legacy), без neuro */
  kieApiSpendUsd?: number
  /** Расход $ по APIMart за UTC-сутки (из meta.apimartSpendUsd) */
  apimartSpendUsd?: number
  apimartSpendUsdLogged?: number
  apimartSpendUsdEstimated?: number
  apimartGenerationUnitUsd?: number
  /** Успешных генераций с photoProvider=apimart за UTC-сутки */
  apimartGenerationsOk?: number
  /** Неуспешных генераций с photoProvider=apimart за UTC-сутки */
  apimartRouteFail?: number
  /** Конверсия APIMart-маршрута за UTC-сутки */
  apimartConversionPct?: number | null
  /** Условная $ за одну Neuro-генерацию в логах (NEUROAPI_GENERATION_UNIT_USD) */
  neuroApiGenerationUnitUsd?: number
  /** NEUROAPI_BILLING_USAGE_UNIT: auto | cents_usd | rub */
  neuroApiBillingUsageUnit?: string
  /** Всего записей в таблице users */
  registeredUsersTotal?: number
}

export interface KieEconomics {
  kieTokenUsd: number
  usdRubRate: number
  photoProviderMode: 'kie' | 'hybrid'
  updatedAt: string | null
  neuroApiKeyPresent?: boolean
}

export interface AdminOpenAiVlessState {
  hasVless: boolean
  hasOpenAiProxy: boolean
  vlessMasked: string | null
}

export interface AdminApimartState {
  enabled: boolean
  hasKey: boolean
  keyMasked: string | null
  baseUrl: string
  maxConcurrent: number
}

export interface AdminSummary {
  stats: AdminStats
  supportUnread: number
}

export interface SupportThread {
  userId: string
  title: string
  lastPreview: string
  lastAt: string
  unread: number
}

export interface SupportAttachmentStored {
  kind: 'image' | 'video'
  url: string
  name?: string
}

export interface SupportMessage {
  id: string
  isFromAdmin: boolean
  body: string
  createdAt: string
  attachments?: SupportAttachmentStored[]
}

export interface SiteEventRow {
  id: string
  kind: string
  userId: string | null
  label: string
  meta: Record<string, unknown>
  createdAt: string
  email?: string | null
  login?: string | null
  displayName?: string | null
  telegramUsername?: string | null
  publicTag?: string | null
}

export interface PromoCodeRow {
  code: string
  credits: number
  maxUses: number | null
  usesCount: number
  active: boolean
  createdAt: string
}

export async function getAdminSummary(token: string): Promise<AdminSummary> {
  const res = await fetch(`${API_BASE}/admin/summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('admin summary failed')
  return res.json()
}

export async function getKieEconomics(token: string): Promise<KieEconomics> {
  const res = await fetch(`${API_BASE}/admin/kie-economics`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'kie economics failed'))
  return res.json()
}

export async function patchKieEconomics(
  token: string,
  body: { kieTokenUsd?: number; usdRubRate?: number; photoProviderMode?: 'kie' | 'hybrid' }
): Promise<KieEconomics> {
  const res = await fetch(`${API_BASE}/admin/kie-economics`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'save kie economics failed'))
  return res.json()
}

export async function getAdminOpenAiVless(token: string): Promise<AdminOpenAiVlessState> {
  const res = await fetch(`${API_BASE}/admin/openai-vless`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'openai vless state failed'))
  return res.json()
}

export async function putAdminOpenAiVless(token: string, vlessUri: string): Promise<AdminOpenAiVlessState> {
  const res = await fetch(`${API_BASE}/admin/openai-vless`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ vlessUri }),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'openai vless save failed'))
  return res.json()
}

export async function getAdminApimart(token: string): Promise<AdminApimartState> {
  const res = await fetch(`${API_BASE}/admin/apimart`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'apimart state failed'))
  return res.json()
}

export async function putAdminApimart(
  token: string,
  body: { enabled: boolean; apiKey?: string; baseUrl?: string; maxConcurrent?: number }
): Promise<AdminApimartState> {
  const res = await fetch(`${API_BASE}/admin/apimart`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'apimart save failed'))
  return res.json()
}

export async function getAdminEvents(
  token: string,
  limit = 80,
  offset = 0
): Promise<{ events: SiteEventRow[] }> {
  const res = await fetch(`${API_BASE}/admin/events?limit=${limit}&offset=${offset}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('admin events failed')
  return res.json()
}

export async function getAdminSupportThreads(token: string): Promise<{ threads: SupportThread[] }> {
  const res = await fetch(`${API_BASE}/admin/support/threads`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('threads failed')
  return res.json()
}

export async function getAdminSupportMessages(
  token: string,
  userId: string
): Promise<{ messages: SupportMessage[] }> {
  const res = await fetch(`${API_BASE}/admin/support/${encodeURIComponent(userId)}/messages`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('messages failed')
  return res.json()
}

export async function postAdminSupportReply(
  token: string,
  userId: string,
  body: string,
  attachments?: SupportAttachmentPayload[]
): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/support/${encodeURIComponent(userId)}/messages`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ body, attachments: attachments ?? [] }),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Ответ в поддержку'))
}

export async function postAdminMarkRead(token: string, userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/support/${encodeURIComponent(userId)}/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('mark read failed')
}

export async function postAdminCloseThread(token: string, userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/support/${encodeURIComponent(userId)}/close`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Закрытие чата'))
}

export async function postAdminSupportTyping(token: string, userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/support/${encodeURIComponent(userId)}/typing`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return
}

export async function getAdminSupportTyping(
  token: string,
  userId: string
): Promise<{ userTyping: boolean }> {
  const res = await fetch(`${API_BASE}/admin/support/${encodeURIComponent(userId)}/typing`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return { userTyping: false }
  const data = (await res.json()) as { userTyping?: unknown }
  return { userTyping: data.userTyping === true }
}

export async function getAdminPromoCodes(token: string): Promise<{ codes: PromoCodeRow[] }> {
  const res = await fetch(`${API_BASE}/admin/promo-codes`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('promo list failed')
  return res.json()
}

export async function postAdminPromoCode(
  token: string,
  payload: { code: string; credits: number; maxUses?: number | null }
): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/promo-codes`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Промокод'))
}

export async function postAdminGrant(
  token: string,
  payload: { target: string; credits: number }
): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/grant`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Начисление'))
}

export interface KiePhotoPriceTier {
  qualityKey: string
  label: string
  coins: number
}

export interface KiePhotoPriceModel {
  id: string
  label: string
  tiers: KiePhotoPriceTier[]
}

export async function getAdminKiePhotoPrices(token: string): Promise<{ models: KiePhotoPriceModel[] }> {
  const res = await fetch(`${API_BASE}/admin/kie-photo-prices`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Цены Kie-фото'))
  return res.json()
}

export async function putAdminKiePhotoPrices(
  token: string,
  items: { modelId: string; qualityKey: string; coins: number }[]
): Promise<{ models: KiePhotoPriceModel[] }> {
  const res = await fetch(`${API_BASE}/admin/kie-photo-prices`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ items }),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Сохранение цен'))
  return res.json()
}

export interface KieVideoPriceTier {
  tierKey: string
  label: string
  coins: number
}

export interface KieVideoPriceModel {
  id: string
  label: string
  tiers: KieVideoPriceTier[]
}

export async function getAdminKieVideoPrices(token: string): Promise<{ models: KieVideoPriceModel[] }> {
  const res = await fetch(`${API_BASE}/admin/kie-video-prices`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Цены Kie-видео'))
  return res.json()
}

export async function putAdminKieVideoPrices(
  token: string,
  items: { modelId: string; tierKey: string; coins: number }[]
): Promise<{ models: KieVideoPriceModel[] }> {
  const res = await fetch(`${API_BASE}/admin/kie-video-prices`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ items }),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Сохранение цен видео'))
  return res.json()
}

// ── Banners ───────────────────────────────────────────────────────────────────

export interface BannerItem {
  slot: number
  imageUrl: string
  linkUrl: string | null
}

export async function getAdminBanners(): Promise<BannerItem[]> {
  const res = await fetch(`${API_BASE}/banners`)
  if (!res.ok) throw new Error('Ошибка загрузки баннеров')
  const data = await res.json() as { banners: BannerItem[] }
  return data.banners ?? []
}

export async function uploadAdminBanner(
  token: string,
  slot: number,
  imageUrl: string,
  linkUrl?: string | null
): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/banners/${slot}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ imageUrl, linkUrl: linkUrl ?? null }),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Загрузка баннера'))
}

export async function deleteAdminBanner(token: string, slot: number): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/banners/${slot}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Удаление баннера'))
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string
  email: string | null
  login: string | null
  telegramUsername: string | null
  telegramName: string | null
  publicTag: string | null
  displayName: string | null
  credits: number
  isAdmin: boolean
  createdAt: string
  hasPartner: boolean
}

export async function getAdminUserSearch(token: string, q: string): Promise<AdminUserRow[]> {
  const res = await fetch(`${API_BASE}/admin/users/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Поиск пользователей'))
  const data = await res.json() as { users: AdminUserRow[] }
  return data.users ?? []
}

export async function deleteAdminUser(token: string, userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Удаление пользователя'))
}

// ── Тексты сайта (О сервисе, юр. страницы) ─────────────────────────────────

export interface AdminSitePageRow {
  key: string
  title: string
  bodyHtml: string
  updatedAt: string | null
}

export async function getAdminSitePages(token: string): Promise<{ pages: AdminSitePageRow[] }> {
  const res = await fetch(`${API_BASE}/admin/site-pages`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Тексты сайта'))
  return res.json() as Promise<{ pages: AdminSitePageRow[] }>
}

export async function patchAdminSitePage(
  token: string,
  key: string,
  body: { title?: string; bodyHtml?: string }
): Promise<AdminSitePageRow> {
  const res = await fetch(`${API_BASE}/admin/site-pages/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Сохранение страницы'))
  return res.json() as Promise<AdminSitePageRow>
}

// ── Блокировки публикаций (модерация) ────────────────────────────────────────

export interface AdminPublishBanRow {
  id: string
  authorUserId: string
  createdAt: string
  mode: string
  modelLabel: string
  promptPreview: string
  thumbUrl: string | null
  authorTag: string | null
  authorName: string | null
}

export async function getAdminPublishBans(
  token: string,
  opts?: { limit?: number; offset?: number }
): Promise<{ items: AdminPublishBanRow[] }> {
  const qs = new URLSearchParams()
  if (opts?.limit != null) qs.set('limit', String(opts.limit))
  if (opts?.offset != null) qs.set('offset', String(opts.offset))
  const res = await fetch(`${API_BASE}/admin/publish-bans?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Список модерации'))
  return res.json() as Promise<{ items: AdminPublishBanRow[] }>
}

export async function postAdminRemoveFeedItem(token: string, generationId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/feed/remove`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ generationId }),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Снять с ленты'))
}

export async function postAdminRestorePublishBan(token: string, generationId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/publish-bans/restore`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ generationId }),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Восстановить публикацию'))
}

export async function postAdminDismissPublishBan(token: string, generationId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/publish-bans/dismiss`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ generationId }),
  })
  if (!res.ok) throw new Error(await adminErrorMessage(res, 'Скрыть из списка'))
}
