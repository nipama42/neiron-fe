import type { SupportMessage } from './admin'
import type { SupportAttachmentPayload } from '../lib/supportAttachments'

const _viteApi = import.meta.env.VITE_API_URL
const API_BASE =
  typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim() : ''

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  } as const
}

async function supportFailMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text()
  if (!text.trim()) {
    if (res.status === 401) return 'Войдите снова (сессия недействительна)'
    return `${fallback} (HTTP ${res.status})`
  }
  try {
    const j = JSON.parse(text) as { error?: string }
    if (typeof j?.error === 'string' && j.error) return j.error
  } catch {
    /* HTML или не JSON */
  }
  const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 120)
  return snippet ? `${fallback}: ${snippet}` : `${fallback} (HTTP ${res.status})`
}

const supportFetchInit = { cache: 'no-store' as RequestCache }

export async function getMySupportMessages(token: string): Promise<{ messages: SupportMessage[] }> {
  const res = await fetch(`${API_BASE}/me/support/messages`, {
    ...supportFetchInit,
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await supportFailMessage(res, 'Не удалось загрузить поддержку'))
  const data = (await res.json()) as { messages?: unknown }
  const raw = data.messages
  const messages = Array.isArray(raw) ? (raw as SupportMessage[]) : []
  return { messages }
}

export async function postMySupportMessage(
  token: string,
  body: string,
  attachments?: SupportAttachmentPayload[]
): Promise<void> {
  const res = await fetch(`${API_BASE}/me/support/messages`, {
    ...supportFetchInit,
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ body, attachments: attachments ?? [] }),
  })
  if (!res.ok) throw new Error(await supportFailMessage(res, 'Не удалось отправить в поддержку'))
}

export async function postMySupportTyping(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/me/support/typing`, {
    ...supportFetchInit,
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return
}

export async function getMySupportTyping(token: string): Promise<{ adminTyping: boolean }> {
  const res = await fetch(`${API_BASE}/me/support/typing`, {
    ...supportFetchInit,
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return { adminTyping: false }
  const data = (await res.json()) as { adminTyping?: unknown }
  return { adminTyping: data.adminTyping === true }
}
