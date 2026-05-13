import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'neiro_generation_inflight_v1'
/** Клиентский fallback, если ещё не пришёл ответ /me (сервер держит lock до 20 мин). */
const RECOVERED_BANNER_MAX_MS = 20 * 60 * 1000

export const KIE_PARALLEL_MAX = 3

type Stored = { v: 1; modelLabel: string; startedAt: number }

export type GenerationBannerState = {
  inFlight: boolean
  modelLabel: string
  /** Оценка числа активных генераций (сервер + локальные запросы). */
  activeSlotCount: number
}

const serverSnapshot: GenerationBannerState = {
  inFlight: false,
  modelLabel: '',
  activeSlotCount: 0,
}

/** Последний запущенный label (пока есть локальные POST). */
let activeLabel = ''

let recoveredBanner = false
let recoveredLabel = ''
let recoveredStartedAt = 0

/** Сколько Kie-слотов занято на сервере (GET /me → activeKieGenerationCount). */
let serverActiveKieCount = 0
/** Время окончания «длинного» серверного окна (max until по слотам). */
let serverLockUntilMs = 0

/** Незавершённые POST /me/generations из этой вкладки (оптимистичный учёт до ответа). */
let clientPendingCount = 0

const listeners = new Set<() => void>()
let bannerSnapCache: GenerationBannerState | null = null

function emit() {
  bannerSnapCache = null
  for (const l of listeners) l()
}

function readStorage(): Stored | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Stored
    if (p?.v !== 1 || typeof p.startedAt !== 'number') return null
    return p
  } catch {
    return null
  }
}

function writeStorage(modelLabel: string) {
  if (typeof sessionStorage === 'undefined') return
  try {
    const payload: Stored = { v: 1, modelLabel, startedAt: Date.now() }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* quota */
  }
}

function clearStorage() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function tryExpireRecovered() {
  if (!recoveredBanner) return
  if (Date.now() - recoveredStartedAt <= RECOVERED_BANNER_MAX_MS) return
  recoveredBanner = false
  recoveredLabel = ''
  recoveredStartedAt = 0
  clearStorage()
  emit()
}

function isServerLockActive() {
  if (serverLockUntilMs <= 0) return false
  if (Date.now() >= serverLockUntilMs) {
    serverLockUntilMs = 0
    emit()
    return false
  }
  return true
}

function recoveredAddsSlot(): boolean {
  return recoveredBanner && serverActiveKieCount === 0 && clientPendingCount === 0
}

function displaySlotCount(): number {
  // Сервер знает уже принятые задачи, клиент — POST ещё без ответа. Это разные фазы одной работы,
  // поэтому суммируем (max давал «1 из 3» для 2-й и 3-й задачи, когда оба счётчика уже ≥1).
  let n = serverActiveKieCount + clientPendingCount
  if (recoveredAddsSlot()) n = Math.max(n, 1)
  return Math.min(KIE_PARALLEL_MAX, Math.max(0, n))
}

/**
 * После mergeUser / setAuth: синхронизация серверных слотов Kie.
 * @param iso — max until по активным слотам (или null)
 * @param activeKieCount — число неистёкших слотов (предпочтительно с API)
 */
export function syncGenerationLockFromServer(
  iso: string | null | undefined,
  activeKieCount?: number | null
) {
  let isoMs = 0
  if (iso) {
    const t = new Date(iso).getTime()
    if (Number.isFinite(t) && t > Date.now()) isoMs = t
  }
  serverLockUntilMs = isoMs

  if (typeof activeKieCount === 'number' && Number.isFinite(activeKieCount) && activeKieCount >= 0) {
    serverActiveKieCount = Math.floor(activeKieCount)
  } else {
    serverActiveKieCount = isoMs > 0 ? 1 : 0
  }

  if (serverActiveKieCount > 0) {
    recoveredBanner = false
    recoveredLabel = ''
    recoveredStartedAt = 0
    clearStorage()
  } else if (serverActiveKieCount === 0 && clientPendingCount === 0 && serverLockUntilMs <= 0) {
    recoveredBanner = false
    recoveredLabel = ''
    recoveredStartedAt = 0
    clearStorage()
  }
  emit()
}

function hydrateFromSession() {
  const p = readStorage()
  if (!p) return
  if (Date.now() - p.startedAt > RECOVERED_BANNER_MAX_MS) {
    clearStorage()
    return
  }
  recoveredBanner = true
  recoveredLabel = typeof p.modelLabel === 'string' ? p.modelLabel : ''
  recoveredStartedAt = p.startedAt
}

hydrateFromSession()

/** Учёт нового POST генерации (можно несколько параллельно, до KIE_PARALLEL_MAX на сервере). */
export function beginGenerationAttempt(modelLabel?: string) {
  const label = (modelLabel ?? '').trim()
  clientPendingCount++
  if (label) activeLabel = label
  writeStorage((activeLabel || label || 'Генерация').trim() || 'Генерация')
  emit()
}

export function endGenerationAttempt() {
  clientPendingCount = Math.max(0, clientPendingCount - 1)
  if (clientPendingCount === 0) {
    activeLabel = ''
    if (!recoveredBanner) clearStorage()
  }
  emit()
}

/** @deprecated Используйте beginGenerationAttempt / endGenerationAttempt */
export function setGenerationInFlight(value: boolean, modelLabel?: string) {
  if (value) beginGenerationAttempt(modelLabel)
  else {
    clientPendingCount = 0
    activeLabel = ''
    recoveredBanner = false
    recoveredLabel = ''
    recoveredStartedAt = 0
    clearStorage()
    emit()
  }
}

export function getGenerationInFlight() {
  tryExpireRecovered()
  return clientPendingCount > 0
}

export function getGenerationBannerState(): GenerationBannerState {
  tryExpireRecovered()
  const serverLocked = isServerLockActive()
  const clientBusy = clientPendingCount > 0
  const serverBusy = serverActiveKieCount > 0
  const inFlight = clientBusy || recoveredBanner || serverBusy || serverLocked
  const activeSlotCount = displaySlotCount()

  let modelLabel = ''
  if (clientBusy && activeLabel) modelLabel = activeLabel
  else if (recoveredBanner) modelLabel = recoveredLabel
  else if (serverBusy && activeLabel) modelLabel = activeLabel

  if (
    bannerSnapCache &&
    bannerSnapCache.inFlight === inFlight &&
    bannerSnapCache.modelLabel === modelLabel &&
    bannerSnapCache.activeSlotCount === activeSlotCount
  ) {
    return bannerSnapCache
  }
  bannerSnapCache = { inFlight, modelLabel, activeSlotCount }
  return bannerSnapCache
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

export function useGenerationBannerState() {
  return useSyncExternalStore(subscribe, getGenerationBannerState, () => serverSnapshot)
}

export function getGenerationSlotsFull(): boolean {
  tryExpireRecovered()
  isServerLockActive()
  return serverActiveKieCount + clientPendingCount >= KIE_PARALLEL_MAX
}

/** Блокировка полей промпта и медиа: заняты все 3 слота (сервер + ожидающие POST). */
export function useGenerationSlotsFull() {
  return useSyncExternalStore(subscribe, getGenerationSlotsFull, () => false)
}

/** @deprecated Предпочтительно useGenerationSlotsFull — форма не блокируется при 1–2 активных генерациях */
export function useGenerationFormLocked() {
  return useGenerationSlotsFull()
}

export function useGenerationApiPending() {
  return useSyncExternalStore(
    subscribe,
    () => {
      tryExpireRecovered()
      isServerLockActive()
      return clientPendingCount > 0
    },
    () => false
  )
}

export const useGenerationInFlight = useGenerationApiPending
