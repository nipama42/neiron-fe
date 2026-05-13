import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/authStore'
import { useTheme } from '../../store/themeContext'
import CreditCoin from '../ui/CreditCoin'
import AuthorAvatarBubble from '../ui/AuthorAvatarBubble'
import TopUpModal from '../TopUpModal'

function prefetchAppRoute(path: string) {
  switch (path) {
    case '/explore':
      void import('../../pages/ExplorePage')
      break
    case '/create':
      void import('../../pages/CreatePage')
      break
    case '/bonus':
      void import('../../pages/RoulettePage')
      break
    case '/chat':
      void import('../../pages/ChatPage')
      break
    case '/profile':
      void import('../../pages/ProfilePage')
      break
    default:
      break
  }
}

function prefetchCreatePage() {
  void import('../../pages/CreatePage')
}

const TABS_LEFT = [
  { path: '/explore', label: 'Главная' },
  { path: '/bonus', label: 'Бонусы' },
]

const TABS_RIGHT = [
  { path: '/chat', label: 'AI чат' },
  { path: '/profile', label: 'Профиль' },
]

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function DesktopHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, token, clearAuth, mergeUser } = useAuth()
  const { theme, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  function handleLogout() {
    clearAuth()
    navigate('/explore', { replace: true })
    setMenuOpen(false)
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/')

  return (
    <>
    <header
      className="desktop-app-header"
      style={{
        height: 64,
        overflow: 'visible',
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-brand-light)',
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)',
        alignItems: 'center',
        paddingLeft: 24,
        paddingRight: 24,
        flexShrink: 0,
        position: 'relative',
        zIndex: 10,
      }}
    >
      {/* Logo */}
      <button
        type="button"
        onPointerEnter={() => prefetchAppRoute('/explore')}
        onFocus={() => prefetchAppRoute('/explore')}
        onClick={() => navigate('/explore')}
        aria-label="NEIRON, на главную"
        className="relative z-[1] flex shrink-0 items-center justify-start border-0 bg-transparent p-0 cursor-pointer select-none"
      >
        <img
          src="/mainlogo.png"
          alt=""
          width={280}
          height={72}
          decoding="async"
          fetchPriority="high"
          draggable={false}
          className="h-[56px] w-auto max-h-[56px] max-w-[min(24rem,48vw)] object-contain object-left brightness-0 dark:brightness-100 sm:h-[72px] sm:max-h-[72px] sm:max-w-[min(28rem,42vw)]"
        />
      </button>

      {/* Center nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        {TABS_LEFT.map((tab) => {
          const active = isActive(tab.path)
          return (
            <button
              key={tab.path}
              type="button"
              onPointerEnter={() => prefetchAppRoute(tab.path)}
              onFocus={() => prefetchAppRoute(tab.path)}
              onClick={() => navigate(tab.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                border: 'none',
                borderBottom: active ? '2px solid var(--color-brand)' : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                padding: '7px 14px',
                fontSize: 14,
                fontWeight: 500,
                color: active ? 'var(--color-brand)' : 'var(--color-muted)',
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          )
        })}

        <button
          type="button"
          onPointerEnter={() => prefetchCreatePage()}
          onFocus={() => prefetchCreatePage()}
          onClick={() => navigate('/create')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--color-brand)',
            color: 'var(--color-on-brand)',
            borderRadius: 20,
            padding: '7px 20px',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            margin: '0 4px',
          }}
        >
          <StarIcon />
          Создать
        </button>

        {TABS_RIGHT.map((tab) => {
          const active = isActive(tab.path)
          return (
            <button
              key={tab.path}
              type="button"
              onPointerEnter={() => prefetchAppRoute(tab.path)}
              onFocus={() => prefetchAppRoute(tab.path)}
              onClick={() => navigate(tab.path)}
              style={{
                border: 'none',
                borderBottom: active ? '2px solid var(--color-brand)' : '2px solid transparent',
                background: 'none',
                cursor: 'pointer',
                padding: '7px 14px',
                fontSize: 14,
                fontWeight: 500,
                color: active ? 'var(--color-brand)' : 'var(--color-muted)',
                transition: 'color 0.15s, border-color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
        {user?.isAdmin && (
          <Link
            to="/admin"
            style={{
              fontSize: 11,
              padding: '5px 10px',
              borderRadius: 12,
              background: 'var(--color-brand-light)',
              color: 'var(--color-brand-dark)',
              textDecoration: 'none',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            Админ-панель
          </Link>
        )}

        <button
          onClick={toggle}
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: 'var(--color-brand-light)',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-muted)',
            flexShrink: 0,
          }}
        >
          {theme === 'light' ? <SunIcon /> : <MoonIcon />}
        </button>

        <button
          type="button"
          onClick={token && token !== 'local-dev' ? () => setTopUpOpen(true) : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            color: 'var(--color-brand)',
            fontWeight: 500,
            fontSize: 14,
            background: 'none',
            border: 'none',
            cursor: token && token !== 'local-dev' ? 'pointer' : 'default',
            padding: '4px 8px',
            borderRadius: 8,
            transition: 'opacity 0.15s',
          }}
        >
          <CreditCoin className="w-5 h-5" />
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {user?.creditsBalance ?? 0}
          </span>
        </button>

        {/* Avatar + dropdown menu */}
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Меню профиля"
            style={{
              background: menuOpen ? 'var(--color-brand-light)' : 'none',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <AuthorAvatarBubble
              src={user?.avatarUrl ?? null}
              label={user?.tgFirstName ?? user?.displayName ?? '?'}
              className="relative flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[12px] font-semibold bg-[var(--color-brand-light)] text-[var(--color-brand-dark)]"
            />
          </button>

          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-brand-light)',
                borderRadius: 12,
                minWidth: 168,
                boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
                zIndex: 200,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => { navigate('/profile'); setMenuOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '11px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 14, color: 'var(--color-text)', textAlign: 'left',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
                Мой профиль
              </button>

              <div style={{ height: 1, background: 'var(--color-brand-light)' }} />

              <button
                onClick={handleLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '11px 16px', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 14, color: '#ef4444', textAlign: 'left',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>
    </header>

    {topUpOpen && token && token !== 'local-dev' ? (
      <TopUpModal
        token={token}
        onClose={() => setTopUpOpen(false)}
        onSuccess={(updatedUser) => mergeUser(updatedUser)}
      />
    ) : null}
  </>
  )
}
