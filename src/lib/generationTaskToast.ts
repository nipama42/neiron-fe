import { useSyncExternalStore } from 'react'
import { KIE_PARALLEL_MAX } from './generationInFlight'

export type GenerationTaskToastState =
  | {
      id: number
      kind: 'start'
      modelLabel: string
      slotsFilled: number
      maxSlots: number
    }
  | {
      id: number
      kind: 'success'
      modelLabel: string
      detail: string
    }
  | {
      id: number
      kind: 'error'
      modelLabel: string
      message: string
    }
  | null

let toast: GenerationTaskToastState = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

let nextId = 0
const VISIBLE_MS = 5600

function scheduleHide() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  hideTimer = setTimeout(() => {
    toast = null
    hideTimer = null
    emit()
  }, VISIBLE_MS)
}

type ShowStart = {
  kind: 'start'
  modelLabel: string
  slotsFilled: number
  maxSlots?: number
}
type ShowSuccess = { kind: 'success'; modelLabel: string; detail: string }
type ShowError = { kind: 'error'; modelLabel: string; message: string }

/**
 * Плавное уведомление: старт, успех или ошибка генерации. Рендерится в App — на всех экранах.
 */
export function showGenerationTaskToast(opts: ShowStart | ShowSuccess | ShowError) {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  nextId += 1
  if (opts.kind === 'start') {
    const max = opts.maxSlots ?? KIE_PARALLEL_MAX
    const filled = Math.min(Math.max(0, opts.slotsFilled), max)
    toast = {
      id: nextId,
      kind: 'start',
      modelLabel: (opts.modelLabel ?? '').trim() || 'Генерация',
      slotsFilled: filled,
      maxSlots: max,
    }
  } else if (opts.kind === 'success') {
    toast = {
      id: nextId,
      kind: 'success',
      modelLabel: (opts.modelLabel ?? '').trim() || 'Генерация',
      detail: opts.detail.trim() || 'Готово',
    }
  } else {
    toast = {
      id: nextId,
      kind: 'error',
      modelLabel: (opts.modelLabel ?? '').trim() || 'Генерация',
      message: (opts.message ?? '').trim() || 'Ошибка',
    }
  }
  emit()
  scheduleHide()
}

/** @deprecated используйте showGenerationTaskToast({ kind: 'start', ... }) */
export function showGenerationTaskStartedToast(opts: { modelLabel: string; slotsFilled: number; maxSlots?: number }) {
  showGenerationTaskToast({ kind: 'start', ...opts })
}

export function dismissGenerationTaskToast() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  toast = null
  emit()
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

function getSnapshot() {
  return toast
}

export function useGenerationTaskToast() {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}

/**
 * Типичный обрыв fetch в браузере (запрос не дошёл до API или ответ не прочитан).
 * Такие случаи не стоит путать с отказом Kie и не логировать как generation_fail с сырой строкой.
 */
export function isClientTransportGenerationError(msg: string | null | undefined): boolean {
  const l = (msg ?? '').trim().toLowerCase()
  if (!l) return false
  return (
    l.includes('failed to fetch') ||
    l.includes('networkerror') ||
    l.includes('network error') ||
    l.includes('network request failed') ||
    l.includes('load failed') ||
    l === 'fetch failed' ||
    l.includes('fetch failed') ||
    l.includes('the operation was aborted') ||
    l.includes('request aborted') ||
    l.includes('internet connection appears to be offline')
  )
}

/**
 * Сообщения от Kie/API часто на английском — приводим к нормальному тексту в уведомлении.
 */
export function formatGenerationErrorMessage(msg: string | null | undefined): string {
  const s = (msg ?? '').trim()
  if (!s) return 'Ошибка генерации'
  const l = s.toLowerCase()
  if (isClientTransportGenerationError(s)) {
    return 'Нет связи с сервером. Проверьте интернет и обновите страницу; если списались кредиты — загляните в историю генераций.'
  }
  if (l.includes('internal error') && l.includes('try again')) {
    return 'Сервис временно недоступен. Попробуйте ещё раз чуть позже.'
  }
  if (l.includes('internal error')) {
    return 'Внутренняя ошибка. Попробуйте ещё раз позже.'
  }
  if (l.includes('please try again later')) {
    return 'Попробуйте ещё раз позже.'
  }
  return s
}
