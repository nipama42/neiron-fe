import { useCallback, useEffect, useState } from 'react'
import { getAdminEvents, type SiteEventRow } from '../../../api/admin'
import { useAuth } from '../../../store/authStore'

const EVENTS_PAGE_SIZE = 50

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
  moderation_blocked: 'Модерация ✕',
  moderation_error: 'Модерация ⚠',
}

function eventRowClass(kind: string): string {
  if (kind === 'login_ok' || kind === 'generation_ok') return 'border-l-4 border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/25'
  if (kind === 'login_fail' || kind === 'generation_fail') return 'border-l-4 border-l-red-500 bg-red-50/35 dark:bg-red-950/25'
  if (kind === 'moderation_blocked') return 'border-l-4 border-l-zinc-700 bg-zinc-100/60 dark:bg-zinc-900/40'
  if (kind === 'moderation_error') return 'border-l-4 border-l-yellow-400 bg-yellow-50/30 dark:bg-yellow-950/20'
  return ''
}

function eventUserLabel(e: SiteEventRow): string {
  return (
    e.displayName ||
    e.email ||
    e.login ||
    (e.telegramUsername ? `@${e.telegramUsername}` : null) ||
    e.publicTag ||
    (e.userId ? e.userId.slice(0, 8) + '…' : '—')
  )
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function OperationsTab() {
  const { token } = useAuth()
  const [events, setEvents] = useState<SiteEventRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const loadEvents = useCallback(
    async (append: boolean, offsetOverride = 0) => {
      if (!token) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const page = await getAdminEvents(token, EVENTS_PAGE_SIZE, offsetOverride)
        const next = Array.isArray(page.events) ? page.events : []
        setEvents((prev) => {
          if (!append) return next
          const seen = new Set(prev.map((x) => x.id))
          const unique = next.filter((x) => !seen.has(x.id))
          return unique.length ? [...prev, ...unique] : prev
        })
        setHasMore(next.length >= EVENTS_PAGE_SIZE)
      } finally {
        if (append) setLoadingMore(false)
        else setLoading(false)
      }
    },
    [token]
  )

  useEffect(() => {
    setEvents([])
    setHasMore(true)
    void loadEvents(false, 0)
  }, [loadEvents])

  return (
    <div className="p-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface">
        <div className="divide-y divide-slate-100 dark:divide-slate-700/80">
          {loading && events.length === 0 ? (
            <p className="p-3 text-xs text-slate-500">Загрузка...</p>
          ) : events.length === 0 ? (
            <p className="p-3 text-xs text-slate-500">Нет событий</p>
          ) : (
            events.map((e) => (
              <div
                key={e.id}
                className={`px-3 py-2 text-sm hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${eventRowClass(e.kind)}`}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-medium">{KIND_LABEL[e.kind] ?? e.kind}</span>
                  <span className="text-slate-600 dark:text-slate-300">{e.label}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                  <span>{eventUserLabel(e)}</span>
                  <span>{formatTime(e.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
        {events.length > 0 && hasMore ? (
          <div className="border-t border-slate-200 dark:border-slate-700 p-2">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadEvents(true, events.length)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60"
            >
              {loadingMore ? 'Загрузка...' : 'Показать еще'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
