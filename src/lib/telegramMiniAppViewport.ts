type TelegramWebAppInsets = {
  safeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number }
  contentSafeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number }
  onEvent?: (event: string, handler: (...args: unknown[]) => void) => void
}

type WebAppFullscreen = TelegramWebAppInsets & {
  requestFullscreen?: () => void
  isFullscreen?: boolean
}

let listenersSetUp = false
let firstGestureFullscreenAttached = false

function tryRequestFullscreen(): void {
  try {
    const wf = window.Telegram?.WebApp as WebAppFullscreen | undefined
    if (!wf || typeof wf.requestFullscreen !== 'function') return
    if (wf.isFullscreen === true) return
    wf.requestFullscreen()
  } catch {
    /* ignore */
  }
}

/** Если клиент не пустил fullscreen из JS, первое касание доводит до полного экрана (один раз). */
function attachFirstGestureFullscreenOnce(): void {
  if (firstGestureFullscreenAttached) return
  firstGestureFullscreenAttached = true
  const handler = (): void => {
    document.removeEventListener('pointerdown', handler, true)
    try {
      const wf = window.Telegram?.WebApp as WebAppFullscreen | undefined
      if (wf?.isFullscreen === true) return
    } catch {
      /* ignore */
    }
    tryRequestFullscreen()
  }
  document.addEventListener('pointerdown', handler, true)
}

function syncTelegramSafeAreaVars(): void {
  const w = window.Telegram?.WebApp as TelegramWebAppInsets | undefined
  if (!w) return
  const setN = (name: string, v: number | undefined) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return
    document.documentElement.style.setProperty(name, `${Math.max(0, v)}px`)
  }
  const si = w.safeAreaInset
  const ci = w.contentSafeAreaInset
  setN('--tg-safe-area-inset-top', si?.top)
  setN('--tg-safe-area-inset-bottom', si?.bottom)
  setN('--tg-safe-area-inset-left', si?.left)
  setN('--tg-safe-area-inset-right', si?.right)
  setN('--tg-content-safe-area-inset-top', ci?.top)
  setN('--tg-content-safe-area-inset-bottom', ci?.bottom)
  setN('--tg-content-safe-area-inset-left', ci?.left)
  setN('--tg-content-safe-area-inset-right', ci?.right)
}

/**
 * Мягкое восстановление после openLink / openInvoice (без display:none / requestFullscreen).
 */
export function forceRepaintAfterOverlay(): void {
  try {
    syncTelegramSafeAreaVars()
  } catch {
    /* ignore */
  }
  try {
    window.Telegram?.WebApp?.expand?.()
  } catch {
    /* ignore */
  }
}

/** @deprecated используйте forceRepaintAfterOverlay */
export function recoverTelegramMiniAppAfterOverlay(): void {
  forceRepaintAfterOverlay()
}

export function initTelegramMiniAppViewport(): void {
  const w = window.Telegram?.WebApp
  if (!w) return

  document.documentElement.dataset.telegramMiniApp = '1'

  try { w.ready() } catch { /* ignore */ }
  try { w.expand() } catch { /* ignore */ }
  try { syncTelegramSafeAreaVars() } catch { /* ignore */ }

  // Полноэкранный Mini App (Bot API 8+): сначала несколько попыток без жеста; иначе TG часто ждёт тапа.
  tryRequestFullscreen()
  requestAnimationFrame(() => {
    tryRequestFullscreen()
  })
  window.setTimeout(() => tryRequestFullscreen(), 120)
  window.setTimeout(() => tryRequestFullscreen(), 450)
  attachFirstGestureFullscreenOnce()

  const ext = w as typeof w & { disableVerticalSwipes?: () => void }
  try {
    if (typeof ext.disableVerticalSwipes === 'function') ext.disableVerticalSwipes()
  } catch { /* ignore */ }

  if (listenersSetUp) return
  listenersSetUp = true

  // Синхронизация safe-area при изменении viewport
  try {
    const tw = w as TelegramWebAppInsets
    if (typeof tw.onEvent === 'function') {
      const syncVars = () => { try { syncTelegramSafeAreaVars() } catch { /* ignore */ } }
      try { tw.onEvent('viewportChanged', syncVars) } catch { /* ignore */ }
      try { tw.onEvent('viewport_changed', syncVars) } catch { /* ignore */ }
      // Не вешаем fullscreenChanged → requestFullscreen (см. комментарий выше).
    }
  } catch { /* ignore */ }

  // После закрытия openLink / openInvoice — мягкий expand/sync. Только реальный возврат из фона / bfcache.
  let lastVisiblePaint = 0
  let docWasHidden = document.visibilityState === 'hidden'

  const scheduleRepaint = () => {
    const now = Date.now()
    if (now - lastVisiblePaint < 900) return
    lastVisiblePaint = now
    window.setTimeout(() => forceRepaintAfterOverlay(), 200)
  }

  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        docWasHidden = true
        return
      }
      if (document.visibilityState === 'visible' && docWasHidden) {
        docWasHidden = false
        scheduleRepaint()
      }
    })
  } catch { /* ignore */ }

  try {
    window.addEventListener('pageshow', (ev: PageTransitionEvent) => {
      if (ev.persisted) scheduleRepaint()
    })
  } catch { /* ignore */ }

  // Не вешаем repaint на window «focus» — ломает вставку из буфера (см. историю).
}
