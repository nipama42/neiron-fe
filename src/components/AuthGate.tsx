import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useTelegram } from '../hooks/useTelegram'
import { SKIP_TG_AUTO_LOGIN_KEY, useAuth } from '../store/authStore'
import { authViaTelegram } from '../api/auth'
import { ensureTelegramScript } from '../lib/ensureTelegramScript'

const LandingPage = lazy(() => import('../pages/LandingPage'))
const LoginPage = lazy(() => import('../pages/LoginPage'))
const TermsOfServicePage = lazy(() => import('../pages/TermsOfServicePage'))
const AboutServicePage = lazy(() => import('../pages/AboutServicePage'))
const PrivacyPolicyPage = lazy(() => import('../pages/PrivacyPolicyPage'))
const App = lazy(() => import('../App'))

/** Партнёрский код с сайта (?r=), без подмешивания Telegram start_param (рефералка бота обрабатывается отдельно). */
function readPartnerCode(): string | undefined {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('r')?.trim().toUpperCase()
    if (fromUrl) {
      sessionStorage.setItem('_ps', fromUrl)
      return fromUrl
    }
    return sessionStorage.getItem('_ps')?.trim().toUpperCase() || undefined
  } catch {
    return undefined
  }
}

function readTelegramStartCode(): string | undefined {
  try {
    const sp = window.Telegram?.WebApp?.initDataUnsafe?.start_param
    if (typeof sp === 'string' && /^[a-z0-9]{8}$/i.test(sp.trim())) {
      return sp.trim().toUpperCase()
    }
    return undefined
  } catch {
    return undefined
  }
}

function isTgLogoutSkipActive(): boolean {
  try {
    return sessionStorage.getItem(SKIP_TG_AUTO_LOGIN_KEY) === '1'
  } catch {
    return false
  }
}

/** Публичные разделы приложения без авторизации (индексация, шаринг профилей). */
function isPublicAppPath(pathname: string): boolean {
  if (pathname === '/explore') return true
  return pathname.startsWith('/profile/author/')
}

function GateSpinner({ label }: { label?: string }) {
  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center gap-3"
      style={{ background: '#0a0a0a', color: 'rgba(245,244,240,0.85)' }}
    >
      <div
        className="h-8 w-8 rounded-full border-2 border-white/25 border-t-white/90 animate-spin"
        aria-hidden
      />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  )
}

export default function AuthGate() {
  const location = useLocation()
  const { initData } = useTelegram()
  const { token, setAuth } = useAuth()
  const [tgAutoLoginFailed, setTgAutoLoginFailed] = useState(false)
  const partnerCode = readPartnerCode()
  const telegramStartCode = readTelegramStartCode()
  const tgLogoutSkip = isTgLogoutSkipActive()

  useEffect(() => {
    void ensureTelegramScript().then(() => {
      const w = window.Telegram?.WebApp
      if (w) {
        w.ready()
        w.expand()
      }
    })
  }, [])

  useEffect(() => {
    if (token || !initData?.trim() || isTgLogoutSkipActive()) return
    let active = true

    ;(async () => {
      try {
        const out = await authViaTelegram(initData, { partnerCode, telegramStartCode })
        if (active) setAuth(out)
      } catch {
        if (active) setTgAutoLoginFailed(true)
      }
    })()

    return () => {
      active = false
    }
  }, [token, initData, partnerCode, telegramStartCode, setAuth])

  if (!token && location.pathname === '/terms') {
    return (
      <Suspense fallback={<GateSpinner />}>
        <TermsOfServicePage />
      </Suspense>
    )
  }
  if (!token && location.pathname === '/about') {
    return (
      <Suspense fallback={<GateSpinner />}>
        <AboutServicePage />
      </Suspense>
    )
  }
  if (!token && location.pathname === '/privacy') {
    return (
      <Suspense fallback={<GateSpinner />}>
        <PrivacyPolicyPage />
      </Suspense>
    )
  }

  // В Telegram Mini App пока идёт авто-логин — показываем спиннер, чтобы не моргать лендингом
  // После явного «Выйти» флаг в sessionStorage — не крутим бесконечно повторный initData-логин
  if (!token && initData?.trim() && !tgAutoLoginFailed && !tgLogoutSkip) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
        }}
      >
        <div className="text-white/80 text-sm">Авторизация через Telegram...</div>
      </div>
    )
  }

  if (!token && location.pathname === '/') {
    return (
      <Suspense fallback={<GateSpinner />}>
        <LandingPage />
      </Suspense>
    )
  }

  if (!token && isPublicAppPath(location.pathname)) {
    return (
      <Suspense fallback={<GateSpinner label="Загрузка…" />}>
        <App />
      </Suspense>
    )
  }

  if (!token && location.pathname !== '/login') {
    return <Navigate to="/login" replace />
  }

  if (!token) {
    return (
      <Suspense fallback={<GateSpinner />}>
        <LoginPage />
      </Suspense>
    )
  }

  return (
    <Suspense fallback={<GateSpinner label="Загрузка приложения…" />}>
      <App />
    </Suspense>
  )
}
