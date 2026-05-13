import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import TabBar from './TabBar'
import BalancePill from '../ui/BalancePill'
import TopUpModal from '../TopUpModal'
import { getAdminSummary } from '../../api/admin'
import { getMe } from '../../api/me'
import { useAuth } from '../../store/authStore'
import { useTheme } from '../../store/themeContext'
import { useGenerationBannerState } from '../../lib/generationInFlight'

const PAGE_TITLES: Record<string, string> = {
  '/explore': 'Главная',
  '/bonus': 'Бонусы',
  '/create': 'Создать',
  '/chat': 'AI чат',
  '/profile': 'Профиль',
  '/profile/author': 'Профиль',
}

export default function Layout() {
  const location = useLocation()
  const { token, user, mergeUser } = useAuth()
  const { theme, toggle } = useTheme()
  const [adminUnread, setAdminUnread] = useState(0)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const generationBusy = useGenerationBannerState()
  const hasActiveKieSlots = (user?.activeKieGenerationCount ?? 0) > 0

  /** Один скролл в #main-scroll; без прокрутки document — шапка/таббар не «уплывают» при жестах Safari. */
  useEffect(() => {
    document.documentElement.classList.add('neiro-mobile-shell')
    return () => document.documentElement.classList.remove('neiro-mobile-shell')
  }, [])

  useEffect(() => {
    if (!token || token === 'local-dev') return
    if (!generationBusy.inFlight && !hasActiveKieSlots) return
    const id = window.setInterval(() => {
      getMe(token)
        .then((r) => mergeUser(r.user))
        .catch(() => {})
    }, 8000)
    return () => window.clearInterval(id)
  }, [token, generationBusy.inFlight, hasActiveKieSlots, mergeUser])

  useEffect(() => {
    if (!token || token === 'local-dev' || !user?.isAdmin) {
      setAdminUnread(0)
      return
    }
    const tick = () => {
      getAdminSummary(token)
        .then((s) => setAdminUnread(s.supportUnread))
        .catch(() => { })
    }
    tick()
    const id = window.setInterval(tick, 20_000)
    return () => window.clearInterval(id)
  }, [token, user?.isAdmin])

  const title = (() => {
    if (location.pathname.startsWith('/profile/author/')) return PAGE_TITLES['/profile/author']
    return PAGE_TITLES[location.pathname] ?? ''
  })()

  return (
    <div className="flex flex-col min-h-0 h-dvh max-h-dvh overflow-hidden bg-base">
      <header className="neiro-mobile-app-header bg-base shrink-0 z-30 relative">
        <div className="container grid grid-cols-3 items-center gap-2 pb-2 min-h-[6rem] sm:min-h-[6rem] lg:min-h-0 lg:py-3 lg:px-6 xl:px-10 shrink-0 layout-mobile-header-inner">
          <div className="flex justify-start items-center min-w-0">
            <img
              src="/mainlogo.png"
              alt="NEIRO"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="h-[4rem] sm:h-[5rem] lg:h-24 xl:h-28 w-auto max-w-[min(72vw,22rem)] lg:max-w-[18rem] xl:max-w-[20rem] object-contain object-left brightness-0 dark:brightness-100"
            />
          </div>
          <h1 className="text-center text-lg sm:text-xl lg:text-2xl font-bold leading-tight px-1 truncate justify-self-center max-w-full">
            {title}
          </h1>
          <div className="flex items-center justify-end gap-2 min-w-0">
            {user?.isAdmin === true ? (
              <Link
                to="/admin"
                className="relative shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold bg-[var(--color-brand)] text-[var(--color-on-brand)] hover:bg-[var(--color-brand-dark)] shadow-sm"
              >
                Админ-Панель
                {adminUnread > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[1.125rem] h-5 px-1 flex items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white border border-white dark:bg-zinc-100 dark:text-zinc-900 dark:border-slate-900">
                    {adminUnread > 99 ? '99+' : adminUnread}
                  </span>
                ) : null}
              </Link>
            ) : null}
            <button
              onClick={toggle}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-surface text-gray-500 dark:text-gray-400"
            >
              {theme === 'light' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <BalancePill
                balance={user?.creditsBalance ?? 0}
                onClick={token && token !== 'local-dev' ? () => setTopUpOpen(true) : undefined}
              />
          </div>
        </div>
      </header>
      <div
        id="main-scroll"
        className="neiro-mobile-main-scroll flex flex-1 flex-col min-h-0 overflow-y-auto overscroll-y-contain w-full"
      >
        <div className="flex flex-1 flex-col min-h-0 min-w-0 w-full max-w-[min(100%,1440px)] mx-auto sm:px-4 lg:px-8 xl:px-10">
          <Outlet />
        </div>
      </div>
      <div className="neiro-mobile-tab-wrap shrink-0 z-30 w-full flex justify-center bg-base">
        <div className="w-full max-w-[min(100%,1440px)] lg:px-4 xl:px-6">
          <TabBar />
        </div>
      </div>

      {topUpOpen && token && token !== 'local-dev' ? (
        <TopUpModal
          token={token}
          onClose={() => setTopUpOpen(false)}
          onSuccess={(updatedUser) => mergeUser(updatedUser)}
        />
      ) : null}
    </div>
  )
}
