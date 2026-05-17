/**
 * Резервная сессия в Telegram CloudStorage: в Mini App WebView localStorage
 * иногда очивается при сворачивании — тогда теряются токен и история API (поддержка и т.д.).
 */

const KEY_TOKEN = 'neiro_token'
const KEY_USER = 'neiro_user'
const KEY_REFRESH = 'neiro_refresh_token'
const LS_REFRESH = 'neiro_refresh_token'

function cloud(): NonNullable<Window['Telegram']>['WebApp']['CloudStorage'] | null {
  try {
    return window.Telegram?.WebApp?.CloudStorage ?? null
  } catch {
    return null
  }
}

export function syncSessionToTelegramCloud(): void {
  const cs = cloud()
  if (!cs) return
  try {
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('neiro_user')
    const refresh = localStorage.getItem(LS_REFRESH)
    if (token && token !== 'local-dev' && user) {
      cs.setItem(KEY_TOKEN, token, () => {})
      cs.setItem(KEY_USER, user, () => {})
      if (refresh) cs.setItem(KEY_REFRESH, refresh, () => {})
    }
  } catch {
    /* ignore */
  }
}

export function clearTelegramCloudSession(): void {
  const cs = cloud()
  if (!cs) return
  try {
    cs.removeItem(KEY_TOKEN, () => {})
    cs.removeItem(KEY_USER, () => {})
    cs.removeItem(KEY_REFRESH, () => {})
  } catch {
    /* ignore */
  }
}

/** Если localStorage пуст, восстанавливаем token + neiro_user (+ refresh) из облака Telegram. */
export function tryRestoreSessionFromTelegramCloud(
  onRestored: (token: string, userJson: string) => void
): void {
  const cs = cloud()
  if (!cs) return
  const localT = localStorage.getItem('token')
  if (localT && localT !== 'local-dev') return

  try {
    cs.getItem(KEY_TOKEN, (err, token) => {
      if (err || !token || token === 'local-dev') return
      cs.getItem(KEY_USER, (err2, userJson) => {
        if (err2 || !userJson) return
        try {
          JSON.parse(userJson)
        } catch {
          return
        }
        // Восстанавливаем refresh-токен тоже (огнем и мечом, без блокировки)
        cs.getItem(KEY_REFRESH, (_err3, refresh) => {
          if (refresh) {
            try { localStorage.setItem(LS_REFRESH, refresh) } catch { /* ignore */ }
          }
        })
        onRestored(token, userJson)
      })
    })
  } catch {
    /* ignore */
  }
}
