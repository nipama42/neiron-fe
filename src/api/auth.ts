// Пустая строка = тот же origin (Vite proxy в dev, Nginx → API в проде).
// Задайте VITE_API_URL только если API на другом домене.
const _viteApi = import.meta.env.VITE_API_URL
const API_BASE =
  typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim().replace(/\/+$/, '') : ''

export interface LedgerEntry {
  id: string
  at: string
  delta: number
  balanceAfter: number
  kind: string
  title: string
  ref?: string | null
}

export interface PublicPortfolioItem {
  id: string
  title: string
  subtitle: string | null
  type: string
  createdAt: string
  coverGradient: string | null
}

export interface PartnerInfo {
  id: string
  slug: string
  name: string
}

export interface SubscriptionInfo {
  tier: string
  label: string
}

export interface GenerationStats {
  total: number
  publicCount: number
}

export interface PublicGenerationItem {
  id: string
  createdAt: string
  mode: string
  modelId: string
  modelLabel: string
  promptPreview: string
  musicTitle?: string | null
  aspect: string | null
  likes: number
  resultUrl?: string | null
  prompt?: string | null
  quality?: string | null
  duration?: string | null
  likedByMe?: boolean
}

/** История генераций (GET /me, ответ создания) */
export interface GenerationLogItem {
  id: string
  createdAt: string
  mode: string
  modelId: string
  modelLabel: string
  promptPreview: string
  musicTitle?: string | null
  /** Полный текст для копирования (новые записи; старые — как promptPreview) */
  prompt?: string | null
  aspect?: string | null
  quality?: string | null
  duration?: string | null
  resultUrl?: string | null
  /** Предпочтительный URL для отображения (CDN/preview), если есть */
  resultDisplayUrl?: string | null
  /** Основной URL в storage/CDN, если есть */
  resultMainUrl?: string | null
  /** Техническая структура media из бэкенда (опционально) */
  media?: unknown
  cost?: number | null
  /** Было ли «в профиль» при сохранении */
  publishPublic?: boolean
  /** Сейчас есть в ленте публичных работ (можно снять позже) */
  inPublicFeed?: boolean
  /** Лайки, только если inPublicFeed */
  likes?: number | null
  /** Ожидает фоновой Kie-задачи */
  generationStatus?: 'pending' | 'failed' | null
  /** Текст ошибки при generationStatus === 'failed' */
  generationError?: string | null
}

export interface AuthUser {
  id: string
  telegramId: number | null
  tgUsername: string
  tgFirstName: string
  email: string | null
  /** Вход по логину без почты (учётка из ADMIN_BOSS_LOGIN и др.) */
  login?: string | null
  creditsBalance: number
  shareByDefault: boolean
  referralCode: string
  createdAt: string
  hasCompletedFirstGeneration: boolean
  hasCompletedFirstPurchase: boolean
  purchasesCount: number
  displayName?: string | null
  avatarUrl?: string | null
  subscriptionTier?: string
  profileLikesCount?: number
  /** Доступ к админ-панели */
  isAdmin?: boolean
  /** Заполняется после GET /me или PATCH профиля */
  profilePublic?: boolean
  publicTag?: string | null
  bio?: string | null
  instagramUrl?: string | null
  telegramUrl?: string | null
  tiktokUrl?: string | null
  twitterUrl?: string | null
  youtubeUrl?: string | null
  vkUrl?: string | null
  tagChangedAt?: string | null
  /** Публичные работы в профиле */
  publicPortfolio?: PublicPortfolioItem[]
  /** История операций (усечённая с бэкенда) */
  ledger?: LedgerEntry[]
  /** ISO: последнее вращение рулетки (сервер) */
  rouletteLastSpinAt?: string | null
  /** Партнёр, если регистрация была по партнёрской ссылке */
  partner?: PartnerInfo | null
  referralSource?: string | null
  subscription?: SubscriptionInfo
  generationStats?: GenerationStats
  publicGenerations?: PublicGenerationItem[]
  /** Последние генерации (сервер отдаёт до 60 записей) */
  generationsLog?: GenerationLogItem[]
  /**
   * Пока в будущем — на сервере активна Kie-генерация (блокировка повторного списания).
   * ISO; null/отсутствует — можно запускать новую.
   */
  activeGenerationUntil?: string | null
  /** Число параллельных Kie-генераций (слотов), макс. 3 */
  activeKieGenerationCount?: number
  /** ID публичных генераций, которые лайкнул текущий пользователь */
  likedPublicGenerationIds?: string[]
}

export interface AuthResponse {
  token: string
  refreshToken: string
  user: AuthUser
}

export interface EmailVerificationResponse {
  verificationToken: string
}

export async function authViaTelegram(
  initData: string,
  options?: {
    refCode?: string
    partnerSlug?: string
    partnerCode?: string
    telegramStartCode?: string
  }
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/telegram`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      initData,
      refCode: options?.refCode,
      partnerSlug: options?.partnerSlug,
      partnerCode: options?.partnerCode,
      telegramStartCode: options?.telegramStartCode,
    }),
  })

  if (!res.ok) {
    throw new Error(`Auth failed: ${res.status}`)
  }

  return res.json()
}

export async function registerEmail(
  email: string,
  password: string,
  verificationToken: string,
  options?: {
    refCode?: string
    partnerSlug?: string
    partnerCode?: string
    acceptedTerms?: boolean
  }
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/email/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      verificationToken,
      refCode: options?.refCode,
      partnerSlug: options?.partnerSlug,
      partnerCode: options?.partnerCode,
      acceptedTerms: options?.acceptedTerms === true,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Register failed: ${res.status}`)
  }
  return res.json()
}

export async function requestEmailCode(email: string): Promise<{ ok: true }> {
  const res = await fetch(`${API_BASE}/auth/email/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request code failed: ${res.status}`)
  }
  return res.json()
}

export async function verifyEmailCode(
  email: string,
  code: string
): Promise<EmailVerificationResponse> {
  const res = await fetch(`${API_BASE}/auth/email/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Verify code failed: ${res.status}`)
  }
  return res.json()
}

export async function loginEmail(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/email/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Login failed: ${res.status}`)
  }
  return res.json()
}

export async function requestPasswordRecoveryCode(
  email: string
): Promise<{ ok: true; message?: string }> {
  const res = await fetch(`${API_BASE}/auth/email/recovery/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

export async function verifyPasswordRecoveryCode(
  email: string,
  code: string
): Promise<{ recoveryToken: string }> {
  const res = await fetch(`${API_BASE}/auth/email/recovery/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Verify failed: ${res.status}`)
  }
  return res.json()
}

export async function completePasswordRecovery(
  email: string,
  recoveryToken: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/email/recovery/set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, recoveryToken, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Recovery failed: ${res.status}`)
  }
  return res.json()
}

export async function refreshTokensApi(
  refreshToken: string
): Promise<{ token: string; refreshToken: string }> {
  const res = await fetch(`${API_BASE}/auth/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) {
    throw new Error(`Refresh failed: ${res.status}`)
  }
  return res.json()
}

export async function requestBotLoginUrl(
  options?: { partnerSlug?: string }
): Promise<{ loginUrl: string; token: string }> {
  const params = new URLSearchParams()
  if (options?.partnerSlug) params.set('partnerSlug', options.partnerSlug)
  const qs = params.toString()
  const res = await fetch(`${API_BASE}/auth/telegram/bot-login-url${qs ? `?${qs}` : ''}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Bot login unavailable: ${res.status}`)
  }
  return res.json()
}

export async function pollBotLogin(token: string): Promise<{
  status: 'pending' | 'ok' | 'expired'
  token?: string
  refreshToken?: string
  user?: AuthUser
}> {
  const res = await fetch(
    `${API_BASE}/auth/telegram/bot-login-poll?token=${encodeURIComponent(token)}`
  )
  if (!res.ok) throw new Error(`Poll failed: ${res.status}`)
  return res.json()
}
