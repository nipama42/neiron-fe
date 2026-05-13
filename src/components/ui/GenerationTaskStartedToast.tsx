import { useEffect, useState } from 'react'
import { useGenerationTaskToast } from '../../lib/generationTaskToast'
import CreditCoin from './CreditCoin'

const shellBase =
  'pointer-events-none fixed inset-x-0 z-[88] flex justify-center px-3'

const transition = (enter: boolean) =>
  `transition-all duration-300 ease-out ${
    enter ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
  }`

/**
 * Плавные уведомления о старте, успехе и ошибке генерации.
 * Рендерится в Layout — видно на всех страницах.
 */
export default function GenerationTaskStartedToast() {
  const t = useGenerationTaskToast()
  const [enter, setEnter] = useState(false)

  useEffect(() => {
    if (!t) {
      setEnter(false)
      return
    }
    setEnter(false)
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEnter(true))
    })
    return () => cancelAnimationFrame(raf)
  }, [t?.id])

  if (!t) return null

  if (t.kind === 'error') {
    return (
      <div
        className={shellBase}
        style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom, 0px))' }}
        role="alert"
        aria-live="assertive"
      >
        <div
          className={`pointer-events-auto w-full max-w-md rounded-2xl border border-red-200/90 bg-red-50/98 px-3.5 py-2.5 text-sm shadow-lg shadow-red-900/10 backdrop-blur-sm dark:border-red-800/50 dark:bg-red-950/95 ${transition(enter)}`}
        >
          <div className="flex items-start gap-2.5">
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-base font-bold text-red-600 shadow-sm ring-1 ring-red-200/80 dark:bg-slate-900/80 dark:text-red-400 dark:ring-red-800/50"
              aria-hidden
            >
              !
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug text-red-950 dark:text-red-50">
                «{t.modelLabel}» — ошибка
              </p>
              <p className="text-xs text-red-800/90 dark:text-red-200/90 break-words">{t.message}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (t.kind === 'success') {
    return (
      <div
        className={shellBase}
        style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom, 0px))' }}
        role="status"
        aria-live="polite"
      >
        <div
          className={`pointer-events-auto w-full max-w-md rounded-2xl border border-emerald-200/90 bg-emerald-50/98 px-3.5 py-2.5 text-sm shadow-lg shadow-emerald-900/10 backdrop-blur-sm dark:border-emerald-800/50 dark:bg-emerald-950/95 ${transition(enter)}`}
        >
          <div className="flex items-start gap-2.5">
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-emerald-200/80 dark:bg-slate-900/80 dark:ring-emerald-700/50"
              aria-hidden
            >
              <CreditCoin className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug text-emerald-950 dark:text-emerald-50">
                «{t.modelLabel}» — готово
              </p>
              <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90 break-words">{t.detail}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={shellBase}
      style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom, 0px))' }}
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto w-full max-w-md rounded-2xl border border-emerald-200/90 bg-emerald-50/98 px-3.5 py-2.5 text-sm shadow-lg shadow-emerald-900/10 backdrop-blur-sm dark:border-emerald-800/50 dark:bg-emerald-950/95 ${transition(enter)}`}
      >
        <div className="flex items-start gap-2.5">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm ring-1 ring-emerald-200/80 dark:bg-slate-900/80 dark:ring-emerald-700/50"
            aria-hidden
          >
            <CreditCoin className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug text-emerald-950 dark:text-emerald-50">
              «{t.modelLabel}» — генерация запущена
            </p>
            <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90">Добавлено в список задач</p>
            <p className="mt-0.5 text-xs font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
              Слоты задач: {t.slotsFilled} из {t.maxSlots}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
