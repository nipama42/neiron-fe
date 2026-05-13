import AuthorAvatarBubble from '../ui/AuthorAvatarBubble'
import CreditCoin from '../ui/CreditCoin'
import { qualityUiLabel } from '../../lib/qualityUiLabel'

export default function GenerationDetailStatsDl({
  modelLabel,
  aspect,
  quality,
  modelId,
  mode,
  duration,
  cost,
  publicationRow,
  showSocial,
  authorTag,
  authorName,
  authorAvatarUrl,
  onAuthorClick,
  likes,
  likedByMe,
  likeDisabled,
  likeBusy,
  onLike,
}: {
  modelLabel: string
  aspect?: string | null
  quality?: string | null
  modelId?: string | null
  mode: string
  duration?: string | number | null
  cost?: number | null
  /** Только история «Создать»: статус публикации в профиле */
  publicationRow?: { isPublic: boolean } | null
  showSocial: boolean
  authorTag?: string | null
  authorName?: string | null
  authorAvatarUrl?: string | null
  onAuthorClick?: () => void
  likes: number
  likedByMe: boolean
  likeDisabled?: boolean
  likeBusy?: boolean
  onLike?: () => void
}) {
  const authorLine = String(authorTag ?? authorName ?? '').trim()
  const avatarLabel =
    String(authorName || authorTag || authorLine || '—')
      .trim() || '—'

  return (
    <dl className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-600 dark:bg-slate-800/50">
      {publicationRow ? (
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500 dark:text-slate-400">В профиле</dt>
          <dd className="min-w-0 text-right font-medium text-slate-900 dark:text-slate-100">
            {publicationRow.isPublic ? 'Публично' : 'Не опубликовано'}
          </dd>
        </div>
      ) : null}

      <div className="flex justify-between gap-3">
        <dt className="shrink-0 text-slate-500 dark:text-slate-400">Нейросеть</dt>
        <dd className="min-w-0 text-right font-medium text-slate-900 dark:text-slate-100">{modelLabel || '—'}</dd>
      </div>

      {showSocial && authorLine ? (
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500 dark:text-slate-400">Автор</dt>
          <dd className="min-w-0 text-right font-medium text-slate-900 dark:text-slate-100">
            {typeof onAuthorClick === 'function' ? (
              <button
                type="button"
                onClick={onAuthorClick}
                className="inline-flex max-w-[14rem] items-center gap-2 rounded-full px-1 py-0.5 transition hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <AuthorAvatarBubble src={authorAvatarUrl} label={avatarLabel} />
                <span className="truncate">{authorLine}</span>
              </button>
            ) : (
              <span className="inline-flex max-w-[14rem] items-center justify-end gap-2">
                <AuthorAvatarBubble src={authorAvatarUrl} label={avatarLabel} />
                <span className="truncate">{authorLine}</span>
              </span>
            )}
          </dd>
        </div>
      ) : null}

      {showSocial && typeof onLike === 'function' ? (
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500 dark:text-slate-400">Лайки</dt>
          <dd className="min-w-0 text-right font-medium text-slate-900 dark:text-slate-100">
            <button
              type="button"
              disabled={likeDisabled || likeBusy}
              onClick={() => onLike()}
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-rose-600 dark:text-rose-400 tabular-nums disabled:opacity-60"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
                className={`h-5 w-5 shrink-0 ${likedByMe ? 'text-rose-500 dark:text-rose-400' : 'text-rose-500/85 dark:text-rose-400/85'}`}
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <span>{likes.toLocaleString('ru-RU')}</span>
            </button>
          </dd>
        </div>
      ) : null}

      <div className="flex justify-between gap-3">
        <dt className="shrink-0 text-slate-500 dark:text-slate-400">Формат</dt>
        <dd className="text-right font-medium text-slate-900 dark:text-slate-100 tabular-nums">
          {aspect ? String(aspect).replace(':', '∶') : '—'}
        </dd>
      </div>

      <div className="flex justify-between gap-3">
        <dt className="shrink-0 text-slate-500 dark:text-slate-400">Качество</dt>
        <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
          {qualityUiLabel(quality, modelId)}
        </dd>
      </div>

      {mode === 'video' ? (
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-slate-500 dark:text-slate-400">Длительность</dt>
          <dd className="text-right font-medium text-slate-900 dark:text-slate-100 tabular-nums">
            {duration != null && String(duration).trim() ? `${duration} с` : '—'}
          </dd>
        </div>
      ) : null}

      <div className="flex justify-between gap-3">
        <dt className="shrink-0 text-slate-500 dark:text-slate-400">Стоимость</dt>
        <dd className="text-right font-medium text-slate-900 dark:text-slate-100">
          {typeof cost === 'number' ? (
            <span className="inline-flex items-center justify-end gap-1 tabular-nums">
              <span>−{cost}</span>
              <CreditCoin className="w-3.5 h-3.5" />
            </span>
          ) : (
            '—'
          )}
        </dd>
      </div>
    </dl>
  )
}
