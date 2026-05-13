import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../store/authStore'
import {
  getPartnerDashboard,
  postPartnerApply,
  postPartnerCurrency,
  postPartnerPayout,
  postPartnerPayoutWallet,
  type PartnerDailyRow,
  type PartnerDashboardResponse,
  type PartnerPayoutRow,
} from '../api/partner'
import { isValidTrc20Address } from '../lib/trc20Address'

/** Запасной курс, если API ещё без поля (совпадает с дефолтом на сервере) */
const FALLBACK_USD_RUB = 80

/** Общий стиль карточек как в профиле / ленте */
const PCARD =
  'rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-surface shadow-sm'
const PCARD_ACCENT = 'h-1.5 bg-gradient-to-r from-[var(--color-brand)] via-[var(--color-brand-dark)] to-[var(--color-muted)] opacity-[0.85] dark:opacity-100'

function toDisp(usd: number, cur: 'rub' | 'usd', usdRub: number): string {
  if (cur === 'rub') return `${(usd * usdRub).toFixed(0)} ₽`
  return `$${usd.toFixed(2)}`
}

function formatRubAmount(rub: number, cur: 'rub' | 'usd', usdRub: number): string {
  if (cur === 'rub') return `${rub.toFixed(0)} ₽`
  return `$${(rub / usdRub).toFixed(2)}`
}

function formatDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${parseInt(m[3])}.${m[2]}`
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 16).replace('T', ' ')
  }
}

function statusLabel(s: string): string {
  if (s === 'paid') return 'Выплачено'
  if (s === 'rejected') return 'Отклонено'
  if (s === 'pending') return 'Ожидает'
  return s
}

function statusColor(s: string): string {
  if (s === 'paid') return 'text-emerald-600 dark:text-emerald-400'
  if (s === 'rejected') return 'text-red-500 dark:text-red-400'
  return 'text-zinc-600 dark:text-zinc-400'
}

// ─── Компонент заявки ───────────────────────────────────────────────────────

function ApplyForm({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const [contact, setContact] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!contact.trim()) { setErr('Укажите контакт для связи'); return }
    setBusy(true)
    setErr(null)
    try {
      await postPartnerApply(token, { contact: contact.trim(), description: description.trim() })
      setSent(true)
      onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка отправки')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.08] dark:bg-emerald-500/10 p-5 text-center space-y-1 shadow-sm">
        <p className="text-emerald-600 dark:text-emerald-400 font-semibold">Заявка отправлена!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Мы рассмотрим её и свяжемся с вами.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className={`${PCARD} overflow-hidden`}>
        <div className={PCARD_ACCENT} aria-hidden />
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-1">
              Стать партнёром
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Получайте процент с покупок привлечённых вами пользователей.
              Оставьте контакты — после одобрения откроется партнёрский кабинет.
            </p>
          </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Ваш Telegram или email *
            </label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="@username или example@mail.com"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Расскажите о вашей аудитории
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Канал, группа, сайт — откуда придут пользователи?"
              rows={3}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none"
            />
          </div>
        </div>
        {err && <p className="text-sm text-red-500 dark:text-red-400">{err}</p>}
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={busy}
          className="w-full rounded-xl bg-[var(--color-brand)] text-[var(--color-on-brand)] py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? 'Отправка…' : 'Отправить заявку'}
        </button>
        </div>
      </div>
    </div>
  )
}

// ─── Статус заявки ──────────────────────────────────────────────────────────

function ApplicationStatus({ status }: { status: string }) {
  if (status === 'pending') {
    return (
      <div className="rounded-2xl border border-zinc-400/35 bg-zinc-500/[0.06] dark:border-zinc-500/30 dark:bg-zinc-500/10 p-5 text-center space-y-1 shadow-sm">
        <p className="text-zinc-800 dark:text-zinc-200 font-semibold">Заявка на рассмотрении</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Мы скоро свяжемся с вами.</p>
      </div>
    )
  }
  if (status === 'rejected') {
    return (
      <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] dark:bg-red-500/10 p-5 text-center space-y-1 shadow-sm">
        <p className="text-red-500 dark:text-red-400 font-semibold">Заявка отклонена</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Вы можете подать новую заявку.</p>
      </div>
    )
  }
  return null
}

// ─── Основная страница ──────────────────────────────────────────────────────

export default function PartnerPage() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PartnerDashboardResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copyKey, setCopyKey] = useState<string | null>(null)
  const [amountInput, setAmountInput] = useState('')
  const [payoutBusy, setPayoutBusy] = useState(false)
  const [payoutMsg, setPayoutMsg] = useState<string | null>(null)
  const [curBusy, setCurBusy] = useState(false)
  const [walletDraft, setWalletDraft] = useState('')
  const [walletBusy, setWalletBusy] = useState(false)
  const [walletMsg, setWalletMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const d = await getPartnerDashboard(token)
      setData(d)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const w = data?.payoutTrc20Address?.trim()
    if (w) setWalletDraft(w)
  }, [data?.payoutTrc20Address])

  const grossFromInput = useMemo(() => {
    const raw = amountInput.trim().replace(',', '.')
    if (!raw) return null
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return null
    return n
  }, [amountInput])

  const payoutFeeFallback = 2
  const feeUsdForPreview = data?.dashboard?.payoutFeeUsd ?? payoutFeeFallback
  const netFromInput = useMemo(() => {
    if (grossFromInput == null) return null
    return Math.round((grossFromInput - feeUsdForPreview) * 100) / 100
  }, [grossFromInput, feeUsdForPreview])

  const copyLink = async (key: string, link: string) => {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = link
      ta.style.cssText = 'position:fixed;left:-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopyKey(key)
    setTimeout(() => setCopyKey(null), 2500)
  }

  const saveWallet = async () => {
    if (!token || !data?.isPartner) return
    const addr = walletDraft.trim()
    if (!addr) {
      setWalletMsg('Введите адрес TRC20')
      return
    }
    if (!isValidTrc20Address(addr)) {
      setWalletMsg('Неверный адрес: USDT TRC20 (TRON), 34 символа, начинается с T')
      return
    }
    setWalletBusy(true)
    setWalletMsg(null)
    try {
      const r = await postPartnerPayoutWallet(token, addr)
      setWalletMsg('Кошелёк сохранён.')
      setData((prev) => (prev ? { ...prev, payoutTrc20Address: r.address } : prev))
      setWalletDraft(r.address)
      window.setTimeout(() => setWalletMsg(null), 4000)
    } catch (e) {
      setWalletMsg(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setWalletBusy(false)
    }
  }

  const handlePayout = async () => {
    if (!token || !data?.isPartner) return
    if (!data.payoutTrc20Address?.trim()) {
      setPayoutMsg('Сначала сохраните адрес USDT TRC20 (сеть TRON)')
      return
    }
    const amt = amountInput.trim() === '' ? data.dashboard?.availableUsd : Number(amountInput)
    const minUsd = data.dashboard?.minPayoutUsd ?? 10
    if (!amt || !Number.isFinite(amt) || amt < minUsd) {
      setPayoutMsg(`Минимальная сумма $${minUsd}`)
      return
    }
    setPayoutBusy(true)
    setPayoutMsg(null)
    try {
      await postPartnerPayout(token, amt)
      const fee = data.dashboard?.payoutFeeUsd ?? 2
      const net = Math.round((amt - fee) * 100) / 100
      setPayoutMsg(
        `Заявка принята: с баланса спишется $${amt.toFixed(2)}, на кошелёк — $${net.toFixed(2)} (комиссия $${fee.toFixed(2)})`
      )
      setAmountInput('')
      void load()
    } catch (e) {
      setPayoutMsg(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setPayoutBusy(false)
    }
  }

  const setCurrency = async (cur: 'rub' | 'usd') => {
    if (!token || !data?.isPartner || curBusy) return
    if (data.displayCurrency === cur) return
    setCurBusy(true)
    try {
      await postPartnerCurrency(token, cur)
      setData((prev) => prev ? { ...prev, displayCurrency: cur } : prev)
    } catch { /* ignore */ } finally {
      setCurBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-brand)] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (err) {
    return (
      <div className="py-6 text-center text-sm text-red-500 dark:text-red-400">{err}</div>
    )
  }

  if (!data) return null

  // Не партнёр — показываем форму или статус заявки
  if (!data.isPartner) {
    return (
      <div className="w-full max-w-lg lg:max-w-xl mx-auto space-y-4 py-2 pb-10">
        {data.application && data.application.status !== 'rejected' ? (
          <ApplicationStatus status={data.application.status} />
        ) : (
          <ApplyForm token={token!} onSuccess={() => void load()} />
        )}
        {data.application?.status === 'rejected' && (
          <>
            <ApplicationStatus status="rejected" />
            <ApplyForm token={token!} onSuccess={() => void load()} />
          </>
        )}
      </div>
    )
  }

  const dash = data.dashboard!
  const minPayoutUsd = dash.minPayoutUsd ?? 10
  const payoutFeeUsd = dash.payoutFeeUsd ?? 2
  const daily = data.daily ?? []
  const payouts = data.payouts ?? []
  const cur = data.displayCurrency ?? 'rub'
  const usdRub = Math.max(0.01, data.usdRubRate ?? FALLBACK_USD_RUB)
  const commPct = data.commissionPercent ?? 20
  const subPct = data.subUplinePercent ?? 5

  const dailyEarnedUsd = daily.map((d) => Math.max(0, Number(d.earnedUsd) || 0))
  const maxEarned =
    dailyEarnedUsd.length === 0 ? 1e-9 : Math.max(1e-9, ...dailyEarnedUsd)

  const siteLink = data.siteLink ?? ''
  const botLink = data.botLink ?? ''

  const directEarnedUsd =
    dash.directEarnedUsd != null
      ? Number(dash.directEarnedUsd)
      : Math.max(0, dash.totalEarnedUsd - dash.subEarnedUsd)
  const subRevenueRub = dash.subRevenueRub != null ? Number(dash.subRevenueRub) : 0
  const directRevenueRub =
    dash.directRevenueRub != null
      ? Number(dash.directRevenueRub)
      : Math.max(0, dash.totalRevenueRub - subRevenueRub)

  const statTile =
    'rounded-xl border border-slate-200/80 dark:border-slate-600/60 bg-[var(--color-body)]/40 dark:bg-slate-900/25 px-3 py-3 sm:px-3.5 sm:py-3.5'

  return (
    <div className="w-full max-w-lg lg:max-w-2xl mx-auto space-y-5 py-2 pb-12">
      <header className="px-0.5">
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50 tracking-tight">Партнёрский кабинет</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
          Код <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{data.partnerCode}</span>
          {commPct ? (
            <>
              {' '}
              · ваша комиссия <span className="font-semibold">{commPct}%</span> с покупок рефералов
            </>
          ) : null}
          {subPct ? (
            <>
              {' '}
              · <span className="font-semibold">{subPct}%</span> upline с оборота суб-партнёров
            </>
          ) : null}
        </p>
      </header>

      {/* Шапка баланса */}
      <section className={`${PCARD} overflow-hidden`}>
        <div className={PCARD_ACCENT} aria-hidden />
        <div className="p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Доступно к выводу
            </p>
            <p className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-50 tabular-nums tracking-tight mt-1">
              {toDisp(dash.availableUsd, cur, usdRub)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-snug">
              Начисления хранятся в USD; отображение — в выбранной валюте (курс из админки).
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-600 p-0.5 bg-[var(--color-body)]/80 dark:bg-slate-900/50 shadow-inner shrink-0 self-start sm:self-center">
            {(['rub', 'usd'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => void setCurrency(c)}
                disabled={curBusy}
                className={`min-w-[2.75rem] rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                  cur === c
                    ? 'bg-[var(--color-brand)] text-[var(--color-on-brand)] shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {c === 'rub' ? '₽' : '$'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={`${PCARD} overflow-hidden`}>
        <div className={PCARD_ACCENT} aria-hidden />
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Ваши ссылки</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Делитесь ссылкой на сайт или на бота — реферал закрепляется по коду в URL.
            </p>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-[var(--color-body)]/50 dark:bg-slate-900/30 p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand)]/12 text-[var(--color-brand)]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M12 2a14.5 14.5 0 0 1 0 20 14.5 14.5 0 0 1 0-20"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path d="M2 12h20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-50">Партнёрская ссылка на сайт</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Веб и мини-приложение</p>
                </div>
              </div>
              {siteLink ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 min-w-0 rounded-lg border border-slate-200/70 dark:border-slate-600/60 bg-white/60 dark:bg-slate-950/40 px-2.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 break-all max-h-24 overflow-y-auto">
                    {siteLink}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void copyLink('site', siteLink)}
                      className="rounded-lg bg-[var(--color-brand)] text-[var(--color-on-brand)] px-3 py-2 text-xs font-semibold hover:opacity-90"
                    >
                      {copyKey === 'site' ? '✓ Готово' : 'Копировать'}
                    </button>
                    <a
                      href={siteLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    >
                      Открыть
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Задайте WEB_APP_URL на сервере.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200/90 dark:border-slate-700/90 bg-[var(--color-body)]/50 dark:bg-slate-900/30 p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-50">Партнёрская ссылка на бота</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Deep-link с <span className="font-mono">/start</span> и вашим кодом</p>
                </div>
              </div>
              {botLink ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 min-w-0 rounded-lg border border-slate-200/70 dark:border-slate-600/60 bg-white/60 dark:bg-slate-950/40 px-2.5 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 break-all max-h-24 overflow-y-auto">
                    {botLink}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void copyLink('bot', botLink)}
                      className="rounded-lg bg-[var(--color-brand)] text-[var(--color-on-brand)] px-3 py-2 text-xs font-semibold hover:opacity-90"
                    >
                      {copyKey === 'bot' ? '✓ Готово' : 'Копировать'}
                    </button>
                    <a
                      href={botLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    >
                      Открыть
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  Добавьте BOT_TOKEN или TELEGRAM_BOT_USERNAME в настройках сервера — появится ссылка на бота.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Статистика: блоками */}
      <section className={`${PCARD} overflow-hidden`}>
        <div className={PCARD_ACCENT} aria-hidden />
        <div className="p-4 sm:p-5 space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Статистика</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Доход — ваши начисления в {cur === 'rub' ? 'рублях' : 'долларах'}. Оборот — сумма покупок (₽), с которых строится комиссия (прямые рефералы и сеть суб-партнёров отдельно).
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Доход (начислено вам)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className={statTile}>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Всего</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums mt-1">{toDisp(dash.totalEarnedUsd, cur, usdRub)}</p>
              </div>
              <div className={statTile}>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">С прямых рефералов</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums mt-1">{toDisp(directEarnedUsd, cur, usdRub)}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Комиссия {commPct}% с их покупок</p>
              </div>
              <div className={statTile}>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">С суб-партнёров</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums mt-1">{toDisp(dash.subEarnedUsd, cur, usdRub)}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Upline {subPct}% с оборота их сети</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Оборот покупок (по вашим начислениям)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className={statTile}>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Всего</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums mt-1">{formatRubAmount(dash.totalRevenueRub, cur, usdRub)}</p>
              </div>
              <div className={statTile}>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Прямые рефералы</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums mt-1">{formatRubAmount(directRevenueRub, cur, usdRub)}</p>
              </div>
              <div className={statTile}>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Сеть суб-партнёров</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-50 tabular-nums mt-1">{formatRubAmount(subRevenueRub, cur, usdRub)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Рефералы и активность
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { label: 'Рефералов всего', value: String(dash.referralsCount) },
                { label: 'Сделали генерацию', value: String(dash.paidReferralsCount) },
                { label: 'Всего генераций', value: String(dash.totalPurchasesCount) },
              ].map((s) => (
                <div key={s.label} className={statTile}>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{s.label}</p>
                  <p className="text-base font-bold text-slate-900 dark:text-slate-50 tabular-nums mt-1.5">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Суб-партнёрская сеть — всегда видно */}
      <section className={`${PCARD} overflow-hidden ring-1 ring-slate-200/90 dark:ring-slate-700/60`}>
        <div className={PCARD_ACCENT} aria-hidden />
        <div className="p-4 sm:p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Суб-партнёрская сеть</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Если вы привели другого партнёра, он закрепляется за вами. Вы получаете{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">{subPct}%</span> с оборота его сети (upline).
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className={statTile}>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Суб-партнёров</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-50 tabular-nums mt-1">{dash.subPartnersCount}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Привлечённых вами партнёров</p>
            </div>
            <div className={statTile}>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Их оборот (покупки сети)</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-50 tabular-nums mt-1">{formatRubAmount(subRevenueRub, cur, usdRub)}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">₽ по событиям комиссии «sub»</p>
            </div>
            <div className={statTile}>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Ваш доход с суб-сети</p>
              <p className="text-xl font-bold text-slate-900 dark:text-slate-50 tabular-nums mt-1">{toDisp(dash.subEarnedUsd, cur, usdRub)}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Сумма начислений upline</p>
            </div>
          </div>
          {dash.subPartnersCount === 0 && dash.subEarnedUsd === 0 && subRevenueRub === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 rounded-lg border border-dashed border-slate-200 dark:border-slate-600 px-3 py-2.5 bg-[var(--color-body)]/30">
              Пока нет суб-партнёров. Пригласите коллег по программе вашей реферальной ссылкой — после одобрения заявки они появятся здесь.
            </p>
          ) : null}
        </div>
      </section>

      {/* График: столбики по дням, высота относительно лучшего дня; сумма в выбранной валюте над столбиком */}
      {daily.length > 0 && (
        <section className={`${PCARD} overflow-hidden`}>
          <div className="px-4 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              Заработок по дням
            </h3>
          </div>
          <div className="p-4 pt-3">
            <div className="flex items-end justify-between gap-1 sm:gap-1.5">
              {daily.map((row: PartnerDailyRow, idx: number) => {
                const earned = dailyEarnedUsd[idx] ?? 0
                const hasEarned = earned > 0
                const plotPx = 120
                const minBarPct = (6 / plotPx) * 100
                const barHeightPct = hasEarned
                  ? Math.max(minBarPct, (earned / maxEarned) * 100)
                  : 0
                return (
                  <div
                    key={row.date}
                    className="flex min-w-0 min-h-0 flex-1 flex-col items-center gap-1"
                    title={`${row.date}: ${hasEarned ? toDisp(earned, cur, usdRub) : 'нет начислений'}`}
                  >
                    <div className="flex min-h-[2.75rem] w-full items-end justify-center px-0.5">
                      {hasEarned ? (
                        <span className="max-w-full text-center text-[10px] font-semibold leading-tight text-slate-800 dark:text-slate-100 tabular-nums break-words">
                          {toDisp(earned, cur, usdRub)}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="relative w-full overflow-hidden rounded-t-md bg-slate-200 dark:bg-slate-800 shrink-0"
                      style={{ height: plotPx }}
                    >
                      <div
                        className={`absolute bottom-0 left-0 right-0 rounded-t-md transition-[height] duration-300 ${
                          hasEarned
                            ? 'bg-[var(--color-brand)] shadow-[0_-2px_10px_rgba(0,0,0,0.12)] dark:shadow-[0_-2px_14px_rgba(0,0,0,0.35)]'
                            : 'bg-slate-400 dark:bg-slate-600'
                        }`}
                        style={{
                          height: hasEarned ? `${barHeightPct}%` : 3,
                        }}
                      />
                    </div>
                    <span className="w-full truncate text-center text-[9px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {formatDay(row.date)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Таблица по дням */}
      {daily.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2 px-0.5">
            Детализация по дням
          </h3>
          <div className={`${PCARD} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-[var(--color-body)]/50 dark:bg-slate-900/40">
                    {['Дата', 'Начислено', 'Оборот', 'Рефер.', 'Покупки'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...daily].reverse().map((row) => (
                    <tr
                      key={row.date}
                      className="border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDay(row.date)}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                        {toDisp(row.earnedUsd, cur, usdRub)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
                        {formatRubAmount(row.grossRub, cur, usdRub)}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 tabular-nums">{row.newReferrals}</td>
                      <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 tabular-nums">{row.purchaseEvents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Вывод средств */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50 px-0.5">Вывод средств</h2>
        <div className={`${PCARD} overflow-hidden`}>
          <div className={PCARD_ACCENT} aria-hidden />
          <div className="p-4 sm:p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 9a2 2 0 012-2h2l1-2h6l1 2h2a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V9z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Кошелёк USDT (TRC20)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Сеть <span className="font-semibold text-slate-700 dark:text-slate-300">TRON</span>. Вывод только на сохранённый адрес.
                </p>
              </div>
            </div>
            <input
              type="text"
              value={walletDraft}
              onChange={(e) => setWalletDraft(e.target.value.trimStart())}
              placeholder="T… (34 символа)"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2.5 text-sm font-mono shadow-inner"
            />
            <button
              type="button"
              onClick={() => void saveWallet()}
              disabled={walletBusy}
              className="w-full rounded-xl border border-[var(--color-brand)]/35 bg-[var(--color-brand)]/8 text-[var(--color-brand)] dark:text-[var(--color-brand)] py-2.5 text-sm font-semibold hover:bg-[var(--color-brand)]/14 disabled:opacity-50 transition-colors"
            >
              {walletBusy ? 'Сохранение…' : data.payoutTrc20Address ? 'Обновить кошелёк' : 'Сохранить кошелёк'}
            </button>
            {data.payoutTrc20Address ? (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 break-all">
                Активный: <span className="font-mono text-slate-800 dark:text-slate-200">{data.payoutTrc20Address}</span>
              </p>
            ) : null}
            {walletMsg ? (
              <p
                className={`text-sm ${walletMsg.includes('Ошибка') || walletMsg.includes('Введите') || walletMsg.includes('Неверный') ? 'text-red-500 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}
              >
                {walletMsg}
              </p>
            ) : null}
          </div>
        </div>

        <div className={`${PCARD} p-4 sm:p-5 space-y-3`}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Запросить вывод</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Минимум к списанию с баланса —{' '}
            <span className="font-semibold tabular-nums">${minPayoutUsd}</span>. Фиксированная комиссия —{' '}
            <span className="font-semibold tabular-nums">${payoutFeeUsd.toFixed(2)}</span> с каждой заявки: на кошелёк
            поступит сумма за вычетом комиссии (например, заявка ${minPayoutUsd} → к выплате ${(minPayoutUsd - payoutFeeUsd).toFixed(2)}).
          </p>
          {data.payoutTrc20Address?.trim() ? (
            <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 break-all bg-[var(--color-body)] rounded-lg px-2 py-1.5 border border-slate-200/60 dark:border-slate-700/60">
              {data.payoutTrc20Address}
            </p>
          ) : null}
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder={`USD (доступно $${dash.availableUsd.toFixed(2)})`}
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm shadow-inner"
            />
            <button
              type="button"
              onClick={() => setAmountInput(dash.availableUsd.toFixed(2))}
              className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
            >
              Max
            </button>
          </div>
          {grossFromInput != null && grossFromInput >= minPayoutUsd ? (
            <p className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums rounded-lg border border-slate-200/80 dark:border-slate-600/60 bg-[var(--color-body)] px-2.5 py-2">
              С баланса спишется <span className="font-semibold">${grossFromInput.toFixed(2)}</span>
              {netFromInput != null ? (
                <>
                  , на кошелёк — <span className="font-semibold text-emerald-600 dark:text-emerald-400">${netFromInput.toFixed(2)}</span>
                  <span className="text-slate-400"> (комиссия ${payoutFeeUsd.toFixed(2)})</span>
                </>
              ) : null}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void handlePayout()}
            disabled={payoutBusy || dash.availableUsd < minPayoutUsd || !data.payoutTrc20Address?.trim()}
            className="w-full rounded-xl bg-[var(--color-brand)] text-[var(--color-on-brand)] py-2.5 text-sm font-semibold shadow-sm hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {payoutBusy ? 'Отправка…' : 'Запросить вывод'}
          </button>
          {!data.payoutTrc20Address?.trim() && dash.availableUsd >= minPayoutUsd ? (
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Сначала сохраните адрес кошелька выше.</p>
          ) : null}
          {payoutMsg ? (
            <p
              className={`text-sm ${payoutMsg.includes('принят') || payoutMsg.includes('Заявка') || payoutMsg.includes('отправлен') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}
            >
              {payoutMsg}
            </p>
          ) : null}
        </div>
      </section>

      {/* История выводов */}
      <section>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-2 px-0.5">
          История выводов
        </h3>
        <p className="text-[10px] text-slate-500 dark:text-slate-400 px-0.5 -mt-1 mb-2">
          В таблице указана сумма к зачислению на USDT-кошелёк (после вычета комиссии ${payoutFeeUsd.toFixed(2)}).
        </p>
        {payouts.length === 0 ? (
          <p className={`text-sm text-slate-400 dark:text-slate-500 text-center py-8 ${PCARD}`}>Выводов пока нет</p>
        ) : (
          <div className={`${PCARD} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-[var(--color-body)]/50 dark:bg-slate-900/40">
                    {['Дата', 'К выплате', 'TRC20', 'Статус'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((row: PartnerPayoutRow) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 dark:border-slate-800/80 last:border-0 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDateTime(row.requestedAt)}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                        ${row.amountUsd.toFixed(2)}
                        {row.amountRub != null && cur === 'rub' && (
                          <span className="text-slate-400 ml-1">({row.amountRub.toFixed(0)} ₽)</span>
                        )}
                      </td>
                      <td
                        className="px-3 py-2.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 max-w-[140px] truncate"
                        title={row.payoutTrc20Address ?? ''}
                      >
                        {row.payoutTrc20Address
                          ? `${row.payoutTrc20Address.slice(0, 6)}…${row.payoutTrc20Address.slice(-4)}`
                          : '—'}
                      </td>
                      <td className={`px-3 py-2.5 font-medium ${statusColor(row.status)}`}>
                        {statusLabel(row.status)}
                        {row.adminNotes ? (
                          <p className="text-[10px] text-slate-400 font-normal">{row.adminNotes}</p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
