import { useState, useEffect } from 'react'

function safeMatchMedia(query: string): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  try {
    return window.matchMedia(query)
  } catch {
    return null
  }
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => safeMatchMedia(query)?.matches ?? false)
  useEffect(() => {
    const mq = safeMatchMedia(query)
    if (!mq) {
      setMatches(false)
      return
    }
    const handler = () => setMatches(Boolean(mq.matches))
    handler()
    if (typeof mq.addEventListener === 'function') {
      const onChange = () => handler()
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
    if (typeof mq.addListener === 'function') {
      mq.addListener(handler)
      return () => mq.removeListener(handler)
    }
    return
  }, [query])
  return matches
}

/**
 * Десктопная вёрстка только при широком окне и «мышином» профиле ввода.
 * На телефонах иногда viewport ≥1024 или pointer:fine — добавляем hover:none + maxTouchPoints,
 * иначе пропадают нижние табы (остаётся DesktopLayout без TabBar).
 */
export function usePrefersDesktopLayout(): boolean {
  const minWide = useMediaQuery('(min-width: 1024px)')
  const coarsePointer = useMediaQuery('(pointer: coarse)')
  const canHover = useMediaQuery('(hover: hover)')
  const touchCapable =
    typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0

  if (!minWide) return false
  if (coarsePointer) return false
  if (!canHover && touchCapable) return false
  return true
}
