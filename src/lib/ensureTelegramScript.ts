const TG_SCRIPT_SRC = 'https://telegram.org/js/telegram-web-app.js'

let loadPromise: Promise<void> | null = null

/** Неблокирующая подгрузка SDK Mini App (вместо синхронного script в head — меньше render-blocking). */
export function ensureTelegramScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.Telegram?.WebApp) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-neiro-tg-web-app]'
    ) as HTMLScriptElement | null
    if (existing) {
      const done = () => {
        if (window.Telegram?.WebApp) resolve()
        else resolve()
      }
      if (existing.getAttribute('data-loaded') === '1') {
        done()
        return
      }
      existing.addEventListener('load', () => {
        existing.setAttribute('data-loaded', '1')
        done()
      })
      existing.addEventListener('error', () => reject(new Error('Telegram WebApp script failed')))
      return
    }

    const s = document.createElement('script')
    s.src = TG_SCRIPT_SRC
    s.async = true
    s.dataset.neiroTgWebApp = '1'
    s.addEventListener('load', () => {
      s.setAttribute('data-loaded', '1')
      resolve()
    })
    s.addEventListener('error', () => reject(new Error('Telegram WebApp script failed')))
    document.head.appendChild(s)
  })

  return loadPromise
}
