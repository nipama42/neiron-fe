/** Совпадает с server/src/lib/passwordPolicy.js (EMAIL_PASSWORD_MIN_LEN). */
export const EMAIL_PASSWORD_MIN_LEN = 8

export const EMAIL_PASSWORD_REQUIREMENTS_HINT =
  `${EMAIL_PASSWORD_MIN_LEN}+ символов; латинские буквы a–z и A–Z (минимум по одной).`

/** Проверка для кнопок на клиенте; сервер принимает финальное решение. */
export function isStrongEmailPassword(pw: string): boolean {
  const s = pw ?? ''
  if (s.length < EMAIL_PASSWORD_MIN_LEN) return false
  return /[a-z]/.test(s) && /[A-Z]/.test(s)
}
