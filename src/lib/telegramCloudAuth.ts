/**
 * Резервная сессия в Telegram CloudStorage: в Mini App WebView localStorage
 * иногда очивается при сворачивании — тогда теряются токен и история API (поддержка и т.д.).
 */

const KEY_TOKEN = 'neiro_token'
const KEY_USER = 'neiro_user'

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
    if (token && token !== 'local-dev' && user) {
      cs.setItem(KEY_TOKEN, token, () => {})
      cs.setItem(KEY_USER, user, () => {})
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
  } catch {
    /* ignore */
  }
}

/** Если localStorage пуст, восстанавливаем token + neiro_user из облака Telegram. */
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
        onRestored(token, userJson)
      })
    })
  } catch {
    /* ignore */
  }
}
