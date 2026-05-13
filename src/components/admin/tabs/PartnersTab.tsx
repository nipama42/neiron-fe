import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../../store/authStore'
import {
  deleteAdminSubPartner,
  getAdminPartnerApplications,
  getAdminPartnerDetail,
  getAdminPartnerList,
  getAdminPartnerPayouts,
  patchAdminPartner,
  postAdminApproveApplication,
  postAdminAssignSubPartner,
  postAdminProcessPayout,
  postAdminRejectApplication,
  type AdminApplicationRow,
  type AdminPartnerDetailResponse,
  type AdminPartnerRow,
  type AdminPayoutRow,
} from '../../../api/partner'

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return iso.slice(0, 16).replace('T', ' ') }
}

function userLabel(row: { email?: string | null; telegram_username?: string | null; telegram_first_name?: string | null; public_tag?: string | null }) {
  return row.email ?? (row.telegram_username ? `@${row.telegram_username}` : null) ?? row.telegram_first_name ?? row.public_tag ?? '—'
}

type SubTab = 'applications' | 'partners' | 'payouts'

export default function PartnersTab() {
  const { token } = useAuth()
  const [subTab, setSubTab] = useState<SubTab>('applications')

  const [applications, setApplications] = useState<AdminApplicationRow[]>([])
  const [partners, setPartners] = useState<AdminPartnerRow[]>([])
  const [payouts, setPayouts] = useState<AdminPayoutRow[]>([])

  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // Approve form state
  const [approveId, setApproveId] = useState<string | null>(null)
  const [commPct, setCommPct] = useState('20')
  const [subPct, setSubPct] = useState('5')

  // Payout process state
  const [payoutNote, setPayoutNote] = useState<Record<string, string>>({})
  /** Подсветка «скопировано» для TRC20 (ключ строки — уникальный id контекста) */
  const [trc20CopyKey, setTrc20CopyKey] = useState<string | null>(null)

  // Partner list + card
  const [partnerQuery, setPartnerQuery] = useState('')
  const [openPartnerId, setOpenPartnerId] = useState<string | null>(null)
  const [partnerDetail, setPartnerDetail] = useState<AdminPartnerDetailResponse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailForm, setDetailForm] = useState({ comm: '', sub: '', balDelta: '' })
  const [assignChildId, setAssignChildId] = useState('')
  /** Полный список для назначения суб-партнёров (поиск слева не обрезает dropdown) */
  const [partnersForAssign, setPartnersForAssign] = useState<AdminPartnerRow[]>([])

  const partnerQueryRef = useRef(partnerQuery)
  partnerQueryRef.current = partnerQuery
  const partnerSearchDebounceRef = useRef<number | null>(null)

  const fetchPartners = useCallback(
    async (q: string) => {
      if (!token) return
      try {
        const r = await getAdminPartnerList(token, { q: q.trim() || undefined })
        setPartners(r.partners)
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Ошибка списка партнёров')
      }
    },
    [token]
  )
  const schedulePartnerSearch = useCallback(
    (q: string) => {
      if (partnerSearchDebounceRef.current != null) window.clearTimeout(partnerSearchDebounceRef.current)
      partnerSearchDebounceRef.current = window.setTimeout(() => {
        partnerSearchDebounceRef.current = null
        void fetchPartners(q)
      }, 320)
    },
    [fetchPartners]
  )

  const loadAll = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setErr(null)
    try {
      const [appRes, payRes] = await Promise.allSettled([
        getAdminPartnerApplications(token),
        getAdminPartnerPayouts(token),
      ])
      if (appRes.status === 'fulfilled') setApplications(appRes.value.applications)
      if (payRes.status === 'fulfilled') setPayouts(payRes.value.payouts)
      await fetchPartners(partnerQueryRef.current)
      const loadErrs: string[] = []
      if (appRes.status === 'rejected') {
        loadErrs.push(appRes.reason instanceof Error ? appRes.reason.message : 'Заявки')
      }
      if (payRes.status === 'rejected') {
        loadErrs.push(payRes.reason instanceof Error ? payRes.reason.message : 'Выплаты')
      }
      if (loadErrs.length) setErr(loadErrs.join(' · '))
      try {
        const full = await getAdminPartnerList(token)
        setPartnersForAssign(full.partners)
      } catch {
        /* список для суб-партнёров — второстепенно */
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [token, fetchPartners])

  useEffect(() => {
    return () => {
      if (partnerSearchDebounceRef.current != null) window.clearTimeout(partnerSearchDebounceRef.current)
    }
  }, [])

  useEffect(() => { void loadAll() }, [loadAll])

  const flash = (m: string, isErr = false) => {
    if (isErr) setErr(m)
    else setMsg(m)
    setTimeout(() => { setMsg(null); setErr(null) }, 4000)
  }

  const copyTrc20 = useCallback(async (address: string, key: string) => {
    const a = String(address ?? '').trim()
    if (!a) return
    try {
      await navigator.clipboard.writeText(a)
      setTrc20CopyKey(key)
      window.setTimeout(() => {
        setTrc20CopyKey((k) => (k === key ? null : k))
      }, 2000)
    } catch {
      setErr('Не удалось скопировать в буфер')
      window.setTimeout(() => setErr(null), 4000)
    }
  }, [])

  const handleApprove = async (id: string) => {
    if (!token) return
    try {
      const res = await postAdminApproveApplication(token, id, {
        commissionPercent: Number(commPct) || 20,
        subUplinePercent: Number(subPct) || 5,
      })
      flash(`Партнёр одобрен. Код: ${res.partnerCode}`)
      setApproveId(null)
      void loadAll()
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Ошибка', true)
    }
  }

  const handleReject = async (id: string) => {
    if (!token || !window.confirm('Отклонить заявку?')) return
    try {
      await postAdminRejectApplication(token, id)
      flash('Заявка отклонена')
      void loadAll()
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Ошибка', true)
    }
  }

  const handlePayoutProcess = async (id: string, status: 'paid' | 'rejected') => {
    if (!token) return
    const note = payoutNote[id] ?? ''
    try {
      await postAdminProcessPayout(token, id, { status, adminNotes: note })
      flash(status === 'paid' ? 'Отмечено как оплачено' : 'Отклонено')
      void loadAll()
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Ошибка', true)
    }
  }

  const loadPartnerDetail = useCallback(
    async (id: string) => {
      if (!token) return
      setDetailLoading(true)
      try {
        const d = await getAdminPartnerDetail(token, id)
        setPartnerDetail(d)
        const pr = d.partner
        setDetailForm({
          comm: String(pr.commission_percent ?? ''),
          sub: String(pr.sub_upline_percent ?? ''),
          balDelta: '',
        })
        setAssignChildId('')
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Ошибка карточки', true)
        setOpenPartnerId(null)
        setPartnerDetail(null)
      } finally {
        setDetailLoading(false)
      }
    },
    [token]
  )

  useEffect(() => {
    if (!openPartnerId || !token) {
      setPartnerDetail(null)
      return
    }
    void loadPartnerDetail(openPartnerId)
  }, [openPartnerId, token, loadPartnerDetail])

  const handleDetailSavePercents = async () => {
    if (!token || !openPartnerId) return
    try {
      await patchAdminPartner(token, openPartnerId, {
        commissionPercent: Number(detailForm.comm) || undefined,
        subUplinePercent: Number(detailForm.sub) || undefined,
      })
      flash('Проценты сохранены')
      void loadAll()
      void loadPartnerDetail(openPartnerId)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Ошибка', true)
    }
  }

  const handleDetailBalanceDelta = async () => {
    if (!token || !openPartnerId) return
    const d = Number(detailForm.balDelta)
    if (!Number.isFinite(d) || d === 0) {
      flash('Введите ненулевую сумму USD (например 10 или -5)', true)
      return
    }
    try {
      await patchAdminPartner(token, openPartnerId, { availableUsdDelta: d })
      flash('Баланс скорректирован')
      setDetailForm((f) => ({ ...f, balDelta: '' }))
      void loadAll()
      void loadPartnerDetail(openPartnerId)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Ошибка', true)
    }
  }

  const handleDetailToggleStatus = async () => {
    if (!token || !partnerDetail?.partner) return
    const p = partnerDetail.partner
    const next = p.status === 'active' ? 'suspended' : 'active'
    if (!window.confirm(`${next === 'active' ? 'Активировать' : 'Приостановить'} партнёра?`)) return
    try {
      await patchAdminPartner(token, p.id, { status: next })
      flash('Статус изменён')
      void loadAll()
      void loadPartnerDetail(openPartnerId!)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Ошибка', true)
    }
  }

  const handleAssignSub = async () => {
    if (!token || !openPartnerId || !assignChildId) return
    try {
      await postAdminAssignSubPartner(token, openPartnerId, assignChildId)
      flash('Суб-партнёр назначен')
      void loadAll()
      void loadPartnerDetail(openPartnerId)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Ошибка', true)
    }
  }

  const handleRemoveSub = async (childId: string) => {
    if (!token || !openPartnerId || !window.confirm('Отвязать суб-партнёра?')) return
    try {
      await deleteAdminSubPartner(token, openPartnerId, childId)
      flash('Суб-партнёр отвязан')
      void loadAll()
      void loadPartnerDetail(openPartnerId)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Ошибка', true)
    }
  }

  const pendingApps = applications.filter((a) => a.status === 'pending').length
  const pendingPay = payouts.filter((p) => p.status === 'pending').length

  const tabs: { id: SubTab; label: string; badge?: number }[] = [
    { id: 'applications', label: 'Заявки', badge: pendingApps || undefined },
    { id: 'partners', label: 'Партнёры' },
    { id: 'payouts', label: 'Выплаты', badge: pendingPay || undefined },
  ]

  return (
    <div className="flex flex-col gap-3">
      {msg && (
        <p className="px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm">{msg}</p>
      )}
      {err && (
        <p className="px-3 py-2 rounded-xl bg-red-500/10 text-red-500 dark:text-red-400 text-sm">{err}</p>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subTab === t.id
                ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
            {t.badge ? (
              <span className="text-[10px] font-bold bg-rose-500 text-white rounded-full min-w-[1.25rem] h-5 flex items-center justify-center px-1">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void loadAll()}
          disabled={loading}
          className="ml-auto px-3 py-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
        >
          {loading ? '…' : '↻'}
        </button>
      </div>

      {/* ── Заявки ── */}
      {subTab === 'applications' && (
        <div className="space-y-3">
          {applications.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">Заявок нет</p>
          )}
          {applications.map((app) => (
            <div
              key={app.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">{userLabel(app)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Контакт: {app.contact}</p>
                  {app.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-3">{app.description}</p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">{fmt(app.applied_at)}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-semibold uppercase rounded-lg px-2 py-1 ${
                  app.status === 'pending'
                    ? 'bg-zinc-900/10 text-zinc-700 dark:text-zinc-300'
                    : app.status === 'approved'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/10 text-red-500'
                }`}>
                  {app.status === 'pending' ? 'Новая' : app.status === 'approved' ? 'Одобрена' : 'Отклонена'}
                </span>
              </div>

              {app.status === 'pending' && (
                approveId === app.id ? (
                  <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500">Комиссия (%)</label>
                        <input
                          type="number"
                          value={commPct}
                          onChange={(e) => setCommPct(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">Суб-партнёр (%)</label>
                        <input
                          type="number"
                          value={subPct}
                          onChange={(e) => setSubPct(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleApprove(app.id)}
                        className="flex-1 rounded-xl bg-emerald-600 text-white py-1.5 text-sm font-medium"
                      >
                        Одобрить
                      </button>
                      <button
                        type="button"
                        onClick={() => setApproveId(null)}
                        className="rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-1.5 text-sm"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => { setApproveId(app.id); setCommPct('20'); setSubPct('5') }}
                      className="flex-1 rounded-xl bg-[var(--color-brand)] text-[var(--color-on-brand)] py-1.5 text-sm font-medium"
                    >
                      Одобрить
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleReject(app.id)}
                      className="rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-1.5 text-sm text-red-500"
                    >
                      Отклонить
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Партнёры ── */}
      {subTab === 'partners' && (
        <div className="flex flex-col lg:flex-row gap-3 min-h-0">
            <>
          <div className={`flex flex-col gap-2 min-w-0 ${openPartnerId ? 'lg:w-[min(100%,260px)] lg:shrink-0' : 'w-full'}`}>
            <input
              type="search"
              value={partnerQuery}
              onChange={(e) => {
                const v = e.target.value
                setPartnerQuery(v)
                schedulePartnerSearch(v)
              }}
              placeholder="Поиск: email, @telegram, публичный тег, код, slug…"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm"
            />
            <p className="text-[10px] text-slate-400 px-0.5">
              {partnerQuery.trim() ? `Найдено: ${partners.length}` : `Всего в списке: ${partners.length}`}
            </p>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface overflow-hidden max-h-[min(70vh,520px)] overflow-y-auto">
              {partners.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8 px-2">
                  {partnerQuery.trim() ? 'Никого не найдено' : loading ? 'Загрузка…' : 'Нет партнёров'}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {partners.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setOpenPartnerId((cur) => (cur === p.id ? null : p.id))}
                        className={`w-full text-left px-3 py-2.5 transition-colors ${
                          openPartnerId === p.id
                            ? 'bg-[var(--color-brand)]/12 border-l-2 border-[var(--color-brand)]'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 border-l-2 border-transparent'
                        }`}
                      >
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-50 truncate">
                          {userLabel(p)}
                        </p>
                        {p.email ? (
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">{p.email}</p>
                        ) : null}
                        <p className="text-[11px] font-mono text-slate-500 mt-0.5">{p.partner_code}</p>
                        <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                          ${Number(p.available_usd).toFixed(2)} · {p.referrals_count} реф.
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {openPartnerId && (
            <div className="flex-1 min-w-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface p-4 shadow-sm">
              {detailLoading || !partnerDetail ? (
                <p className="text-sm text-slate-400 py-8 text-center">Загрузка…</p>
              ) : (
                <div className="space-y-4 max-h-[min(85vh,720px)] overflow-y-auto pr-1">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50 truncate">
                        {userLabel(partnerDetail.partner)}
                      </h3>
                      {partnerDetail.partner.email ? (
                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate mt-1">{partnerDetail.partner.email}</p>
                      ) : null}
                      {partnerDetail.partner.telegram_username ? (
                        <p className="text-xs text-slate-500 mt-0.5">@{partnerDetail.partner.telegram_username}</p>
                      ) : null}
                      <p className="text-xs font-mono text-slate-500 mt-0.5">
                        {partnerDetail.partner.partner_code} · {partnerDetail.partner.slug}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        id: <span className="font-mono">{partnerDetail.partner.id}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold uppercase rounded-lg px-2 py-1 ${
                          partnerDetail.partner.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                        }`}
                      >
                        {partnerDetail.partner.status === 'active' ? 'Активен' : 'Приостановлен'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleDetailToggleStatus()}
                        className="text-xs rounded-lg border border-slate-200 dark:border-slate-600 px-2.5 py-1 font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        Сменить статус
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenPartnerId(null)
                          setPartnerDetail(null)
                        }}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Закрыть
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {[
                      ['Доступно USD', `$${Number(partnerDetail.partner.available_usd).toFixed(2)}`],
                      ['Заработано USD', `$${Number(partnerDetail.partner.total_earned_usd).toFixed(2)}`],
                      ['Рефералов', String(partnerDetail.partner.referrals_count)],
                      [
                        'С генерацией',
                        String(partnerDetail.referralGen.referralsWithFirstGenCount),
                      ],
                      [
                        'Всего ген. реф.',
                        String(partnerDetail.referralGen.referralsGenerationsTotal),
                      ],
                      ['Выплат в ожид.', String(partnerDetail.partner.pending_payouts)],
                    ].map(([k, v]) => (
                      <div
                        key={k}
                        className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/40 px-2.5 py-2"
                      >
                        <p className="text-slate-500 dark:text-slate-400">{k}</p>
                        <p className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ставки</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500">Комиссия %</label>
                        <input
                          value={detailForm.comm}
                          onChange={(e) => setDetailForm((f) => ({ ...f, comm: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500">Суб-линия %</label>
                        <input
                          value={detailForm.sub}
                          onChange={(e) => setDetailForm((f) => ({ ...f, sub: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDetailSavePercents()}
                      className="w-full rounded-xl bg-[var(--color-brand)] text-[var(--color-on-brand)] py-2 text-sm font-semibold"
                    >
                      Сохранить проценты
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Корректировка баланса (USD)
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Положительное — начислить, отрицательное — списать с доступного баланса.
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={detailForm.balDelta}
                        onChange={(e) => setDetailForm((f) => ({ ...f, balDelta: e.target.value }))}
                        placeholder="напр. 10 или -3"
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-2 py-1.5 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => void handleDetailBalanceDelta()}
                        className="rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-sm font-medium"
                      >
                        Применить
                      </button>
                    </div>
                  </div>

                  {partnerDetail.partner.payout_trc20_address ? (
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Адрес вывода (TRC20)</p>
                    <div className="flex items-start gap-2">
                      <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 break-all min-w-0 flex-1">
                        {partnerDetail.partner.payout_trc20_address}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void copyTrc20(partnerDetail.partner.payout_trc20_address!, `detail:${openPartnerId}`)
                        }
                        className="shrink-0 rounded-lg bg-[var(--color-brand)] text-[var(--color-on-brand)] px-2.5 py-1.5 text-[11px] font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
                      >
                        {trc20CopyKey === `detail:${openPartnerId}` ? '✓' : 'Копировать'}
                      </button>
                    </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">Кошелёк TRC20 не указан</p>
                  )}

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Суб-партнёры
                    </p>
                    {partnerDetail.subPartners.length === 0 ? (
                      <p className="text-xs text-slate-400">Пока нет привязанных суб-партнёров</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {partnerDetail.subPartners.map((s) => (
                          <li
                            key={s.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 dark:border-slate-800 px-2 py-1.5"
                          >
                            <span className="text-xs truncate min-w-0">
                              <span className="font-mono">{s.partner_code}</span> · {userLabel(s)}
                            </span>
                            <button
                              type="button"
                              onClick={() => void handleRemoveSub(s.id)}
                              className="shrink-0 text-[11px] text-red-500 font-medium"
                            >
                              Отвязать
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <select
                        value={assignChildId}
                        onChange={(e) => setAssignChildId(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-2 py-1.5 text-sm min-w-0"
                      >
                        <option value="">Выберите партнёра для привязки…</option>
                        {partnersForAssign
                          .filter((x) => x.id !== openPartnerId)
                          .slice()
                          .sort((a, b) =>
                            String(a.partner_code).localeCompare(String(b.partner_code), 'en')
                          )
                          .map((x) => (
                            <option
                              key={x.id}
                              value={x.id}
                              disabled={!x.user_id}
                              title={!x.user_id ? 'У записи нет пользователя — нельзя привязать как суб' : undefined}
                            >
                              {x.partner_code} — {userLabel(x)}
                              {!x.user_id ? ' (нет пользователя)' : ''}
                              {x.status !== 'active' ? ' · не активен' : ''}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={!assignChildId}
                        onClick={() => void handleAssignSub()}
                        className="rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                      >
                        Назначить
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
            </>
        </div>
      )}

      {/* ── Выплаты ── */}
      {subTab === 'payouts' && (
        <div className="space-y-3">
          {payouts.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">Заявок на вывод нет</p>
          )}
          {payouts.map((pay) => (
            <div
              key={pay.id}
              className={`rounded-2xl border bg-surface p-4 space-y-2 ${
                pay.status === 'pending'
                  ? 'border-zinc-400/40 dark:border-zinc-500/30'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate">
                    {userLabel(pay)} · {pay.partner_code}
                  </p>
                  <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-50 mt-0.5">
                    ${Number(pay.amount_usd).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-400">Сумма к зачислению на кошелёк (после комиссии вывода)</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{fmt(pay.requested_at)}</p>
                  {pay.payout_trc20_address ? (
                    <div className="mt-1 space-y-0.5">
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Адрес вывода (TRC20)</p>
                      <div className="flex items-start gap-2">
                        <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 break-all min-w-0 flex-1">
                          {pay.payout_trc20_address}
                        </p>
                      <button
                        type="button"
                        onClick={() => void copyTrc20(pay.payout_trc20_address!, `payout:${pay.id}`)}
                        className="shrink-0 rounded-lg bg-[var(--color-brand)] text-[var(--color-on-brand)] px-2.5 py-1.5 text-[11px] font-semibold hover:opacity-90 active:scale-[0.98] transition-all"
                      >
                        {trc20CopyKey === `payout:${pay.id}` ? '✓' : 'Копировать'}
                      </button>
                    </div>
                    </div>
                  ) : null}
                  {pay.admin_notes && (
                    <p className="text-xs text-slate-500 mt-1 italic">{pay.admin_notes}</p>
                  )}
                </div>
                <span className={`shrink-0 text-[10px] font-semibold uppercase rounded-lg px-2 py-1 ${
                  pay.status === 'pending'
                    ? 'bg-zinc-900/10 text-zinc-700 dark:text-zinc-300'
                    : pay.status === 'paid'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-500/10 text-red-500'
                }`}>
                  {pay.status === 'pending' ? 'Ожидает' : pay.status === 'paid' ? 'Выплачено' : 'Отклонено'}
                </span>
              </div>

              {pay.status === 'pending' && (
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                  <input
                    value={payoutNote[pay.id] ?? ''}
                    onChange={(e) => setPayoutNote((prev) => ({ ...prev, [pay.id]: e.target.value }))}
                    placeholder="Заметка (необязательно)"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-2.5 py-1.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handlePayoutProcess(pay.id, 'paid')}
                      className="flex-1 rounded-xl bg-emerald-600 text-white py-1.5 text-sm font-medium"
                    >
                      Выплачено ✓
                    </button>
                    <button
                      type="button"
                      onClick={() => void handlePayoutProcess(pay.id, 'rejected')}
                      className="rounded-xl border border-red-200 dark:border-red-800 text-red-500 px-4 py-1.5 text-sm font-medium"
                    >
                      Отклонить
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
