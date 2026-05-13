/** Сглаживание двойных открытий одной и той же ссылки (двойной клик, Strict Mode, и т.п.). */
const WINDOW_MS = 2500
let lastUrl = ''
let lastAt = 0

export function shouldSkipDuplicateNavigation(url: string, force?: boolean): boolean {
  if (force) return false
  const u = String(url ?? '').trim()
  if (!u) return false
  const now = Date.now()
  if (lastUrl === u && now - lastAt < WINDOW_MS) return true
  lastUrl = u
  lastAt = now
  return false
}
