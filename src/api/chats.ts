const _viteApi = import.meta.env.VITE_API_URL
const API_BASE = typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim() : ''

export interface Chat {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  /** Сколько фото было в этом user-сообщении (сервер). */
  user_image_count?: number
}

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
  return data as T
}

export async function fetchChats(token: string): Promise<{
  chats: Chat[]
  dailyCount?: number
  dailyLimit?: number
  dailyImageCount?: number
  dailyImageLimit?: number | null
  paidModeActive?: boolean
  paidTextCost?: number
  paidMediaCost?: number
}> {
  const res = await fetch(`${API_BASE}/me/chats`, { headers: authHeaders(token) })
  return handleResponse(res)
}

export async function createChat(token: string): Promise<{ chat: Chat }> {
  const res = await fetch(`${API_BASE}/me/chats`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return handleResponse(res)
}

export async function deleteChat(token: string, chatId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/me/chats/${chatId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  await handleResponse(res)
}

export async function renameChat(token: string, chatId: string, title: string): Promise<{ chat: Chat }> {
  const res = await fetch(`${API_BASE}/me/chats/${encodeURIComponent(chatId)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ title }),
  })
  return handleResponse(res)
}

export async function fetchMessages(
  token: string,
  chatId: string
): Promise<{
  messages: ChatMessage[]
  dailyCount: number
  dailyLimit: number
  dailyImageCount: number
  dailyImageLimit: number | null
  paidModeActive?: boolean
  paidTextCost?: number
  paidMediaCost?: number
}> {
  const res = await fetch(`${API_BASE}/me/chats/${chatId}/messages`, {
    headers: authHeaders(token),
  })
  return handleResponse(res)
}

export async function sendMessage(
  token: string,
  chatId: string,
  content: string,
  images?: string[],
  files?: { name: string; mime: string; dataUrl: string }[]
): Promise<{
  userMessage: ChatMessage
  assistantMessage: ChatMessage
  dailyCount: number
  dailyLimit: number
  dailyImageCount: number
  dailyImageLimit: number | null
  paidModeActive?: boolean
  paidTextCost?: number
  paidMediaCost?: number
  chargedCredits?: number
  creditsBalance?: number | null
  newTitle: string | null
}> {
  const body: {
    content: string
    images?: string[]
    files?: { name: string; mime: string; dataUrl: string }[]
  } = { content }
  if (images?.length) body.images = images
  if (files?.length) body.files = files
  const res = await fetch(`${API_BASE}/me/chats/${chatId}/messages`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  })
  return handleResponse(res)
}

export async function enablePaidChatMode(token: string): Promise<{
  ok: boolean
  dailyCount: number
  dailyLimit: number
  dailyImageCount: number
  dailyImageLimit: number | null
  paidModeActive: boolean
  paidTextCost: number
  paidMediaCost: number
}> {
  const res = await fetch(`${API_BASE}/me/chats/paid-mode/enable`, {
    method: 'POST',
    headers: authHeaders(token),
  })
  return handleResponse(res)
}
