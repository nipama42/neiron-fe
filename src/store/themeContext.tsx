import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ensureTelegramScript } from '../lib/ensureTelegramScript'
import {
  applyThemeToDocument,
  readSavedTheme,
  readTelegramColorScheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '../lib/themePreference'

export type { Theme }

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const t = resolveTheme()
    applyThemeToDocument(t)
    return t
  })

  const setTheme = useCallback((t: Theme) => {
    applyThemeToDocument(t)
    setThemeState(t)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t)
    } catch {
      /* ignore */
    }
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  useEffect(() => {
    let cancelled = false
    void ensureTelegramScript().then(() => {
      if (cancelled || readSavedTheme()) return
      const tg = readTelegramColorScheme()
      if (tg) {
        applyThemeToDocument(tg)
        setThemeState(tg)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
