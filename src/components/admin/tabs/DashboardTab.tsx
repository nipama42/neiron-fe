import { useEffect, useState } from 'react'
import { getAdminEvents, getAdminSummary, type AdminStats, type SiteEventRow } from '../../../api/admin'
import { useAuth } from '../../../store/authStore'

interface Props {
  onGoToOperations: () => void
}

const card: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 12,
  marginBottom: 8,
}

const label: React.CSSProperties = {
  fontSize: 9,
  color: '#9ca3af',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 4,
}

const value: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 500,
  color: '#111',
}

const hint: React.CSSProperties = {
  fontSize: 9,
  color: '#9ca3af',
  marginTop: 3,
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  padding: '0 12px',
  marginBottom: 6,
  marginTop: 16,
}

const KIND_LABEL: Record<string, string> = {
  registration: 'Регистрация',
  topup: 'Пополнение',
  promo_redeem: 'Промокод',
  roulette: 'Рулетка',
  admin_grant: 'Начисление админом',
  generation_ok: 'Генерация ✓',
  generation_fail: 'Генерация ✕',
  login_ok: 'Вход ✓',
  login_fail: 'Вход ✕',
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function DashboardTab({ onGoToOperations }: Props) {
  const { token } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [events, setEvents] = useState<SiteEventRow[]>([])

  useEffect(() => {
    if (!token) return
    const load = async () => {
      const settled = await Promise.allSettled([
        getAdminSummary(token),
        getAdminEvents(token, 5, 0),
      ])
      const [sumR, evR] = settled
      if (sumR.status === 'fulfilled') setStats(sumR.value.stats)
      if (evR.status === 'fulfilled') setEvents(evR.value.events)
    }
    void load()
  }, [token])

  return (
    <div className="p-3">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '0 12px 8px' }}>
        <div style={card}>
          <div style={label}>Генерации сегодня</div>
          <div style={value}>{stats ? `${stats.generationsOk + stats.generationsFail}` : '—'}</div>
          <div style={hint}>по журналу</div>
        </div>
        <div style={card}>
          <div style={label}>Расход API</div>
          <div style={value}>{stats != null ? `$${stats.apiSpendUsd}` : '—'}</div>
          <div style={hint}>
            {stats
              ? `Kie: $${stats.kieApiSpendUsd ?? 0} · APIMart: $${stats.apimartSpendUsd ?? 0} · Neuro: $${stats.neuroSpendUsd ?? 0}`
              : '—'}
          </div>
        </div>
      </div>

      <div style={{ margin: '0 12px 8px' }}>
        <div style={card}>
          <div style={label}>Конверсия генераций (UTC-сутки)</div>
          <div style={value}>{stats?.conversionPct != null ? `${stats.conversionPct}%` : '—'}</div>
          <div style={hint}>
            Успешно: {stats?.generationsOk ?? 0} · Отклонено: {stats?.generationsFail ?? 0}
          </div>
        </div>
      </div>

      <div style={{ ...sectionTitle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
        <span>Последние операции</span>
        <button
          type="button"
          onClick={onGoToOperations}
          style={{ fontSize: 11, color: '#534AB7', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, textTransform: 'none', letterSpacing: 0, padding: 0 }}
        >
          Все →
        </button>
      </div>

      <div style={{ margin: '0 12px 8px' }}>
        {events.map((op) => (
          <div
            key={op.id}
            style={{ background: '#fff', borderRadius: 10, padding: '10px 12px', marginBottom: 6, borderLeft: '3px solid #16a34a' }}
          >
            <div style={{ fontSize: 11, fontWeight: 500, color: '#111' }}>
              {(KIND_LABEL[op.kind] ?? op.kind)} · {op.label}
            </div>
            <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 3 }}>{formatTime(op.createdAt)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
