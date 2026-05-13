import { Outlet, useLocation } from 'react-router-dom'
import DesktopHeader from './DesktopHeader'
import { useExploreFilter, type ExploreFilterType } from '../../store/exploreFilterContext'

const EXPLORE_FILTER_OPTIONS: { value: ExploreFilterType; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'photo', label: 'Фото' },
  { value: 'video', label: 'Видео' },
  { value: 'new', label: 'Новые' },
]

function ExploreFilterSidebar() {
  const { feedFilter, setFeedFilter } = useExploreFilter()

  return (
    <div style={{ padding: '20px 12px' }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 8,
          paddingLeft: 8,
        }}
      >
        Тип контента
      </p>
      {EXPLORE_FILTER_OPTIONS.map((opt) => {
        const active = feedFilter === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => setFeedFilter(opt.value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              width: '100%',
              padding: '7px 8px',
              borderRadius: 8,
              border: 'none',
              background: active ? 'var(--color-brand-light)' : 'none',
              color: active ? 'var(--color-brand)' : 'var(--color-muted)',
              fontWeight: active ? 500 : 400,
              fontSize: 14,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: active ? 'var(--color-brand)' : 'var(--color-muted)',
                opacity: active ? 1 : 0.35,
                flexShrink: 0,
              }}
            />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

const PROFILE_NAV = [
  { id: 'profile-public', label: 'Публичный профиль' },
  { id: 'profile-history', label: 'История операций' },
  { id: 'profile-subscription', label: 'Подписка и планы' },
  { id: 'profile-partner', label: 'Партнёрская программа' },
]

function ProfileNavSidebar() {
  return (
    <div style={{ padding: '20px 12px' }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 8,
          paddingLeft: 8,
        }}
      >
        Профиль
      </p>
      {PROFILE_NAV.map((item, i) => (
        <button
          key={item.id}
          onClick={() => {
            const el = document.getElementById(item.id)
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            width: '100%',
            padding: '7px 8px',
            borderRadius: 8,
            border: 'none',
            background: 'none',
            color: i === 0 ? 'var(--color-brand)' : 'var(--color-muted)',
            fontWeight: i === 0 ? 500 : 400,
            fontSize: 14,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: i === 0 ? 'var(--color-brand)' : 'var(--color-muted)',
              opacity: i === 0 ? 1 : 0.35,
              flexShrink: 0,
            }}
          />
          {item.label}
        </button>
      ))}
    </div>
  )
}

export default function DesktopLayout() {
  const location = useLocation()

  const isChatPage = location.pathname.startsWith('/chat')
  const isExplorePage = location.pathname.startsWith('/explore')
  const isProfilePage =
    location.pathname === '/profile' || location.pathname === '/profile/'
  const hasSidebar = false
  // Только чат: flex + overflow:hidden у main, внутренний скролл у ChatPage.
  // Профиль скроллится в main (overflow:auto); полноэкранная поддержка — h-full в ProfilePage.
  const isFlexPage = isChatPage

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--color-body)',
      }}
    >
      <DesktopHeader />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {hasSidebar && (
          <aside
            style={{
              width: 220,
              flexShrink: 0,
              background: 'var(--color-surface)',
              borderRight: '1px solid var(--color-brand-light)',
              overflowY: 'auto',
            }}
          >
            {isExplorePage && <ExploreFilterSidebar />}
            {isProfilePage && <ProfileNavSidebar />}
          </aside>
        )}
        <main
          id="main-scroll"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
          overflowY: isFlexPage ? 'hidden' : 'auto',
          display: isFlexPage ? 'flex' : undefined,
          flexDirection: isFlexPage ? 'column' : undefined,
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
