import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import DesktopLayout from './components/layout/DesktopLayout'
import { usePrefersDesktopLayout } from './hooks/useMediaQuery'
import { useAuth } from './store/authStore'
import { ExploreFilterProvider } from './store/exploreFilterContext'
import { ChatStoreProvider } from './store/chatStore'
import GenerationTaskStartedToast from './components/ui/GenerationTaskStartedToast'
import { parseProfileStartParam } from './lib/profileShareLinks'
import { parseTelegramGoPathParam } from './lib/telegramMiniAppRedirect'
import { ensureTelegramScript } from './lib/ensureTelegramScript'
const ExplorePage = lazy(() => import('./pages/ExplorePage'))
const CreatePage = lazy(() => import('./pages/CreatePage'))
const HistoryPage = lazy(() => import('./pages/RoulettePage'))
const CommunityPage = lazy(() => import('./pages/ChatPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

const AdminPanelPage = lazy(() => import('./pages/AdminPanelPage'))
const PublicAuthorPage = lazy(() => import('./pages/PublicAuthorPage'))
const PartnerPage = lazy(() => import('./pages/PartnerPage'))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const AboutServicePage = lazy(() => import('./pages/AboutServicePage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))

function TelegramMiniAppStartRouting() {
  const navigate = useNavigate()
  const { token } = useAuth()

  useEffect(() => {
    let cancelled = false
    void ensureTelegramScript().then(() => {
      if (cancelled) return
      const spRaw = window.Telegram?.WebApp?.initDataUnsafe?.start_param
      const sp = typeof spRaw === 'string' ? spRaw : ''

      const goPath = parseTelegramGoPathParam(sp)
      if (goPath) {
        navigate(goPath, { replace: true })
        return
      }

      if (!token || token === 'local-dev') return
      const ref = parseProfileStartParam(sp)
      if (!ref) return
      navigate(`/profile/author/${encodeURIComponent(ref)}`, { replace: true })
    })
    return () => {
      cancelled = true
    }
  }, [token, navigate])

  return null
}

function AppSpinner() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-body)',
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '2.5px solid var(--color-brand-light)',
        borderTopColor: 'var(--color-brand)',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function AppRoutes() {
  const isDesktop = usePrefersDesktopLayout()

  useEffect(() => {
    const run = () => {
      void import('./pages/CreatePage')
    }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 5000 })
      return () => window.cancelIdleCallback(id)
    }
    const t = window.setTimeout(run, 3200)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <Suspense fallback={<AppSpinner />}>
      <ExploreFilterProvider>
        <ChatStoreProvider>
          <TelegramMiniAppStartRouting />
          <GenerationTaskStartedToast />
          <Routes>
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/about" element={<AboutServicePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/admin" element={<AdminPanelPage />} />
            <Route path="/" element={isDesktop ? <DesktopLayout /> : <Layout />}>
              <Route index element={<Navigate to="/explore" replace />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path="create" element={<CreatePage />} />
              <Route path="bonus" element={<HistoryPage />} />
              <Route path="chat" element={<CommunityPage />} />
              <Route path="history" element={<Navigate to="/bonus" replace />} />
              <Route path="community" element={<Navigate to="/chat" replace />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="profile/author/:authorRef" element={<PublicAuthorPage />} />
              <Route path="partner" element={<PartnerPage />} />
            </Route>
          </Routes>
        </ChatStoreProvider>
      </ExploreFilterProvider>
    </Suspense>
  )
}

export default function App() {
  const { userFetched } = useAuth()

  if (!userFetched) return <AppSpinner />

  return <AppRoutes />
}