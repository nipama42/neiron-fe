import type { AuthUser } from './auth'

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

// ─── Типы для платёжной системы ──────────────────────────────────────────────

export interface PaymentPackage {
  id: string
  credits: number
  rub: number
  usdt: number
}

export interface PaymentPackagesResponse {
  packages: PaymentPackage[]
  usdRubRate: number
}

export interface CreateOrderResponse {
  orderId: string
  payUrl: string
  method: 'sbp' | 'cryptobot'
  credits: number
  amountRub: number
  amountUsdt: number | null
  /** Только CryptoBot — выбор ссылки под Mini App / браузер */
  payUrlMini?: string | null
  payUrlBot?: string | null
  payUrlWeb?: string | null
}

export interface OrderStatusResponse {
  status: 'pending' | 'paid' | 'failed' | 'expired'
  credits: number
  method: string
  amountRub: number
  amountUsdt: number | null
  payUrl: string | null
  user?: AuthUser
}

// ─── Платёжные API-функции ───────────────────────────────────────────────────

export async function getPaymentPackages(): Promise<PaymentPackagesResponse> {
  const res = await fetch(`${API_BASE}/payments/packages`)
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function createPaymentOrder(
  token: string,
  packageId: string,
  method: 'sbp' | 'cryptobot'
): Promise<CreateOrderResponse> {
  const res = await fetch(`${API_BASE}/payments/order/create`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ packageId, method }),
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function getPaymentOrderStatus(
  token: string,
  orderId: string
): Promise<OrderStatusResponse> {
  const res = await fetch(`${API_BASE}/payments/order/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function postTopUp(token: string, credits: number): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/me/wallet/topup`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ credits }),
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function postWalletPromo(token: string, code: string): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/me/wallet/promo`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ code }),
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function postWalletRoulette(
  token: string,
  credits: number
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/me/wallet/roulette`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ credits }),
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export interface PostPublicPortfolioBody {
  title: string
  subtitle?: string | null
  type?: string
  coverGradient?: string | null
}

export async function postPublicPortfolio(
  token: string,
  body: PostPublicPortfolioBody
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/me/public-portfolio`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}

export async function deletePublicPortfolio(
  token: string,
  id: string
): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/me/public-portfolio/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await parseErr(res))
  return res.json()
}
