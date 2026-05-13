import { useLayoutEffect, useState } from 'react'
import { ensureTelegramScript } from '../lib/ensureTelegramScript'

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string
        initDataUnsafe?: { start_param?: string }
        colorScheme: 'light' | 'dark'
        platform: string
        version: string
        ready: () => void
        expand: () => void
        onEvent?: (eventType: string, eventHandler: () => void) => void
        offEvent?: (eventType: string, eventHandler: () => void) => void
        /** Bot API 7.7+: свайп вниз не сворачивает Mini App во вкладку */
        disableVerticalSwipes?: () => void
        enableVerticalSwipes?: () => void
        /** Bot API 8.0+: полноэкранный режим (как у «конкурентов») */
        requestFullscreen?: () => void
        exitFullscreen?: () => void
        /** Открыть ссылку t.me внутри клиента Telegram */
        openTelegramLink?: (url: string) => void
        openLink?: (url: string, options?: { try_instant_view?: boolean }) => void
        openInvoice?: (url: string, callback?: (status: string) => void) => void
        /** Bot API 8.0+: скачать по URL без выхода из Mini App (не открывать медиа на весь экран) */
        downloadFile?: (params: { url: string }) => void | Promise<void>
        CloudStorage?: {
          setItem: (key: string, value: string, cb?: (err: Error | null) => void) => void
          getItem: (key: string, cb: (err: Error | null, value?: string) => void) => void
          removeItem: (key: string, cb?: (err: Error | null) => void) => void
        }
      }
    }
  }
}

const fallbackWebApp = {
  initData: '',
  platform: '',
  colorScheme: 'light' as const,
  ready: () => {},
  expand: () => {},
}

function getTelegramWebApp() {
  return window.Telegram?.WebApp
}

/**
 * initData может заполниться в WebApp чуть после первого кадра React.
 * Если читать его только до первого действия пользователя (вставка в поле → setState → ре-рендер),
 * AuthGate внезапно увидит initData и переключит экран со страницы логина на спиннер — «форма сбросилась».
 * Держим initData в state и синхронизируем в первые секунды + при viewport (клавиатура TG).
 */
export function useTelegram() {
  const [initData, setInitData] = useState(() => getTelegramWebApp()?.initData ?? '')

  useLayoutEffect(() => {
    let cancelled = false
    let detach: (() => void) | undefined

    const bind = () => {
      const app = getTelegramWebApp()
      if (!app || cancelled) return

      const sync = () => {
        const next = app.initData ?? ''
        setInitData((prev) => (prev === next ? prev : next))
      }

      sync()

      let raf = 0
      let frames = 0
      const maxFrames = 120

      const poll = () => {
        if (cancelled) return
        sync()
        frames++
        const filled = Boolean((app.initData ?? '').trim())
        if (!filled && frames < maxFrames) {
          raf = window.requestAnimationFrame(poll)
        }
      }
      raf = window.requestAnimationFrame(poll)

      const lateId = window.setTimeout(sync, 2500)

      const onViewport = () => sync()
      try {
        app.onEvent?.('viewport_changed', onViewport)
        app.onEvent?.('viewportChanged', onViewport)
      } catch {
        /* старый клиент */
      }

      detach = () => {
        window.cancelAnimationFrame(raf)
        window.clearTimeout(lateId)
        try {
          app.offEvent?.('viewport_changed', onViewport)
          app.offEvent?.('viewportChanged', onViewport)
        } catch {
          /* нет API */
        }
      }
    }

    void ensureTelegramScript()
      .then(() => {
        if (!cancelled) bind()
      })
      .catch(() => {
        /* скрипт недоступен — обычный браузер без Mini App */
      })

    return () => {
      cancelled = true
      detach?.()
    }
  }, [])

  const tg = getTelegramWebApp() ?? fallbackWebApp

  return {
    tg,
    initData,
    platform: (tg.platform ?? '').trim(),
    colorScheme: tg.colorScheme ?? 'light',
    ready: () => (getTelegramWebApp() ?? fallbackWebApp).ready(),
    expand: () => (getTelegramWebApp() ?? fallbackWebApp).expand(),
  }
}
