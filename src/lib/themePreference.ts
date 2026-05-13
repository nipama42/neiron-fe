/** Same key as inline script in index.html and ThemeProvider */
export const THEME_STORAGE_KEY = 'neiro_theme'

export type Theme = 'light' | 'dark'

export function readSavedTheme(): Theme | null {
  try {
    const s = localStorage.getItem(THEME_STORAGE_KEY)
    if (s === 'light' || s === 'dark') return s
  } catch {
    /* private mode */
  }
  return null
}

export function readTelegramColorScheme(): Theme | null {
  try {
    const tg = window.Telegram?.WebApp?.colorScheme
    if (tg === 'dark' || tg === 'light') return tg
  } catch {
    /* ignore */
  }
  return null
}

export function readSystemColorScheme(): Theme {
  try {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {
    /* ignore */
  }
  return 'light'
}

/** Saved theme -> Telegram if SDK ready -> system preference */
export function resolveTheme(): Theme {
  return readSavedTheme() ?? readTelegramColorScheme() ?? readSystemColorScheme()
}

export function applyThemeToDocument(t: Theme) {
  document.documentElement.dataset.theme = t
}