import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthResponse, AuthUser } from '../api/auth'
import { getMe } from '../api/me'
import { syncGenerationLockFromServer } from '../lib/generationInFlight'
import {
  clearTelegramCloudSession,
  syncSessionToTelegramCloud,
  tryRestoreSessionFromTelegramCloud,
} from '../lib/telegramCloudAuth'

const USER_STORAGE_KEY = 'neiro_user'
/** После «Выйти» в Mini App initData всё ещё есть — без флага AuthGate снова крутит авто-логин */
export const SKIP_TG_AUTO_LOGIN_KEY = 'neiro_skip_tg_auto_login'

// Используем localStorage для постоянной сессии (переживает закрытие вкладки / Telegram WebApp)
const storage = typeof localStorage !== 'undefined' ? localStorage : sessionStorage

function readStoredUser(): AuthUser | null {
  try {
    const raw = storage.getItem(USER_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  userFetched: boolean
  setAuth: (data: AuthResponse) => void
  clearAuth: () => void
  addCredits: (amount: number) => void
  mergeUser: (partial: Partial<AuthUser>) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => storage.getItem('token')
  )
  const [user, setUser] = useState<AuthResponse['user'] | null>(() => {
    const t = storage.getItem('token')
    if (!t || t === 'local-dev') return null
    return readStoredUser()
  })
  const [userFetched, setUserFetched] = useState<boolean>(() => {
    const t = storage.getItem('token')
    return !t || t === 'local-dev'
  })

  function setAuth(data: AuthResponse) {
    try {
      sessionStorage.removeItem(SKIP_TG_AUTO_LOGIN_KEY)
    } catch {
      /* ignore */
    }
    storage.setItem('token', data.token)
    storage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user))
    syncSessionToTelegramCloud()
    setToken(data.token)
    setUser(data.user)
    setUserFetched(true)
    syncGenerationLockFromServer(
      data.user.activeGenerationUntil ?? null,
      data.user.activeKieGenerationCount ?? 0
    )
  }

  function clearAuth() {
    try {
      sessionStorage.setItem(SKIP_TG_AUTO_LOGIN_KEY, '1')
    } catch {
      /* ignore */
    }
    storage.removeItem('token')
    storage.removeItem(USER_STORAGE_KEY)
    clearTelegramCloudSession()
    setToken(null)
    setUser(null)
    setUserFetched(true)
    syncGenerationLockFromServer(null, 0)
  }

  function addCredits(amount: number) {
    if (amount <= 0) return
    setUser((prev) =>
      prev ? { ...prev, creditsBalance: prev.creditsBalance + amount } : prev
    )
  }

  const mergeUser = useCallback((partial: Partial<AuthResponse['user']>) => {
    setUser((prev) => {
      const next = { ...(prev ?? {}), ...partial } as AuthResponse['user']
      if (!next.id) return prev
      storage.setItem(USER_STORAGE_KEY, JSON.stringify(next))
      syncGenerationLockFromServer(
        next.activeGenerationUntil ?? null,
        next.activeKieGenerationCount ?? 0
      )
      queueMicrotask(() => syncSessionToTelegramCloud())
      return next
    })
  }, [])

  useEffect(() => {
    tryRestoreSessionFromTelegramCloud((t, userJson) => {
      const cur = storage.getItem('token')
      if (cur && cur !== 'local-dev') return
      storage.setItem('token', t)
      storage.setItem(USER_STORAGE_KEY, userJson)
      setToken(t)
      try {
        setUser(JSON.parse(userJson) as AuthUser)
      } catch {
        setUser(null)
      }
      setUserFetched(false)
    })
  }, [])

  useEffect(() => {
    if (!token || token === 'local-dev') return
    let cancelled = false
    getMe(token)
      .then((r) => {
        if (!cancelled) {
          mergeUser(r.user)
          setUserFetched(true)
          syncSessionToTelegramCloud()
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const status = typeof (err as Error & { status?: number }).status === 'number'
            ? (err as Error & { status: number }).status
            : null
          const msg = String((err as Error)?.message ?? '')
          const lower = msg.toLowerCase()
          // Любой 401 с /me — протухший/чужой JWT, удалённый пользователь, смена JWT_SECRET и т.д.
          const sessionDead =
            status === 401 ||
            lower.includes('401') ||
            lower.includes('unauthorized') ||
            lower.includes('invalid token') ||
            (lower.includes('invalid') && lower.includes('token')) ||
            msg.includes('недействительна')
          if (sessionDead) {
            storage.removeItem('token')
            storage.removeItem(USER_STORAGE_KEY)
            clearTelegramCloudSession()
            setToken(null)
            setUser(null)
          }
          setUserFetched(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, mergeUser])

  useEffect(() => {
    syncGenerationLockFromServer(
      user?.activeGenerationUntil ?? null,
      user?.activeKieGenerationCount ?? 0
    )
  }, [user?.id, user?.activeGenerationUntil, user?.activeKieGenerationCount])

  return (
    <AuthContext.Provider value={{ token, user, userFetched, setAuth, clearAuth, addCredits, mergeUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
