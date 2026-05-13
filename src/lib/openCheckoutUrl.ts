import { isTelegramMiniAppSession } from './telegramMiniAppRedirect'
import { shouldSkipDuplicateNavigation } from './navUrlDedupe'

export type CryptobotPayUrls = {
  payUrl: string
  payUrlMini?: string | null
  payUrlBot?: string | null
  payUrlWeb?: string | null
}

export type OrderPayPick = {
  method: 'sbp' | 'cryptobot'
  payUrl: string
  payUrlMini?: string | null
  payUrlBot?: string | null
  payUrlWeb?: string | null
}

export type OpenCheckoutOpts = { force?: boolean }

/**
 * Открыть оплату CryptoBot.
 *
 * В Telegram Mini App:
 *   1. openTelegramLink(mini_app_invoice_url) — открывает CryptoPay Mini App с конкретным счётом
 *      прямо внутри Telegram, без браузера. Mini App временно уходит в фон.
 *   2. Fallback: openTelegramLink(bot_invoice_url) — открывает CryptoBot, который пришлёт
 *      сообщение со счётом и кнопкой оплаты.
 *   3. Fallback: openLink (браузер) — если openTelegramLink недоступен.
 *
 * Вне Telegram (браузер):
 *   bot_invoice_url (t.me/CryptoBot?start=...) → открывает Telegram, CryptoBot присылает счёт.
 */
export function openCryptobotCheckout(urls: CryptobotPayUrls) {
  const mini = String(urls.payUrlMini ?? '').trim()
  const bot = String(urls.payUrlBot ?? '').trim()
  const web = String(urls.payUrlWeb ?? '').trim()
  const primary = String(urls.payUrl ?? '').trim()

  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined
  const inMini = isTelegramMiniAppSession()

  if (inMini && tg) {
    // Попытка 1: openTelegramLink с mini_app_invoice_url → CryptoPay Mini App, без браузера
    // Попытка 2: openTelegramLink с bot_invoice_url → CryptoBot пришлёт счёт в чат
    const telegramUrl = mini || bot || web || primary
    if (telegramUrl && shouldSkipDuplicateNavigation(telegramUrl)) return
    if (telegramUrl && typeof tg.openTelegramLink === 'function') {
      try {
        tg.openTelegramLink(telegramUrl)
        return
      } catch {
        /* fall through */
      }
    }
    // Fallback: openLink (браузер)
    const fallback = mini || bot || web || primary
    if (fallback && typeof tg.openLink === 'function') {
      try {
        tg.openLink(fallback, { try_instant_view: false })
        return
      } catch {
        /* ignore */
      }
    }
    return
  }

  // Вне Telegram (браузер): bot_invoice_url лучше всего — t.me/CryptoBot?start=...
  // триггерит Telegram (если установлен) и CryptoBot присылает счёт.
  const url = bot || mini || web || primary
  openCheckoutUrl(url)
}

export function pickCheckoutPayUrl(order: OrderPayPick): string {
  if (order.method === 'sbp') return String(order.payUrl ?? '').trim()
  // Для CryptoBot используй openCryptobotCheckout напрямую; эта функция — для СБП и fallback
  const mini = String(order.payUrlMini ?? '').trim()
  const bot = String(order.payUrlBot ?? '').trim()
  const web = String(order.payUrlWeb ?? '').trim()
  const primary = String(order.payUrl ?? '').trim()
  return mini || bot || web || primary
}

/**
 * Открыть страницу оплаты (используется для СБП).
 * Для CryptoBot используй openCryptobotCheckout.
 */
export function openCheckoutUrl(rawUrl: string, opts?: OpenCheckoutOpts) {
  const url = String(rawUrl ?? '').trim()
  if (!url) return

  if (shouldSkipDuplicateNavigation(url, opts?.force)) return

  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined
  const inMini = isTelegramMiniAppSession()

  if (inMini && tg) {
    // Внешний браузер; Mini App остаётся открытым
    if (typeof tg.openLink === 'function') {
      try {
        tg.openLink(url, { try_instant_view: false })
        return
      } catch {
        /* ignore */
      }
    }
    return
  }

  // Вне Mini App — одна вкладка: сначала программный <a> (двойные открытия при window.open+a).
  try {
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    a.remove()
    return
  } catch {
    /* fallback */
  }
  try {
    const w = window.open(url, '_blank', 'noopener,noreferrer')
    if (w) return
  } catch {
    /* ignore */
  }
}
