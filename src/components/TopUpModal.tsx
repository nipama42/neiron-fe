import { useEffect, useRef, useState } from 'react'
import type { AuthUser } from '../api/auth'
import SbpLogo from '../assets/sbp.png'
import CryptoBotLogo from '../assets/cryptobot.png'
import {
  getPaymentPackages,
  createPaymentOrder,
  getPaymentOrderStatus,
  type PaymentPackage,
  type CreateOrderResponse,
} from '../api/wallet'
import { openCheckoutUrl, openCryptobotCheckout, pickCheckoutPayUrl } from '../lib/openCheckoutUrl'
import { savePendingOrder, clearPendingOrder } from '../lib/pendingPaymentStore'
import CreditCoin from './ui/CreditCoin'

interface Props {
  token: string
  onClose: () => void
  onSuccess: (user: AuthUser) => void
}

type Step = 'packages' | 'method' | 'paying' | 'success'

const POPULAR_PACKAGE_ID = 'pack_499'
const POLL_INTERVAL_MS = 3000
const SUCCESS_AUTO_CLOSE_MS = 2500

function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

export default function TopUpModal({ token, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('packages')
  const [packages, setPackages] = useState<PaymentPackage[]>([])
  const [loadingPkgs, setLoadingPkgs] = useState(true)
  const [pkgsErr, setPkgsErr] = useState<string | null>(null)

  const [selectedPkg, setSelectedPkg] = useState<PaymentPackage | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<'sbp' | 'cryptobot' | null>(null)

  const [creatingOrder, setCreatingOrder] = useState(false)
  const [orderErr, setOrderErr] = useState<string | null>(null)
  const [order, setOrder] = useState<CreateOrderResponse | null>(null)

  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'failed'>('pending')
  const [pollingActive, setPollingActive] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const payOpenLockUntilRef = useRef(0)
  const [copiedPayHint, setCopiedPayHint] = useState(false)
  useEffect(() => {
    setLoadingPkgs(true)
    getPaymentPackages()
      .then(({ packages: pkgs }) => {
        setPackages(pkgs)
      })
      .catch((e) => setPkgsErr(e.message))
      .finally(() => setLoadingPkgs(false))
  }, [])

  useEffect(() => {
    if (!pollingActive || !order) return
    const poll = async () => {
      try {
        const r = await getPaymentOrderStatus(token, order.orderId)
        if (r.status === 'paid') {
          clearInterval(pollRef.current!)
          setPollingActive(false)
          setPaymentStatus('paid')
          setStep('success')
          clearPendingOrder()
          if (r.user) {
            onSuccess(r.user)
            setTimeout(onClose, SUCCESS_AUTO_CLOSE_MS)
          }
        } else if (r.status === 'failed' || r.status === 'expired') {
          clearInterval(pollRef.current!)
          setPollingActive(false)
          setPaymentStatus('failed')
        }
      } catch {
        // network error, keep polling
      }
    }
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current!)
  }, [pollingActive, order, token, onSuccess, onClose])

  async function handleSelectMethod(method: 'sbp' | 'cryptobot') {
    if (!selectedPkg) return
    if (creatingOrder) return
    setSelectedMethod(method)
    setOrderErr(null)
    setCreatingOrder(true)
    try {
      const o = await createPaymentOrder(token, selectedPkg.id, method)
      savePendingOrder(o.orderId, o.method)
      setOrder(o)
      setStep('paying')
      setPollingActive(true)
      // Не открываем автоматически — пользователь нажимает кнопку сам.
      // Это исключает ситуацию, когда openTelegramLink/openLink вызывается до
      // того, как React отрисовал экран «Ожидание оплаты».
    } catch (e) {
      setOrderErr(e instanceof Error ? e.message : 'Не удалось создать платёж')
    } finally {
      setCreatingOrder(false)
    }
  }

  function handleClose() {
    if (pollingActive) {
      clearInterval(pollRef.current!)
      setPollingActive(false)
    }
    onClose()
  }

  function goBack() {
    if (step === 'method') {
      setStep('packages')
      setOrderErr(null)
    } else if (step === 'paying') {
      clearInterval(pollRef.current!)
      setPollingActive(false)
      setOrder(null)
      setPaymentStatus('pending')
      setOrderErr(null)
      setCopiedPayHint(false)
      setStep('method')
    }
  }

  const backdropCls =
    'fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 modal-backdrop-safe-tg'
  const panelCls =
    'relative w-full sm:max-w-md bg-[var(--color-surface)] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden'

  return (
    <div
      className={backdropCls}
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className={panelCls}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0 border-b border-[var(--color-brand-light)]/50">
          <div className="flex items-center gap-2">
            {(step === 'method' || step === 'paying') && (
              <button
                onClick={goBack}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 mr-1 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            <h2 className="font-semibold text-[var(--color-brand)]">
              {step === 'packages' && 'Пополнение баланса'}
              {step === 'method' && 'Способ оплаты'}
              {step === 'paying' && 'Ожидание оплаты'}
              {step === 'success' && 'Оплата прошла'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 pt-4 pb-6">
          {/* ── Step: packages ── */}
          {step === 'packages' && (
            <>
              {loadingPkgs ? (
                <div className="flex items-center justify-center py-12">
                  <Spinner className="w-6 h-6 text-[var(--color-brand)]" />
                </div>
              ) : pkgsErr ? (
                <p className="text-center text-sm text-red-500 py-8">{pkgsErr}</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-[var(--color-brand)] opacity-85 mb-5">
                    Выберите пакет кредитов для пополнения
                  </p>
                  <div className="grid grid-cols-1 gap-3.5">
                    {(() => {
                      const basePricePerCredit = Math.max(...packages.map(p => p.rub / p.credits))
                      return packages.map((pkg) => {
                      const isPopular = pkg.id === POPULAR_PACKAGE_ID
                      const pricePerCredit = pkg.rub / pkg.credits
                      const discountPct =
                        pricePerCredit < basePricePerCredit
                          ? Math.round(Math.round((1 - pricePerCredit / basePricePerCredit) * 100) / 5) * 5
                          : 0
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => { setSelectedPkg(pkg); setStep('method') }}
                          className={`group relative flex items-center justify-between gap-4 rounded-3xl px-5 py-4 text-left transition-all active:scale-[0.98] ${
                            isPopular
                              ? 'bg-[var(--color-brand)] text-[var(--color-on-brand)] border-2 border-zinc-300/80 shadow-xl shadow-black/10 dark:border-zinc-400/70 dark:shadow-black/35'
                              : 'border border-[var(--color-brand-light)] bg-[var(--color-brand-light)]/35 text-[var(--color-brand)] hover:bg-[var(--color-brand-light)]/55 hover:border-[var(--color-brand)]/40 hover:shadow-md shadow-sm dark:border-white/15 dark:bg-[var(--color-brand-light)]/40'
                          }`}
                        >
                          <div className="flex flex-col gap-2 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {isPopular && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] font-extrabold uppercase tracking-wide rounded-full px-2.5 py-1 shadow-md
                                  bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-300 text-amber-950
                                  ring-1 ring-amber-600/45 dark:from-amber-400 dark:via-amber-300 dark:to-yellow-500 dark:text-amber-950 dark:ring-amber-800/35"
                                  style={{ textShadow: '0 1px 0 rgba(255,255,255,0.35)' }}
                                >
                                  <span aria-hidden>✦</span>
                                  Популярный
                                </span>
                              )}
                              <span
                                className={`text-xs font-medium uppercase tracking-wide ${isPopular ? 'text-[var(--color-on-brand)]/65' : 'opacity-70'}`}
                              >
                                Кредиты
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-bold tabular-nums tracking-tight">
                                {pkg.credits.toLocaleString('ru')}
                              </span>
                              <CreditCoin className="w-6 h-6 sm:w-7 sm:h-7" onBrandBackground={isPopular} />
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            {discountPct > 0 && (
                              <span
                                className={`block text-[11px] font-extrabold tabular-nums mb-0.5 leading-tight ${
                                  isPopular
                                    ? 'rounded-md px-1.5 py-0.5 -mr-0.5 -mt-0.5 inline-block bg-amber-400/90 text-amber-950 shadow-sm ring-1 ring-amber-700/25 dark:bg-gradient-to-r dark:from-amber-500 dark:to-yellow-500 dark:text-amber-950 dark:ring-amber-900/30'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                −{discountPct}%
                              </span>
                            )}
                            <span className="block text-xl font-bold tabular-nums">
                              {pkg.rub.toLocaleString('ru')} ₽
                            </span>
                          </div>
                        </button>
                      )
                    })
                    })()}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Step: method ── */}
          {step === 'method' && selectedPkg && (
            <>
              {/* Selected package summary */}
              <div className="flex items-center justify-between rounded-3xl border border-[var(--color-brand-light)] bg-[var(--color-brand-light)]/40 dark:border-white/12 px-4 py-3.5 mb-5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[var(--color-brand)]">{selectedPkg.credits.toLocaleString('ru')}</span>
                  <CreditCoin className="w-4 h-4" />
                  <span className="text-[var(--color-brand)]/70 dark:text-[var(--color-brand)]/65 text-sm ml-0.5">
                    кредитов
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-semibold text-[var(--color-brand)] tabular-nums">
                    {selectedPkg.rub.toLocaleString('ru')} ₽
                  </span>
                </div>
              </div>

              {orderErr && (
                <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                  {orderErr}
                </div>
              )}

              <p className="text-sm font-medium text-[var(--color-brand)] opacity-85 mb-4">Выберите способ оплаты</p>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={creatingOrder}
                  onClick={() => handleSelectMethod('sbp')}
                  className="flex items-center gap-4 rounded-3xl border border-[var(--color-brand-light)] bg-[var(--color-brand-light)]/35 hover:border-[var(--color-brand)]/35 hover:bg-[var(--color-brand-light)]/55 hover:shadow-md disabled:opacity-50 px-5 py-4 text-left transition-all active:scale-[0.98] dark:border-white/12 shadow-sm"
                >
                  {creatingOrder && selectedMethod === 'sbp' ? (
                    <Spinner className="w-7 h-7 text-[var(--color-brand)]" />
                  ) : (
                    <img src={SbpLogo} alt="СБП" className="w-10 h-10 shrink-0 object-contain" />
                  )}
                  <div>
                    <p className="font-semibold text-[var(--color-brand)]">СБП</p>
                    <p className="text-xs text-[var(--color-brand)]/65 mt-0.5">Оплата через приложение банка</p>
                  </div>
                  <span className="ml-auto font-semibold text-[var(--color-brand)]">
                    {selectedPkg.rub.toLocaleString('ru')} ₽
                  </span>
                </button>

                <button
                  type="button"
                  disabled={creatingOrder}
                  onClick={() => handleSelectMethod('cryptobot')}
                  className="flex items-center gap-4 rounded-3xl border border-[var(--color-brand-light)] bg-[var(--color-brand-light)]/35 hover:border-[var(--color-brand)]/35 hover:bg-[var(--color-brand-light)]/55 hover:shadow-md disabled:opacity-50 px-5 py-4 text-left transition-all active:scale-[0.98] dark:border-white/12 shadow-sm"
                >
                  {creatingOrder && selectedMethod === 'cryptobot' ? (
                    <Spinner className="w-7 h-7 text-[var(--color-brand)]" />
                  ) : (
                    <img src={CryptoBotLogo} alt="CryptoBot" className="w-10 h-10 shrink-0 object-contain" />
                  )}
                  <div>
                    <p className="font-semibold text-[var(--color-brand)]">CryptoBot</p>
                    <p className="text-xs text-[var(--color-brand)]/65 mt-0.5">USDT, TON, BTC и другие</p>
                  </div>
                  <span className="ml-auto font-semibold text-[var(--color-brand)]">
                    ${selectedPkg.usdt}
                  </span>
                </button>
              </div>
            </>
          )}

          {/* ── Step: paying ── */}
          {step === 'paying' && order && selectedPkg && (
            <>
              {/* Package + method info */}
              <div className="rounded-3xl border border-[var(--color-brand-light)] bg-[var(--color-brand-light)]/40 dark:border-white/12 px-4 py-3.5 mb-5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[var(--color-brand)]">{selectedPkg.credits.toLocaleString('ru')}</span>
                  <CreditCoin className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-brand)]/65">
                    {order.method === 'sbp' ? 'СБП' : 'CryptoBot'}
                  </span>
                  <span className="font-semibold text-[var(--color-brand)]">
                    {order.method === 'sbp'
                      ? `${order.amountRub.toLocaleString('ru')} ₽`
                      : `$${order.amountUsdt}`}
                  </span>
                </div>
              </div>

              {paymentStatus === 'failed' ? (
                <div className="rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-5 py-5 text-center mb-4">
                  <p className="text-2xl mb-2">❌</p>
                  <p className="font-semibold text-red-600 dark:text-red-400">Платёж не прошёл</p>
                  <p className="text-xs text-[var(--color-brand)]/65 mt-1">Попробуйте другой способ оплаты</p>
                  <button
                    type="button"
                    onClick={() => { setPaymentStatus('pending'); setStep('method') }}
                    className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold bg-[var(--color-brand)] text-[var(--color-on-brand)]"
                  >
                    Выбрать способ оплаты
                  </button>
                </div>
              ) : (
                <>
                  {order.payUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const t = Date.now()
                          if (t < payOpenLockUntilRef.current) return
                          payOpenLockUntilRef.current = t + 2200
                          if (order.method === 'cryptobot') openCryptobotCheckout(order)
                          else openCheckoutUrl(pickCheckoutPayUrl(order))
                        }}
                        className="flex items-center justify-center gap-2 w-full rounded-2xl py-5 px-5 text-base font-bold text-[var(--color-on-brand)] bg-[var(--color-brand)] hover:brightness-110 shadow-lg shadow-[var(--color-brand)]/30 transition-all active:scale-[0.98] mb-2"
                      >
                        {order.method === 'cryptobot' ? (
                          <img src={CryptoBotLogo} alt="" className="w-6 h-6 shrink-0 object-contain" />
                        ) : (
                          <img src={SbpLogo} alt="" className="w-6 h-6 shrink-0 object-contain" />
                        )}
                        {order.method === 'cryptobot' ? 'Перейти к оплате Crypto Bot' : 'Перейти к оплате СБП'}
                        <svg viewBox="0 0 24 24" className="w-4 h-4 ml-auto shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <p className="text-xs text-[var(--color-brand)]/60 text-center mb-4 px-2">
                        {order.method === 'cryptobot'
                          ? 'Нажмите кнопку — откроется окно оплаты. Это приложение не закрывайте.'
                          : 'Нажмите кнопку — откроется страница банка. После оплаты вернитесь сюда.'}
                      </p>
                      <button
                        type="button"
                        className="w-full mb-4 text-xs text-[var(--color-brand)]/70 hover:text-[var(--color-brand)] underline underline-offset-2"
                        onClick={async () => {
                          try {
                            const forBrowser =
                              order.method === 'cryptobot'
                                ? (order.payUrlWeb || order.payUrlMini || order.payUrlBot || order.payUrl)
                                : order.payUrl
                            await navigator.clipboard.writeText(forBrowser)
                            setCopiedPayHint(true)
                            window.setTimeout(() => setCopiedPayHint(false), 2500)
                          } catch {
                            setCopiedPayHint(false)
                          }
                        }}
                      >
                        {copiedPayHint
                          ? 'Ссылка скопирована — вставьте в Telegram или в браузер'
                          : order.method === 'cryptobot'
                            ? 'Не открылось? Скопируйте ссылку счёта (t.me или pay.crypt.bot)'
                            : 'Не открылась касса? Скопируйте ссылку СБП'}
                      </button>
                    </>
                  ) : (
                    <p className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-200">
                      Ссылку на оплату не удалось получить. Попробуйте другой способ или напишите в поддержку.
                    </p>
                  )}

                  {/* Waiting indicator */}
                  <div className="flex flex-col items-center gap-2 py-4 border-t border-[var(--color-brand-light)]/40 mt-2">
                    <div className="flex items-center gap-2 text-[var(--color-brand)]/75">
                      <Spinner className="w-4 h-4" />
                      <span className="text-sm font-medium">Ждём подтверждение здесь…</span>
                    </div>
                    <p className="text-xs text-[var(--color-brand)]/55 text-center max-w-[290px]">
                      {order.method === 'cryptobot'
                        ? 'После успешной оплаты счёт можно закрыть — статус здесь обновится сам после ответа сервера (обычно до минуты).'
                        : 'После успешной оплаты можно вернуться в приложение — кредиты зачислятся после подтверждения банком.'}
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Step: success ── */}
          {step === 'success' && order && selectedPkg && (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--color-brand)]">Оплата прошла!</p>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <span className="text-2xl font-bold text-emerald-500">+{selectedPkg.credits.toLocaleString('ru')}</span>
                  <CreditCoin className="w-6 h-6" />
                  <span className="text-slate-500 dark:text-slate-400">кредитов зачислено</span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="mt-2 rounded-2xl px-8 py-3 text-sm font-semibold bg-[var(--color-brand)] text-[var(--color-on-brand)] hover:brightness-110 transition-all active:scale-[0.98]"
              >
                Закрыть
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
