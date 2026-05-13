type Mode = 'photo' | 'video' | 'music' | 'audio' | string

function modeLabelShort(m: Mode): string {
  switch (m) {
    case 'photo':
      return 'Фото'
    case 'video':
      return 'Видео'
    case 'music':
      return 'Музыка'
    case 'audio':
      return 'Аудио'
    default:
      return 'Генерация'
  }
}

function formatRequestTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function promptExcerpt(text: string | null | undefined, max = 100): string {
  if (!text) return ''
  const one = String(text).replace(/\s+/g, ' ').trim()
  if (one.length <= max) return one
  return `${one.slice(0, max).trimEnd()}…`
}

export default function PendingGenerationNeuralCard({
  mode,
  modelLabel,
  createdAt,
  promptPreview,
}: {
  mode: Mode
  modelLabel: string
  createdAt: string
  promptPreview?: string | null
}) {
  const timeStr = formatRequestTime(createdAt)
  const excerpt = promptExcerpt(promptPreview)

  return (
    <div
      className="relative h-full w-full min-h-0 overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-100 text-slate-800 dark:from-zinc-950 dark:via-neutral-950 dark:to-black dark:text-zinc-100"
      role="img"
      aria-label="Идёт генерация"
    >
      <div
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 45%, rgba(148, 163, 184, 0.12) 0%, transparent 60%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 45%, rgba(255, 255, 255, 0.06) 0%, transparent 60%)',
        }}
      />

      <div className="absolute inset-0 z-0 flex items-center justify-center p-3">
        <div
          className="h-[3.5rem] w-[3.5rem] sm:h-16 sm:w-16"
          role="status"
          aria-label="Загрузка"
        >
          <div
            className="h-full w-full animate-[spin_0.85s_linear_infinite] rounded-full border-[3px] border-slate-200/70 border-t-[var(--color-brand)] border-r-[var(--color-brand)]/40 shadow-sm dark:border-zinc-700/90 dark:border-t-[var(--color-brand)] dark:border-r-[var(--color-brand)]/35 dark:shadow-[0_0_20px_rgba(0,0,0,0.35)]"
          />
        </div>
      </div>

      <div className="absolute left-0 right-0 top-0 z-[1] flex justify-start px-2 pt-1.5 sm:px-2.5 sm:pt-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/60 px-2 py-0.5 text-[8px] font-medium text-slate-600 shadow-sm backdrop-blur-sm dark:border-zinc-600/50 dark:bg-zinc-900/40 dark:text-zinc-300 sm:text-[9px]">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-brand)] opacity-30 dark:opacity-40" />
            <span className="relative m-auto block h-1 w-1 rounded-full bg-[var(--color-brand)]" />
          </span>
          {modeLabelShort(mode)}
        </span>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 z-[1] space-y-0.5 bg-gradient-to-t from-white/[0.98] via-white/85 to-transparent pl-2 pr-1.5 pb-1.5 pt-5 text-left sm:pl-2.5 sm:pr-2 sm:pb-2 sm:pt-6 dark:from-black/[0.95] dark:via-zinc-950/80 dark:to-transparent"
      >
        <p className="line-clamp-2 text-[8px] font-semibold leading-snug text-slate-800 sm:text-[9px] dark:text-zinc-50">
          {modelLabel}
        </p>
        {timeStr ? (
          <p className="text-[7px] font-medium tabular-nums leading-tight text-slate-500 sm:text-[8px] dark:text-zinc-500">
            {timeStr}
          </p>
        ) : null}
        {excerpt ? (
          <p className="line-clamp-2 text-[7px] leading-snug text-slate-600 sm:text-[8px] dark:text-zinc-400">
            {excerpt}
          </p>
        ) : null}
        <p className="pt-0.5 text-[7px] font-semibold text-[var(--color-brand)] sm:text-[8px]">
          <span className="inline-flex animate-pulse">Генерация…</span>
        </p>
      </div>
    </div>
  )
}
