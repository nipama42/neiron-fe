import { useEffect, useMemo, useState } from 'react'
import {
  buildTelegramMiniAppLaunchUrl,
  dismissTelegramMiniBannerPersist,
  isTelegramMiniBannerDismissed,
  shouldPromptTelegramMiniApp,
} from '../lib/telegramMiniAppRedirect'

/**
 * Плашка во встроенном браузере Telegram: открыть Mini App бота (ссылка из чата не даёт initData).
 */
export default function TelegramMiniAppEnterBanner() {
  const launchUrl = useMemo(() => buildTelegramMiniAppLaunchUrl(), [])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!launchUrl) return
    if (!shouldPromptTelegramMiniApp()) return
    if (isTelegramMiniBannerDismissed()) return
    setVisible(true)
  }, [launchUrl])

  if (!launchUrl || !visible) return null

  return (
    <div
      className="fixed left-0 right-0 bottom-0 z-[10050] px-3 pt-2 pointer-events-none"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <div
        className="pointer-events-auto mx-auto max-w-lg rounded-2xl border border-[var(--color-brand)]/35 bg-[var(--color-surface)] shadow-[0_-8px_32px_rgba(0,0,0,0.18)] dark:shadow-[0_-8px_32px_rgba(0,0,0,0.45)] px-4 py-3"
        role="dialog"
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-slate-900 dark:text-white text-center leading-snug">
          Откройте NEIRO через бота
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-1 leading-relaxed">
          В этом окне Telegram сайт без приложения бота. Нажмите кнопку — откроется мини-приложение с входом.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a
            href={launchUrl}
            target="_top"
            rel="noopener noreferrer"
            className="flex min-h-[46px] items-center justify-center rounded-xl bg-[var(--color-brand)] px-4 text-sm font-semibold text-[var(--color-on-brand)] hover:brightness-110 active:scale-[0.98] transition-all text-center"
          >
            Открыть в Telegram
          </a>
          <button
            type="button"
            className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-600 px-4 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80"
            onClick={() => {
              dismissTelegramMiniBannerPersist()
              setVisible(false)
            }}
          >
            Остаться здесь
          </button>
        </div>
      </div>
    </div>
  )
}
