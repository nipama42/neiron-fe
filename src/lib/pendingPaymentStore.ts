/**
 * Хранит orderId последнего незавершённого платежа в localStorage.
 * При следующем запуске приложения / открытии профиля — проверяем статус один раз.
 *
 * Это необходимо для СБП: вебхука от 1Payment нет, статус проверяется
 * только активным polling-ом в модальном окне. Если окно закрыть до зачисления —
 * без этого механизма кредиты не будут применены автоматически.
 *
 * CryptoBot уже покрыт вебхуком на сервере, но этот механизм даёт резервную
 * проверку и обновление UI без перезагрузки страницы.
 */

const KEY = 'neiro_pending_order'
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 часа — после этого заказ истёк

interface Stored {
  orderId: string
  method: 'sbp' | 'cryptobot'
  savedAt: number
}

export function savePendingOrder(orderId: string, method: 'sbp' | 'cryptobot'): void {
  try {
    const data: Stored = { orderId, method, savedAt: Date.now() }
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function clearPendingOrder(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function loadPendingOrder(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Stored
    if (!data.orderId || !data.savedAt) return null
    if (Date.now() - data.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}
