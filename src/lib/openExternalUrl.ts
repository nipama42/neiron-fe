import type { MouseEvent } from 'react'
import { isTelegramMiniAppSession } from './telegramMiniAppRedirect'

type TgWindow = Window & {
  Telegram?: {
    WebApp?: {
      openLink?: (url: string, options?: { try_instant_view?: boolean }) => void
      openTelegramLink?: (url: string) => void
    }
  }
}

/**
 * В Telegram WebView `target="_blank"` часто не срабатывает; для внешних ссылок нужен `openLink`.
 * Для `t.me` / `telegram.me` ссылок желателен `openTelegramLink` (invoice, crypto bot mini app и т.п.).
 * С modifier-keys (Ctrl/⌘) оставляем стандартное поведение браузера.
 *
 * telegram-web-app.js грузится в index.html всегда: без Mini App-сессии (пустой initData) bridges
 * нельзя — иначе на ПК пустое окно (оплата и др. внешние HTTPS).
 */
export function onExternalAnchorClick(e: MouseEvent<HTMLAnchorElement>) {
  if (e.defaultPrevented) return
  if (e.button !== 0) return
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const u = e.currentTarget.href
  if (!u) return

  const tw = (window as TgWindow).Telegram?.WebApp
  if (!isTelegramMiniAppSession()) return

  const isTelegramMe =
    /^https?:\/\/(t\.me|telegram\.me)\//i.test(u) ||
    /^tg:/i.test(u)

  try {
    if (isTelegramMe && typeof tw?.openTelegramLink === 'function') {
      e.preventDefault()
      tw.openTelegramLink(u)
      return
    }
  } catch {
    /* fall through to openLink / native */
  }

  try {
    if (typeof tw?.openLink === 'function') {
      e.preventDefault()
      tw.openLink(u, { try_instant_view: false })
    }
  } catch {
    /* native <a> */
  }
}
