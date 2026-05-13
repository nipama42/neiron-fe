import { type ReactElement } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Совпадает с lazy() в App.tsx — один чанк на страницу. */
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

interface Tab {
  path: string
  label: string
}

const TABS_LEFT: Tab[] = [
  { path: '/explore', label: 'Главная' },
  { path: '/bonus', label: 'Бонусы' },
]

const TABS_RIGHT: Tab[] = [
  { path: '/chat', label: 'AI чат' },
  { path: '/profile', label: 'Профиль' },
]

function ExploreIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--color-brand)' : 'var(--color-muted)'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 8.5L10 2L17 8.5V17H13V12H7V17H3V8.5Z" stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
    </svg>
  )
}

/** Бонусы / промо — купон (отличается от «Создать» со звездой) */
function BonusesIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--color-brand)' : 'var(--color-muted)'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5.25 5.5h9.5a1.75 1.75 0 011.75 1.75v1.15a1.1 1.1 0 010 2.2V12a1.75 1.75 0 01-1.75 1.75h-9.5A1.75 1.75 0 013.5 12v-1.4a1.1 1.1 0 010-2.2V7.25A1.75 1.75 0 015.25 5.5z"
        stroke={c}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 5.75v8.75"
        stroke={c}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="1.6 2.4"
      />
    </svg>
  )
}

function CommunityIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--color-brand)' : 'var(--color-muted)'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="7.5" cy="7" r="3" stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx="13.5" cy="7" r="3" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M2 17C2 14.2 4.5 12 7.5 12C8.4 12 9.2 12.2 10 12.6" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M10 17C10 14.2 11.7 12 13.5 12C16.2 12 18 14.2 18 17" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function ProfileIcon({ active }: { active: boolean }) {
  const color = active ? 'var(--color-brand)' : 'var(--color-muted)'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="7" r="3.5" stroke={color} strokeWidth="1.5" fill="none" />
      <path d="M3 18C3 14.7 6.1 12 10 12C13.9 12 17 14.7 17 18" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

const ICON_MAP: Record<string, (active: boolean) => ReactElement> = {
  '/explore': (a) => <ExploreIcon active={a} />,
  '/bonus': (a) => <BonusesIcon active={a} />,
  '/chat': (a) => <CommunityIcon active={a} />,
  '/profile': (a) => <ProfileIcon active={a} />,
}

export default function TabBar() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (path: string) => {
    if (path === '/profile') return location.pathname === '/profile'
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const renderTab = (tab: Tab) => {
    const active = isActive(tab.path)
    return (
      <button
        key={tab.path}
        type="button"
        onPointerEnter={() => prefetchAppRoute(tab.path)}
        onFocus={() => prefetchAppRoute(tab.path)}
        onClick={() => navigate(tab.path)}
        className={`flex-1 flex flex-col items-center justify-end gap-0.5 py-2 pb-2.5 min-h-[52px] min-w-0 ${active ? 'text-brand' : 'text-gray-400 dark:text-gray-500'
          }`}
      >
        {ICON_MAP[tab.path]?.(active)}
        <span className="text-[10px] font-medium">{tab.label}</span>
      </button>
    )
  }

  return (
    <div
      className="bg-surface border-t border-gray-100 dark:border-gray-800 flex items-end lg:rounded-t-2xl lg:border lg:shadow-[0_-4px_24px_rgba(0,0,0,0.06)] dark:lg:shadow-[0_-4px_24px_rgba(0,0,0,0.35)] lg:mb-2"
      style={{ paddingBottom: 'var(--app-safe-bottom)' }}
    >
      <div className="container flex flex-row items-stretch">
        {TABS_LEFT.map(renderTab)}

        <div className="flex-1 flex flex-col items-center justify-end pb-1 pt-0.5 min-h-[52px]">
          <button
            type="button"
            onPointerEnter={() => prefetchCreatePage()}
            onFocus={() => prefetchCreatePage()}
            onClick={() => navigate('/create')}
            className="bg-brand rounded-2xl flex items-center justify-center shrink-0"
            style={{ width: 44, height: 44, marginBottom: 8, marginTop: -20, position: 'relative', zIndex: 10 }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <line x1="11" y1="4" x2="11" y2="18" stroke="var(--color-on-brand)" strokeWidth="2" strokeLinecap="round" />
              <line x1="4" y1="11" x2="18" y2="11" stroke="var(--color-on-brand)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">Создать</span>
        </div>

        {TABS_RIGHT.map(renderTab)}
      </div>
    </div>
  )
}
