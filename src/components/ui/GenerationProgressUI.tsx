import { Link } from 'react-router-dom'
import { useGenerationBannerState } from '../../lib/generationInFlight'
import CreditCoin from './CreditCoin'

type Props = {
  /** Полоса под хедером на всех страницах */
  variant: 'global' | 'embedded'
}

/**
 * Индикатор «идёт генерация»: плавно вращающийся логотип кредита.
 */
export default function GenerationProgressUI({ variant }: Props) {
  const { inFlight, modelLabel, activeSlotCount } = useGenerationBannerState()
  if (!inFlight) return null

  const inner = (
    <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface/95 shadow-sm ring-1 ring-slate-200/90 dark:bg-slate-900/90 dark:ring-slate-600/60"
        aria-hidden
      >
        <CreditCoin className="h-8 w-8 gen-coin-spin-smooth" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--color-brand-dark)] dark:text-[var(--color-brand-dark)]">
          {activeSlotCount > 1 ? `Генерация… (${activeSlotCount})` : 'Генерация…'}
        </p>
        {modelLabel ? (
          <p className="truncate text-xs text-slate-600 dark:text-slate-400">{modelLabel}</p>
        ) : null}
      </div>
      {variant === 'global' ? (
        <Link
          to="/create"
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand)]/10 dark:text-[var(--color-brand)] dark:hover:bg-[var(--color-brand)]/15"
        >
          К созданию
        </Link>
      ) : null}
    </div>
  )

  if (variant === 'global') {
    return (
      <div
        className="shrink-0 w-full border-b border-slate-200/90 bg-[var(--color-brand-light)]/85 dark:border-slate-700/80 dark:bg-slate-900/60"
        role="status"
        aria-live="polite"
        aria-label="Выполняется генерация"
      >
        {inner}
      </div>
    )
  }

  return (
    <div
      className="overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/90 shadow-sm dark:border-slate-600/60 dark:bg-slate-800/50"
      role="status"
      aria-live="polite"
    >
      {inner}
    </div>
  )
}
