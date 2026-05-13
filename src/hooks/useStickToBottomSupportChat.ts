import { useCallback, useEffect, useLayoutEffect, type RefObject } from 'react'

/** Лента поддержки: новые сообщения и поле ввода остаются внизу (клавиатура на телефоне, превью вложений). */
export function useStickToBottomSupportChat(
  scrollRef: RefObject<HTMLDivElement | null>,
  deps: ReadonlyArray<unknown>
) {
  const scrollToEnd = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [scrollRef])

  useLayoutEffect(() => {
    scrollToEnd()
    const id = window.requestAnimationFrame(() => scrollToEnd())
    const id2 = window.requestAnimationFrame(() => scrollToEnd())
    return () => {
      window.cancelAnimationFrame(id)
      window.cancelAnimationFrame(id2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps передаётся снаружи целиком
  }, deps)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const bump = () => scrollToEnd()
    vv.addEventListener('resize', bump)
    vv.addEventListener('scroll', bump)
    return () => {
      vv.removeEventListener('resize', bump)
      vv.removeEventListener('scroll', bump)
    }
  }, [scrollToEnd])

  return scrollToEnd
}
