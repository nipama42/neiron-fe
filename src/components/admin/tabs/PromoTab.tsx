import { useEffect, useState } from 'react'
import { getAdminPromoCodes, postAdminGrant, postAdminPromoCode, type PromoCodeRow } from '../../../api/admin'
import { useAuth } from '../../../store/authStore'

export default function PromoTab() {
  const { token } = useAuth()
  const [promos, setPromos] = useState<PromoCodeRow[]>([])
  const [promoCode, setPromoCode] = useState('')
  const [promoCredits, setPromoCredits] = useState('100')
  const [promoMaxUses, setPromoMaxUses] = useState('')
  const [grantTarget, setGrantTarget] = useState('')
  const [grantCredits, setGrantCredits] = useState('50')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    void getAdminPromoCodes(token)
      .then((r) => setPromos(r.codes))
      .catch(() => setPromos([]))
  }, [token])

  const createPromo = async () => {
    if (!token) return
    setErr(null)
    setMsg(null)
    const code = promoCode.trim()
    const credits = Number(promoCredits)
    if (code.length < 3) return setErr('Код минимум 3 символа (латиница, цифры, _)')
    if (!Number.isFinite(credits) || credits <= 0) return setErr('Укажите число кредитов больше 0')
    let maxUses: number | null = null
    if (promoMaxUses.trim() !== '') {
      const m = Number(promoMaxUses)
      if (!Number.isFinite(m) || m < 1) return setErr('Лимит активаций — целое число ≥ 1 или пусто')
      maxUses = m
    }
    try {
      await postAdminPromoCode(token, { code, credits, maxUses })
      setPromoCode('')
      setMsg('Промокод создан')
      const pr = await getAdminPromoCodes(token)
      setPromos(pr.codes)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  const grant = async () => {
    if (!token) return
    setErr(null)
    setMsg(null)
    const target = grantTarget.trim()
    const credits = Number(grantCredits)
    if (!target) return setErr('Укажите пользователя: UUID, email, логин, тег или @Telegram')
    if (!Number.isFinite(credits) || credits <= 0) return setErr('Сумма начисления должна быть больше 0')
    try {
      await postAdminGrant(token, { target, credits })
      setMsg('Баланс начислен')
      setGrantTarget('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка')
    }
  }

  return (
    <div className="p-3 space-y-3">
      {msg ? <p className="px-3 py-2 text-xs rounded-xl text-emerald-600 bg-emerald-500/10">{msg}</p> : null}
      {err ? <p className="px-3 py-2 text-xs rounded-xl text-red-600 bg-red-500/10">{err}</p> : null}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface p-3 space-y-2">
        <h3 className="text-sm font-semibold">Промокод</h3>
        <input
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="Код (латиница, цифры)"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={promoCredits}
            onChange={(e) => setPromoCredits(e.target.value)}
            placeholder="Монет"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={promoMaxUses}
            onChange={(e) => setPromoMaxUses(e.target.value)}
            placeholder="Лимит (пусто = ∞)"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void createPromo()}
          className="w-full rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 py-2 text-sm font-medium"
        >
          Создать промокод
        </button>
        <div className="max-h-36 overflow-y-auto text-[11px] text-slate-500 space-y-1">
          {promos.slice(0, 30).map((p) => (
            <div key={p.code} className="flex justify-between gap-2">
              <span className="font-mono">{p.code}</span>
              <span>
                +{p.credits} ({p.usesCount}
                {p.maxUses != null ? `/${p.maxUses}` : ''})
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-600 bg-surface p-3 space-y-2">
        <h3 className="text-sm font-semibold">Начислить баланс</h3>
        <input
          value={grantTarget}
          onChange={(e) => setGrantTarget(e.target.value)}
          placeholder="UUID, email, логин, тег или @username"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm"
        />
        <input
          type="number"
          value={grantCredits}
          onChange={(e) => setGrantCredits(e.target.value)}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-[var(--color-body)] px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void grant()}
          className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2 text-sm font-medium"
        >
          Начислить
        </button>
      </section>
    </div>
  )
}
