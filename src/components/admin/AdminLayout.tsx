import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminSummary } from '../../api/admin'
import { useAuth } from '../../store/authStore'
import DashboardTab from './tabs/DashboardTab'
import ChatsTab from './tabs/ChatsTab'
import PromoTab from './tabs/PromoTab'
import OperationsTab from './tabs/OperationsTab'
import PricesTab from './tabs/PricesTab'
import BannersTab from './tabs/BannersTab'
import PartnersTab from './tabs/PartnersTab'
import UsersTab from './tabs/UsersTab'
import SiteSettingsTab from './tabs/SiteSettingsTab'

type Tab = 'dashboard' | 'chats' | 'promo' | 'operations' | 'prices' | 'banners' | 'site' | 'partners' | 'users'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'chats', label: 'Чаты' },
  { id: 'promo', label: 'Промокоды' },
  { id: 'operations', label: 'Операции' },
  { id: 'prices', label: 'Цены' },
  { id: 'banners', label: 'Баннеры' },
  { id: 'site', label: 'Сайт' },
  { id: 'partners', label: 'Партнёры' },
  { id: 'users', label: 'Пользователи' },
]

export default function AdminLayout() {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [supportUnread, setSupportUnread] = useState(0)

  useEffect(() => {
    if (!token || token === 'local-dev') {
      setSupportUnread(0)
      return
    }
    const load = async () => {
      try {
        const s = await getAdminSummary(token)
        setSupportUnread(s.supportUnread)
      } catch {
        /* ignore */
      }
    }
    void load()
    const id = window.setInterval(load, 8000)
    return () => window.clearInterval(id)
  }, [token])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: '#f5f4f0' }}>
      <header style={{ background: '#fff', padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#111' }}>Админ-панель</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Чаты · Операции · Промокоды</div>
        </div>
        <Link to="/explore" style={{ fontSize: 13, fontWeight: 500, color: '#16a34a', textDecoration: 'none' }}>
          В приложение
        </Link>
      </header>

      <div style={{ background: '#fff', padding: '8px 12px', borderBottom: '1px solid #f3f4f6', overflowX: 'auto', scrollbarWidth: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {TABS.map((tab, i) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              borderRadius: 20,
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginRight: i < TABS.length - 1 ? 6 : 0,
              background: activeTab === tab.id ? '#111' : '#f3f4f6',
              color: activeTab === tab.id ? '#fff' : '#6b7280',
            }}
          >
            {tab.label}
            {tab.id === 'chats' && supportUnread > 0 ? (
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 999,
                  background: '#f43f5e',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: '18px',
                  textAlign: 'center',
                }}
              >
                {supportUnread > 99 ? '99+' : supportUnread}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {activeTab === 'chats' ? (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ChatsTab />
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '12px 12px' }}>
            {activeTab === 'dashboard' && <DashboardTab onGoToOperations={() => setActiveTab('operations')} />}
            {activeTab === 'promo' && <PromoTab />}
            {activeTab === 'operations' && <OperationsTab />}
            {activeTab === 'prices' && <PricesTab />}
            {activeTab === 'banners' && <BannersTab />}
            {activeTab === 'site' && <SiteSettingsTab />}
            {activeTab === 'partners' && <PartnersTab />}
            {activeTab === 'users' && <UsersTab />}
          </div>
        )}
      </div>
    </div>
  )
}
