const _viteApi = import.meta.env.VITE_API_URL
const API_BASE =
  typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim() : ''

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  } as const
}

async function parseErr(res: Response): Promise<string> {
  const err = await res.json().catch(() => ({}))
  return (err as { error?: string }).error ?? `Request failed: ${res.status}`
}

// ─── Типы ──────────────────────────────────────────────────────────────────

export interface PartnerDailyRow {
  date: string
  earnedUsd: number
  grossRub: number
  newReferrals: number
  purchaseEvents: number
  paidReferrals: number
}

export interface PartnerPayoutRow {
  id: string
  amountUsd: number
  amountRub: number | null
  /** Адрес TRC20 на момент заявки */
  payoutTrc20Address?: string | null
  status: 'pending' | 'paid' | 'rejected'
  requestedAt: string
  processedAt: string | null
  adminNotes: string | null
}

export interface PartnerDashboard {
  /** Минимальная сумма заявки (USD), списываемая с баланса */
  minPayoutUsd?: number
  /** Фиксированная комиссия за вывод (USD): к выплате = сумма заявки − комиссия */
  payoutFeeUsd?: number
  availableUsd: number
  totalEarnedUsd: number
  /** Начисления с покупок ваших рефералов (без суб-сети) */
  directEarnedUsd?: number
  totalRevenueRub: number
  /** Оборот (₽) по покупкам, с которых вам начислена прямая комиссия */
  directRevenueRub?: number
  /** Оборот (₽) по покупкам в сети суб-партнёров, с которых вам начислена доля upline */
  subRevenueRub?: number
  referralsCount: number
  paidReferralsCount: number
  totalPurchasesCount: number
  subPartnersCount: number
  subEarnedUsd: number
  /** Рефералы, у которых есть хотя бы одна завершённая генерация */
  referralsWithFirstGenCount?: number
  /** Суммарное число завершённых генераций по всем рефералам */
  referralsGenerationsTotal?: number
}

export interface PartnerApplication {
  id: string
  userId: string
  contact: string
  description: string | null
  status: 'pending' | 'approved' | 'rejected'
  appliedAt: string
  reviewedAt: string | null
}

export interface PartnerDashboardResponse {
  isPartner: boolean
  /** ₽ за 1 USD — из админки (настройки Kie economics), для отображения баланса и оборота */
  usdRubRate?: number
  partnerId?: string
  partnerCode?: string
  /** Сохранённый USDT TRC20 (TRON); вывод только сюда */
  payoutTrc20Address?: string | null
  siteLink?: string
  /** Deep-link в Telegram-бот с partner_code (если настроен бот) */
  botLink?: string
  displayCurrency?: 'rub' | 'usd'
  commissionPercent?: number
  subUplinePercent?: number
  dashboard?: PartnerDashboard
  daily?: PartnerDailyRow[]
  payouts?: PartnerPayoutRow[]
  application?: PartnerApplication | null
}

export interface AdminPartnerRow {
  id: string
  slug: string
  partner_code: string
  user_id?: string | null
  payout_trc20_address?: string | null
  status: string
  commission_percent: number
  sub_upline_percent: number
  display_currency: string
  available_usd: number
  total_earned_usd: number
  email?: string | null
  telegram_username?: string | null
  telegram_first_name?: string | null
  public_tag?: string | null
  referrals_count: number
  pending_payouts: number
}

export interface AdminPayoutRow {
  id: string
  partner_id: string
  partner_code: string
  payout_trc20_address?: string | null
  amount_usd: number
  amount_rub: number | null
  status: string
  requested_at: string
  processed_at: string | null
  admin_notes: string | null
  email?: string | null
  telegram_username?: string | null
  telegram_first_name?: string | null
}

export interface AdminPartnerDetailResponse {
  partner: AdminPartnerRow & { owner_user_id?: string | null }
  subPartners: AdminSubPartnerRow[]
  referralGen: { referralsWithFirstGenCount: number; referralsGenerationsTotal: number }
}

export interface AdminSubPartnerRow {
  id: string
  partner_code: string
  slug: string
  status: string
  available_usd: number
  total_earned_usd: number
  commission_percent?: number
  email?: string | null
  telegram_username?: string | null
  telegram_first_name?: string | null
  public_tag?: string | null
}

export interface AdminApplicationRow {
  id: string
  user_id: string
  contact: string
  description: string | null
  status: string
  applied_at: string
  reviewed_at: string | null
  email?: string | null
  telegram_username?: string | null
  telegram_first_name?: string | null
  public_tag?: string | null
}

// ─── Партнёрские API ────────────────────────────────────────────────────────

export async function getPartnerDashboard(token: string): Promise<PartnerDashboardResponse> {
  const res = await fetch(`${API_BASE}/partner/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function postPartnerApply(
  token: string,
  body: { contact: string; description: string }
): Promise<{ application: PartnerApplication }> {
  const res = await fetch(`${API_BASE}/partner/apply`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function postPartnerPayoutWallet(
  token: string,
  address: string
): Promise<{ ok: boolean; address: string }> {
  const res = await fetch(`${API_BASE}/partner/payout-wallet`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ address }),
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function postPartnerPayout(
  token: string,
  amountUsd: number
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/partner/payout`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ amountUsd }),
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function postPartnerCurrency(
  token: string,
  currency: 'rub' | 'usd'
): Promise<{ ok: boolean; currency: string }> {
  const res = await fetch(`${API_BASE}/partner/currency`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ currency }),
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

// ─── Админ: партнёры ────────────────────────────────────────────────────────

export async function getAdminPartnerApplications(
  token: string
): Promise<{ applications: AdminApplicationRow[] }> {
  const res = await fetch(`${API_BASE}/admin/partner/applications`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function postAdminApproveApplication(
  token: string,
  id: string,
  opts: { commissionPercent: number; subUplinePercent: number }
): Promise<{ ok: boolean; partnerCode: string }> {
  const res = await fetch(`${API_BASE}/admin/partner/applications/${id}/approve`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(opts),
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function postAdminRejectApplication(
  token: string,
  id: string
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/admin/partner/applications/${id}/reject`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function getAdminPartnerList(
  token: string,
  opts?: { q?: string }
): Promise<{ partners: AdminPartnerRow[] }> {
  const u = new URLSearchParams()
  const q = opts?.q?.trim()
  if (q) u.set('q', q)
  const qs = u.toString()
  const res = await fetch(`${API_BASE}/admin/partner/list${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function getAdminPartnerDetail(
  token: string,
  id: string
): Promise<AdminPartnerDetailResponse> {
  const res = await fetch(`${API_BASE}/admin/partner/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function postAdminAssignSubPartner(
  token: string,
  parentPartnerId: string,
  childPartnerId: string
): Promise<{ ok: boolean }> {
  const res = await fetch(
    `${API_BASE}/admin/partner/${encodeURIComponent(parentPartnerId)}/sub-partners`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ childPartnerId }),
    }
  )
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function deleteAdminSubPartner(
  token: string,
  parentPartnerId: string,
  childPartnerId: string
): Promise<{ ok: boolean }> {
  const res = await fetch(
    `${API_BASE}/admin/partner/${encodeURIComponent(parentPartnerId)}/sub-partners/${encodeURIComponent(childPartnerId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function patchAdminPartner(
  token: string,
  id: string,
  opts: {
    commissionPercent?: number
    subUplinePercent?: number
    status?: string
    /** Корректировка доступного баланса USD (+ начислить, − списать) */
    availableUsdDelta?: number
  }
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/admin/partner/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(opts),
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function getAdminPartnerPayouts(
  token: string
): Promise<{ payouts: AdminPayoutRow[] }> {
  const res = await fetch(`${API_BASE}/admin/partner/payouts`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function postAdminProcessPayout(
  token: string,
  id: string,
  opts: { status: 'paid' | 'rejected'; adminNotes?: string }
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/admin/partner/payouts/${id}/process`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(opts),
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}
