/** USDT TRC20 / TRON: Base58, 34 символа, начинается с T (как на бэкенде). */
const TRC20_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/

export function isValidTrc20Address(raw: string | null | undefined): boolean {
  const s = String(raw ?? '').trim()
  return TRC20_RE.test(s)
}

export function normalizeTrc20Address(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim()
  return TRC20_RE.test(s) ? s : null
}
