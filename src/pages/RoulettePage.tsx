import { useCallback, useEffect, useRef, useState } from 'react'
import { postWalletPromo, postWalletRoulette } from '../api/wallet'
import { useAuth } from '../store/authStore'
import { useTheme } from '../store/themeContext'
import { useTelegram } from '../hooks/useTelegram'

const STORAGE_ROULETTE = 'neiro_bonuses_roulette_at'
const STORAGE_PROMOS = 'neiro_bonuses_promos_used'

const SPIN_MS = 6800
const LABEL_RADIUS_RATIO = 0.82
const HUB_INSET_PCT = 22

const PROMO_REWARDS: Record<string, number> = {
  NEIRO50: 50,
  START100: 100,
  PLUS200: 200,
  WELCOME: 75,
}

type RouletteSeg = { credits: number; weight: number }

/**
 * 20 визуальных секторов. Победитель выбирается взвешенно (сумма весов = 173).
 * 150/200/300 — weight:1 (≈0.58% каждый, в ~5х реже остальных призов).
 * E[кредиты/спин] ≈ 16.
 */
const ROULETTE_SEGMENTS: readonly RouletteSeg[] = [
  { credits: 0,   weight: 15 },
  { credits: 10,  weight: 10 },
  { credits: 0,   weight: 15 },
  { credits: 5,   weight: 10 },
  { credits: 0,   weight: 15 },
  { credits: 15,  weight: 10 },
  { credits: 0,   weight: 15 },
  { credits: 20,  weight: 10 },
  { credits: 0,   weight: 10 },
  { credits: 25,  weight: 10 },
  { credits: 0,   weight: 10 },
  { credits: 50,  weight: 10 },
  { credits: 0,   weight: 10 },
  { credits: 75,  weight: 5  },
  { credits: 0,   weight: 5  },
  { credits: 100, weight: 5  },
  { credits: 0,   weight: 5  },
  { credits: 150, weight: 1  },
  { credits: 200, weight: 1  },
  { credits: 300, weight: 1  },
] as const

const SECTOR_COUNT = ROULETTE_SEGMENTS.length
const SECTOR_DEG = 360 / SECTOR_COUNT

function labelOffsetAndRotation(aDeg: number, r: number) {
  const a = (aDeg * Math.PI) / 180
  const x = r * Math.sin(a)
  const y = -r * Math.cos(a)
  const inX = -Math.sin(a)
  const inY = Math.cos(a)
  const textRot = (Math.atan2(inY, inX) * 180) / Math.PI - 90
  return { x, y, textRot }
}

function weightedRandom(segs: readonly RouletteSeg[]): number {
  const total = segs.reduce((s, seg) => s + seg.weight, 0)
  let r = Math.random() * total
  for (let i = 0; i < segs.length; i++) {
    r -= segs[i].weight
    if (r <= 0) return i
  }
  return segs.length - 1
}

function msUntilNextRoulette(lastIso: string | null): number {
  if (!lastIso) return 0
  return Math.max(0, new Date(lastIso).getTime() + 24 * 60 * 60 * 1000 - Date.now())
}

function formatCooldown(ms: number): string {
  if (ms <= 0) return ''
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  if (h > 0) return `${h} ч ${m} мин`
  if (m > 0) return `${m} мин ${s} сек`
  return `${s} сек`
}

function loadUsedPromos(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_PROMOS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch { return [] }
}
function saveUsedPromos(codes: string[]) {
  localStorage.setItem(STORAGE_PROMOS, JSON.stringify(codes))
}

export default function RoulettePage() {
  const { token, user, mergeUser, addCredits } = useAuth()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const isApi = Boolean(token && token !== 'local-dev')
  const { ready } = useTelegram()

  const [promo, setPromo] = useState('')
  const [promoMsg, setPromoMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [usedPromos, setUsedPromos] = useState<string[]>(() => loadUsedPromos())
  const [rouletteAt, setRouletteAt] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_ROULETTE)
  )
  const [cooldownLeft, setCooldownLeft] = useState(() =>
    msUntilNextRoulette(localStorage.getItem(STORAGE_ROULETTE))
  )
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [resultMsg, setResultMsg] = useState<string | null>(null)
  const [resultCredits, setResultCredits] = useState<number | null>(null)
  const wheelRef = useRef<HTMLDivElement>(null)
  const [labelRadiusPx, setLabelRadiusPx] = useState(120)

  useEffect(() => {
    const el = wheelRef.current
    if (!el) return
    const update = () => {
      const w = el.offsetWidth
      if (w < 8) return
      setLabelRadiusPx(Math.round((w / 2) * LABEL_RADIUS_RATIO))
    }
    const schedule = () => {
      requestAnimationFrame(() => requestAnimationFrame(update))
    }
    schedule()
    const periodic = window.setInterval(schedule, 1000)
    window.addEventListener('resize', schedule)
    const t = window.setTimeout(schedule, 0)
    return () => {
      window.clearInterval(periodic)
      window.removeEventListener('resize', schedule)
      window.clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    ready()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isApi) { setRouletteAt(localStorage.getItem(STORAGE_ROULETTE)); return }
    if (user) setRouletteAt(user.rouletteLastSpinAt ?? null)
  }, [isApi, user])

  useEffect(() => {
    setCooldownLeft(msUntilNextRoulette(rouletteAt))
    const t = setInterval(() => setCooldownLeft(msUntilNextRoulette(rouletteAt)), 1000)
    return () => clearInterval(t)
  }, [rouletteAt])

  // Цветовая схема колеса — оригинальный монохромный стиль
  const wheelFill     = isDark ? '#ffffff' : '#0e0e0e'
  const labelColor    = isDark ? '#0f0f0f' : '#f5f5f5'
  const separatorLine = isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)'
  const ringShadow = isDark
    ? 'inset 0 0 0 1px rgba(0,0,0,0.06), 0 1px 0 rgba(255,255,255,0.25)'
    : 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.2)'

  const activatePromo = async () => {
    setPromoMsg(null)
    const code = promo.trim().toUpperCase()
    if (!code) { setPromoMsg({ type: 'err', text: 'Введите промокод' }); return }
    if (isApi && token) {
      try {
        const r = await postWalletPromo(token, code)
        mergeUser(r.user)
        const added =
          r.user.ledger?.find((e) => e.kind === 'promo' && e.ref === code)?.delta ??
          PROMO_REWARDS[code] ?? 0
        setPromoMsg({ type: 'ok', text: `Начислено ${added} кредитов` })
        setPromo('')
      } catch (e) {
        setPromoMsg({ type: 'err', text: e instanceof Error ? e.message : 'Не удалось активировать' })
      }
      return
    }
    const reward = PROMO_REWARDS[code]
    if (reward == null) { setPromoMsg({ type: 'err', text: 'Промокод не найден' }); return }
    if (usedPromos.includes(code)) { setPromoMsg({ type: 'err', text: 'Уже активирован' }); return }
    const next = [...usedPromos, code]
    setUsedPromos(next); saveUsedPromos(next); addCredits(reward)
    setPromoMsg({ type: 'ok', text: `Начислено ${reward} кредитов` })
    setPromo('')
  }

  const finishSpin = useCallback(async (wonSeg: RouletteSeg) => {
    if (isApi && token) {
      try {
        const r = await postWalletRoulette(token, wonSeg.credits)
        mergeUser(r.user)
        const at = r.user.rouletteLastSpinAt ?? new Date().toISOString()
        setRouletteAt(at)
        setCooldownLeft(msUntilNextRoulette(at))
      } catch (e) {
        setSpinning(false)
        setResultMsg(e instanceof Error ? e.message : 'Ошибка рулетки')
        setResultCredits(null)
        return
      }
    } else {
      const now = new Date().toISOString()
      localStorage.setItem(STORAGE_ROULETTE, now)
      setRouletteAt(now)
      setCooldownLeft(msUntilNextRoulette(now))
      if (wonSeg.credits > 0) addCredits(wonSeg.credits)
    }
    setSpinning(false)
    if (wonSeg.credits > 0) {
      setResultCredits(wonSeg.credits)
      setResultMsg(`Выпало ${wonSeg.credits} кредитов`)
    } else {
      setResultCredits(null)
      setResultMsg('Пустой сектор — кредиты не начислены')
    }
  }, [addCredits, isApi, mergeUser, token])

  const spin = () => {
    if (spinning || cooldownLeft > 0) return
    setResultMsg(null)
    setResultCredits(null)
    setSpinning(true)

    const winningIndex = weightedRandom(ROULETTE_SEGMENTS)
    const wonSeg = ROULETTE_SEGMENTS[winningIndex]
    const W = ((winningIndex + 0.5) / SECTOR_COUNT) * 360
    const spins = 6 + Math.floor(Math.random() * 3)
    const R0 = rotation
    const rem = ((W + R0) % 360 + 360) % 360
    const delta = spins * 360 + (rem === 0 ? 0 : 360 - rem)
    setRotation(R0 + delta)
    window.setTimeout(() => void finishSpin(wonSeg), SPIN_MS)
  }

  const canSpin = cooldownLeft <= 0 && !spinning
  const cooldownText = cooldownLeft > 0
    ? `Следующее вращение через ${formatCooldown(cooldownLeft)}`
    : null

  // Фильтр для монеты-иконки на сегменте: на тёмной теме (белое колесо) монета чёрная,
  // на светлой теме (чёрное колесо) монета белая (инвертируем)
  const coinFilter = isDark ? 'none' : 'invert(1)'

  return (
    <div className="container pt-2 pb-6">
      <section className="mx-auto w-full max-w-5xl bg-surface rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="grid gap-6 lg:grid-cols-3 items-start">

          {/* ── Колесо ── */}
          <div className="pt-1 lg:col-span-2">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Рулетка</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Одно вращение раз в 24 часа. Попадаются и пустые сектора.
            </p>

            <div className="w-full max-w-[340px] mx-auto">
              <div ref={wheelRef} className="relative w-full aspect-square select-none">

                {/* Указатель */}
                <div className="absolute left-1/2 z-30 -translate-x-1/2" style={{ top: -5 }}>
                  <div
                    className="w-0 h-0 border-l-[9px] border-r-[9px] border-t-[14px] border-l-transparent border-r-transparent"
                    style={{ borderTopColor: isDark ? '#0f0f0f' : '#f0f0f0' }}
                  />
                </div>

                {/* Вращающееся колесо */}
                <div
                  className="relative w-full h-full rounded-full will-change-transform overflow-hidden"
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition: spinning
                      ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.72, 0.1, 1)`
                      : 'none',
                    boxShadow: isDark
                      ? '0 0 0 3px rgba(255,255,255,0.55), 0 0 0 6px rgba(255,255,255,0.15), 0 0 24px rgba(255,255,255,0.06)'
                      : '0 0 0 3px rgba(0,0,0,0.4), 0 0 0 6px rgba(0,0,0,0.12), 0 0 24px rgba(0,0,0,0.1)',
                  }}
                >
                  {/* Монохромный фон */}
                  <div
                    className="absolute inset-0"
                    style={{ background: wheelFill, boxShadow: ringShadow }}
                  />

                  {/* Разделители — тонкие повёрнутые линии, без пикселизации */}
                  {ROULETTE_SEGMENTS.map((_, i) => {
                    const angle = (i / SECTOR_COUNT) * 360
                    return (
                      <div
                        key={`sep-${i}`}
                        className="absolute pointer-events-none"
                        style={{
                          width: '50%',
                          height: '1px',
                          top: '50%',
                          left: '50%',
                          transformOrigin: 'left center',
                          transform: `rotate(${angle}deg)`,
                          background: separatorLine,
                        }}
                      />
                    )
                  })}

                  {/* Подписи: число + монетка */}
                  <div className="absolute inset-0 pointer-events-none z-[2]">
                    {ROULETTE_SEGMENTS.map((seg, i) => {
                      if (seg.credits === 0) return null
                      const a = (i + 0.5) * SECTOR_DEG
                      const { x, y, textRot } = labelOffsetAndRotation(a, labelRadiusPx)
                      return (
                        <div
                          key={i}
                          className="absolute left-1/2 top-1/2 flex flex-col items-center"
                          style={{
                            gap: '2px',
                            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${textRot}deg)`,
                          }}
                        >
                          <span
                            className="font-semibold tabular-nums whitespace-nowrap leading-none"
                            style={{
                              fontSize: seg.credits >= 100 ? '11px' : '12px',
                              color: labelColor,
                            }}
                          >
                            {seg.credits}
                          </span>
                          <img
                            src="/neuron-coin.png"
                            alt=""
                            draggable={false}
                            style={{ width: 12, height: 12, objectFit: 'contain', filter: coinFilter }}
                          />
                        </div>
                      )
                    })}
                  </div>

                  {/* Ступица */}
                  <div
                    className="absolute z-[4] rounded-full flex items-center justify-center bg-base border border-gray-200/80 dark:border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    style={{ inset: `${HUB_INSET_PCT}%` }}
                  >
                    <img
                      src="/neuron-coin.png"
                      alt=""
                      draggable={false}
                      className="w-1/2 h-1/2 object-contain"
                      style={{ filter: isDark ? 'invert(1)' : 'none' }}
                    />
                  </div>
                </div>
              </div>

              {/* Кнопка */}
              <button
                type="button"
                disabled={!canSpin}
                onClick={spin}
                className={`mt-6 w-full py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                  canSpin
                    ? 'bg-brand text-[var(--color-on-brand)] shadow-md shadow-brand/25 active:opacity-90'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {spinning ? 'Крутится…' : canSpin ? 'Крутить рулетку' : 'Уже крутили сегодня'}
              </button>

              {cooldownText && (
                <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                  {cooldownText}
                </p>
              )}

              {resultMsg && (
                <div className={`mt-3 rounded-xl px-4 py-3 text-center ${
                  resultCredits
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/40'
                    : 'bg-gray-50 dark:bg-gray-900/30 border border-gray-200/60 dark:border-gray-700/40'
                }`}>
                  {resultCredits ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        +{resultCredits}
                      </span>
                      <img
                        src="/neuron-coin.png"
                        alt=""
                        className={`w-5 h-5 object-contain ${isDark ? 'invert' : ''}`}
                      />
                    </div>
                  ) : (
                    <p className={`text-sm font-medium ${
                      resultMsg.includes('Пустой')
                        ? 'text-zinc-700 dark:text-zinc-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {resultMsg}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Промокод ── */}
          <div className="border-t border-gray-100 pt-4 dark:border-gray-800 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0 lg:col-span-1 lg:self-center">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">Промокод</h2>
            <input
              type="text"
              value={promo}
              onChange={(e) => setPromo(e.target.value)}
              placeholder="Введите промокод"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-base px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand/40 mb-3"
              autoCapitalize="characters"
            />
            <button
              type="button"
              onClick={activatePromo}
              className="w-full py-3 rounded-xl bg-brand text-[var(--color-on-brand)] text-sm font-semibold active:opacity-90"
            >
              Активировать
            </button>
            {promoMsg && (
              <p className={`mt-3 text-sm ${promoMsg.type === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {promoMsg.text}
              </p>
            )}
          </div>

        </div>
      </section>
    </div>
  )
}
