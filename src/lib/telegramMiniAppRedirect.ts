/**
 * Ссылка на сайт из чата Telegram открывается во встроенном браузере:
 * нет initData Mini App, автоматический location.replace на t.me часто блокируется.
 * Используем openTelegramLink (если есть) + явную кнопку с target="_top".
 */

import { shouldSkipDuplicateNavigation } from './navUrlDedupe'
import { ensureTelegramScript } from './ensureTelegramScript'

/** Один успешный авто-редирект из TG in-app браузера за загрузку страницы (Strict Mode / таймеры). */
let autoTgBrowserRedirectConsumed = false

const DEFAULT_TG_BOT = 'NeironAiBot'

function readEnvBotUsername(): string {
  const v = String(
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TELEGRAM_BOT_USERNAME ?? ''
  )
    .trim()
    .replace(/^@/, '')
  return v || DEFAULT_TG_BOT
}

function readEnvWebAppShortName(): string {
  return String(
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_TELEGRAM_WEBAPP_SHORT_NAME ?? ''
  ).trim()
}

/**
 * Ссылка в Telegram: Mini App (если задан short name в env) или чат с ботом.
 * На сервере без VITE_* всё равно будет t.me/NeironAiBot.
 */
export function buildTelegramMiniAppLaunchUrl(): string | null {
  if (typeof window === 'undefined') return null
  const bot = readEnvBotUsername()
  if (!bot) return null
  const shortName = readEnvWebAppShortName()
  const path = `${window.location.pathname}${window.location.search}`

  if (shortName) {
    let target = `https://t.me/${bot}/${shortName}`
    if (path && path !== '/' && path !== '') {
      const startapp = `go_${encodeURIComponent(path)}`
      if (startapp.length <= 512) {
        target += `?startapp=${encodeURIComponent(startapp)}`
      }
    }
    return target
  }

  return `https://t.me/${bot}`
}

/** В адресе есть признаки старта Mini App (до появления initData в объекте WebApp). */
function locationHasTelegramWebAppStartParams(): boolean {
  try {
    const h = window.location.hash || ''
    if (/tgWebApp|tgWebAppData|tgWebAppVersion|tgWebAppPlatform/i.test(h)) return true
    const q = new URLSearchParams(window.location.search)
    if (q.has('tgWebAppData') || q.has('tgWebAppPlatform') || q.has('tgWebAppVersion')) return true
  } catch {
    /* ignore */
  }
  return false
}

function referrerIsTelegramHost(): boolean {
  try {
    const r = document.referrer
    if (!r) return false
    const h = new URL(r).hostname.toLowerCase()
    return (
      h === 't.me' ||
      h === 'telegram.me' ||
      h === 'telegram.org' ||
      h === 'web.telegram.org' ||
      h.endsWith('.telegram.org')
    )
  } catch {
    return false
  }
}

/**
 * Встроенный браузер / WebView Telegram.
 * Не используем Telegram.WebApp.platform: в обычном Safari/Chrome на телефоне там часто ios/android,
 * из‑за этого ложно срабатывал редирект на бота при заходе с поиска по домену.
 */
export function isLikelyTelegramInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/Telegram|TDesktop|TelegramBot|Telegram-Android|TelegramWebApp/i.test(ua)) return true
  if (referrerIsTelegramHost()) return true
  return false
}

/** Полноценная сессия Mini App (есть initData для WebApp). */
export function isTelegramMiniAppSession(): boolean {
  const init = window.Telegram?.WebApp?.initData?.trim() ?? ''
  return init.length > 0
}

/** Показать плашку: похоже на встроенный браузер Telegram и ещё не открыт Mini App с initData. */
export function shouldPromptTelegramMiniApp(): boolean {
  if (typeof window === 'undefined') return false
  if (isTelegramMiniAppSession()) return false
  // Десктоп: в UA уже TDesktop, а initData приходит после async SDK — иначе ложный редирект и «закрытие» Mini App.
  if (locationHasTelegramWebAppStartParams()) return false
  return isLikelyTelegramInAppBrowser()
}

/**
 * Открыть t.me / telegram.me через API WebApp — работает во встроенном браузере Telegram
 * даже без initData (страница по обычной https-ссылке из чата).
 */
export function tryTelegramWebAppBridgeOpen(url: string): boolean {
  const u = String(url ?? '').trim()
  if (!/^https:\/\/(t\.me|telegram\.me)(\/|$)/i.test(u)) return false
  const tg = window.Telegram?.WebApp as
    | { openTelegramLink?: (x: string) => void; openLink?: (x: string, o?: { try_instant_view?: boolean }) => void }
    | undefined
  if (!tg) return false
  if (typeof tg.openTelegramLink === 'function') {
    try {
      tg.openTelegramLink(u)
      return true
    } catch {
      /* fall through */
    }
  }
  if (typeof tg.openLink === 'function') {
    try {
      tg.openLink(u, { try_instant_view: false })
      return true
    } catch {
      return false
    }
  }
  return false
}

/**
 * Полноценная сессия Mini App: только тогда же считаем «уже внутри приложения».
 */
export function tryOpenTelegramMiniAppLink(url: string): boolean {
  if (!isTelegramMiniAppSession()) return false
  return tryTelegramWebAppBridgeOpen(url)
}

function syntheticAnchorClick(target: '_blank' | '_top', url: string): boolean {
  try {
    const a = document.createElement('a')
    a.href = url
    a.target = target
    if (target === '_blank') a.rel = 'noopener noreferrer'
    a.style.cssText = 'position:fixed;left:-9999px;top:0'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return true
  } catch {
    return false
  }
}

export type OpenTelegramHttpsLinkOpts = {
  /** Если к popup/_blank доступ закрыт — перейти на t.me в этом же окне (редирект на Mini App из браузера TG). */
  sameWindowNavigate?: boolean
  /** Повторные попытки редиректа с разной задержкой — не блокировать dedupe. */
  skipDedupe?: boolean
}

/**
 * Открыть https://t.me/... : bridge Telegram WebApp → popup → синтетический клик.
 * Для входа через бота вкладку опроса не закрываем (sameWindowNavigate: false по умолчанию).
 */
export function openTelegramHttpsLink(url: string, opts?: OpenTelegramHttpsLinkOpts): boolean {
  const u = String(url ?? '').trim()
  if (!u) return false
  if (!opts?.skipDedupe && shouldSkipDuplicateNavigation(u)) return true

  if (tryOpenTelegramMiniAppLink(u)) return true
  if (isLikelyTelegramInAppBrowser() && tryTelegramWebAppBridgeOpen(u)) return true

  /**
   * Обычный мобильный браузер (не WebView Telegram): синтетический клик по target="_blank"
   * почти всегда «успешен» в коде, но вкладка не открывается — дальше не доходим до fallback.
   * Сразу пробуем window.open; если нет — пусть вызывающий сделает location.assign (как в LoginPage).
   */
  const mobileOutsideTg =
    typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '') &&
    !isLikelyTelegramInAppBrowser()

  if (mobileOutsideTg) {
    if (opts?.sameWindowNavigate) {
      try {
        window.location.assign(u)
        return true
      } catch {
        /* ignore */
      }
    }
    try {
      const w = window.open(u, '_blank', 'noopener,noreferrer')
      if (w) return true
    } catch {
      /* ignore */
    }
    return false
  }

  // Десктоп: не цеплять window.open и <a> подряд — часто два окна/вкладки на одну ссылку.
  if (syntheticAnchorClick('_blank', u)) return true
  if (opts?.sameWindowNavigate) {
    if (syntheticAnchorClick('_top', u)) return true
    try {
      window.location.assign(u)
      return true
    } catch {
      /* ignore */
    }
  }
  try {
    const w = window.open(u, '_blank', 'noopener,noreferrer')
    if (w) return true
  } catch {
    /* ignore */
  }
  return false
}

/** Путь для navigate после открытия Mini App с startapp=go_… */
export function parseTelegramGoPathParam(startParam: string | undefined): string | null {
  if (!startParam || typeof startParam !== 'string') return null
  const sp = startParam.trim()
  if (!sp.startsWith('go_')) return null
  try {
    const raw = decodeURIComponent(sp.slice(3))
    if (!raw.startsWith('/') || raw.startsWith('//')) return null
    if (/[\s\r\n]/.test(raw) || raw.includes('://')) return null
    return raw.length > 900 ? null : raw
  } catch {
    return null
  }
}

const DISMISS_KEY = 'neiro_tg_mini_banner_dismiss'

export function isTelegramMiniBannerDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

export function dismissTelegramMiniBannerPersist(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1')
  } catch {
    /* ignore */
  }
}

const ANDROID_TG_SENT_KEY = 'neiro_tg_android_tg_sent'
const ANDROID_TG_TS_KEY = 'neiro_tg_android_ts'
const ANDROID_TG_HTTPS_FALLBACK_MS = 700

function botUsernameFromTmeHttps(url: string): string | null {
  const m = /^https:\/\/t\.me\/([^/?#]+)/i.exec(String(url ?? '').trim())
  return m ? m[1] : null
}

/**
 * Редирект только из встроенного браузера Telegram (ссылка из чата без Mini App).
 * Обычный мобильный браузер с поиска по домену не трогаем — там сайт открывается как обычно.
 *
 * Важно: сначала ждём telegram-web-app.js — на десктопе иначе нет initData в первый тик,
 * срабатывает shouldPrompt и location.replace(t.me) «выбивает» из Mini App.
 */
export function tryRedirectTelegramBrowserToMiniApp(): void {
  void ensureTelegramScript()
    .catch(() => {})
    .then(() => {
      requestAnimationFrame(() => {
        tryRedirectTelegramBrowserToMiniAppAfterSdk()
      })
    })
}

function tryRedirectTelegramBrowserToMiniAppAfterSdk(): void {
  if (autoTgBrowserRedirectConsumed) return
  try {
    window.Telegram?.WebApp?.ready?.()
  } catch {
    /* ignore */
  }
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('tg_web') === '1') return
  } catch {
    /* ignore */
  }

  const url = buildTelegramMiniAppLaunchUrl()
  if (!url) return

  if (!shouldPromptTelegramMiniApp()) return

  const bot = botUsernameFromTmeHttps(url) ?? readEnvBotUsername()
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''

  if (/Android/i.test(ua)) {
    try {
      const sent = sessionStorage.getItem(ANDROID_TG_SENT_KEY) === '1'
      const ts = Number.parseInt(sessionStorage.getItem(ANDROID_TG_TS_KEY) || '0', 10) || 0
      if (!sent) {
        sessionStorage.setItem(ANDROID_TG_SENT_KEY, '1')
        sessionStorage.setItem(ANDROID_TG_TS_KEY, String(Date.now()))
        window.location.href = `tg://resolve?domain=${encodeURIComponent(bot)}`
        return
      }
      if (ts > 0 && Date.now() - ts < ANDROID_TG_HTTPS_FALLBACK_MS) return
    } catch {
      /* ignore */
    }
  }

  try {
    const topWin = window.top
    if (topWin && topWin !== window) {
      topWin.location.replace(url)
    } else {
      window.location.replace(url)
    }
    autoTgBrowserRedirectConsumed = true
    return
  } catch {
    try {
      window.location.href = url
      autoTgBrowserRedirectConsumed = true
      return
    } catch {
      /* ignore */
    }
  }

  if (tryTelegramWebAppBridgeOpen(url)) {
    return
  }

  const opened = openTelegramHttpsLink(url, { sameWindowNavigate: true, skipDedupe: true })
  if (opened) autoTgBrowserRedirectConsumed = true
}
