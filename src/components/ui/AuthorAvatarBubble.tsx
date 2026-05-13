import { useCallback, useEffect, useMemo, useState } from 'react'
import { avatarReferrerPolicy, resolveAvatarUrl } from '../../lib/resolveAvatarUrl'

function withRetryBust(url: string, attempt: number): string {
  if (attempt === 0) return url
  const stamp = `av=${attempt}&t=${Date.now()}`
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const u = new URL(url)
      u.searchParams.set('__retry', String(attempt))
      return u.toString()
    }
  } catch {
    /* fall through */
  }
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${stamp}`
}

function initialsFromLabel(name: string) {
  const t = name.trim() || '—'
  if (t.startsWith('@')) {
    return t.length > 1 ? t.charAt(1).toUpperCase() : '—'
  }
  return t.charAt(0).toUpperCase()
}

type Props = {
  /** URL аватара; если пусто — только инициалы */
  src: string | null | undefined
  /** Подпись / имя — для инициалов */
  label: string
  /** Обёртка: размер, скругление */
  className?: string
  /** Доп. класс для <img> */
  imgClassName?: string
  loading?: 'eager' | 'lazy'
  /** React 19 / DOM: ускорить важные превью */
  fetchPriority?: 'high' | 'low' | 'auto'
}

const MAX_RETRIES = 2

/**
 * Круглое превью аватора: внешние ссылки (Telegram, CDN) иногда грузятся не с первого раза —
 * 1–2 повтора с уникальным query, без реферера, с инициалами под картинкой.
 */
export default function AuthorAvatarBubble({
  src,
  label,
  className = 'relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-[9px] font-bold text-slate-600 dark:bg-slate-600 dark:text-slate-200',
  imgClassName = 'absolute inset-0 z-[1] h-full w-full object-cover',
  loading = 'eager',
  fetchPriority = 'high',
}: Props) {
  const [attempt, setAttempt] = useState(0)
  const [givenUp, setGivenUp] = useState(false)

  const base = useMemo(() => (resolveAvatarUrl((src ?? '').trim() || null) ?? '').trim(), [src])
  useEffect(() => {
    setAttempt(0)
    setGivenUp(false)
  }, [base])
  const effectiveSrc = useMemo(() => {
    if (!base || givenUp) return null
    return withRetryBust(base, attempt)
  }, [base, attempt, givenUp])

  const onError = useCallback(() => {
    if (attempt < MAX_RETRIES) {
      setAttempt((a) => a + 1)
    } else {
      setGivenUp(true)
    }
  }, [attempt])

  const showImg = Boolean(effectiveSrc) && !givenUp
  /** Инициалы только без фото: иначе на десктопе (Chrome/Win) flex-слой с буквой часто перекрывал картинку */
  const showInitials = !base || givenUp

  return (
    <span className={`isolate ${className}`}>
      {showImg ? (
        <img
          key={effectiveSrc}
          src={effectiveSrc!}
          alt=""
          referrerPolicy={avatarReferrerPolicy(effectiveSrc ?? undefined)}
          className={imgClassName}
          loading={loading}
          decoding="async"
          fetchPriority={fetchPriority}
          onError={onError}
        />
      ) : null}
      {showInitials ? (
        <span className="relative z-0 flex h-full w-full items-center justify-center" aria-hidden>
          {initialsFromLabel(label)}
        </span>
      ) : null}
    </span>
  )
}
