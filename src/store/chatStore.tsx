import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { fetchChats, type Chat } from '../api/chats'
import { useAuth } from './authStore'

/** Совпадает с сервером FREE_DAILY_MSG_LIMIT (до загрузки). */
const DEFAULT_AI_DAILY_LIMIT = 15

interface ChatStoreState {
  chats: Chat[]
  chatsReady: boolean
  /** Ваши сообщения ко всем чатам за сегодня (МСК), суммарно. */
  dailyAiMsgCount: number
  dailyAiMsgLimit: number
  /** Прикреплённые фото за сегодня (МСК), сумма по всем чатам. Для платных — лимит null. */
  dailyAiImageCount: number
  dailyAiImageLimit: number | null
  paidChatModeActive: boolean
  paidChatTextCost: number
  paidChatMediaCost: number
  setDailyAiMsgCount: Dispatch<SetStateAction<number>>
  setDailyAiImageCount: Dispatch<SetStateAction<number>>
  setDailyAiImageLimit: Dispatch<SetStateAction<number | null>>
  setPaidChatModeActive: Dispatch<SetStateAction<boolean>>
  setPaidChatTextCost: Dispatch<SetStateAction<number>>
  setPaidChatMediaCost: Dispatch<SetStateAction<number>>
  setChats: Dispatch<SetStateAction<Chat[]>>
}

const ChatStoreContext = createContext<ChatStoreState>({
  chats: [],
  chatsReady: false,
  dailyAiMsgCount: 0,
  dailyAiMsgLimit: DEFAULT_AI_DAILY_LIMIT,
  dailyAiImageCount: 0,
  dailyAiImageLimit: 2,
  paidChatModeActive: false,
  paidChatTextCost: 1,
  paidChatMediaCost: 4,
  setDailyAiMsgCount: () => {},
  setDailyAiImageCount: () => {},
  setDailyAiImageLimit: () => {},
  setPaidChatModeActive: () => {},
  setPaidChatTextCost: () => {},
  setPaidChatMediaCost: () => {},
  setChats: () => {},
})

export function ChatStoreProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const [chats, setChats] = useState<Chat[]>([])
  const [chatsReady, setChatsReady] = useState(false)
  const [dailyAiMsgCount, setDailyAiMsgCount] = useState(0)
  const [dailyAiMsgLimit, setDailyAiMsgLimit] = useState(DEFAULT_AI_DAILY_LIMIT)
  const [dailyAiImageCount, setDailyAiImageCount] = useState(0)
  const [dailyAiImageLimit, setDailyAiImageLimit] = useState<number | null>(2)
  const [paidChatModeActive, setPaidChatModeActive] = useState(false)
  const [paidChatTextCost, setPaidChatTextCost] = useState(1)
  const [paidChatMediaCost, setPaidChatMediaCost] = useState(4)

  useEffect(() => {
    if (!token || token === 'local-dev') {
      setChats([])
      setDailyAiMsgCount(0)
      setDailyAiMsgLimit(DEFAULT_AI_DAILY_LIMIT)
      setDailyAiImageCount(0)
      setDailyAiImageLimit(2)
      setPaidChatModeActive(false)
      setPaidChatTextCost(1)
      setPaidChatMediaCost(4)
      setChatsReady(true)
      return
    }
    let cancelled = false
    setChatsReady(false)
    fetchChats(token)
      .then((data) => {
        if (cancelled) return
        setChats(data.chats ?? [])
        if (typeof data.dailyCount === 'number') setDailyAiMsgCount(data.dailyCount)
        if (typeof data.dailyLimit === 'number') setDailyAiMsgLimit(data.dailyLimit)
        if (typeof data.dailyImageCount === 'number') setDailyAiImageCount(data.dailyImageCount)
        if (data.dailyImageLimit === null || typeof data.dailyImageLimit === 'number') {
          setDailyAiImageLimit(data.dailyImageLimit)
        } else {
          setDailyAiImageLimit(2)
        }
        setPaidChatModeActive(Boolean(data.paidModeActive))
        if (typeof data.paidTextCost === 'number') setPaidChatTextCost(data.paidTextCost)
        if (typeof data.paidMediaCost === 'number') setPaidChatMediaCost(data.paidMediaCost)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChatsReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <ChatStoreContext.Provider
      value={{
        chats,
        chatsReady,
        dailyAiMsgCount,
        dailyAiMsgLimit,
        dailyAiImageCount,
        dailyAiImageLimit,
        paidChatModeActive,
        paidChatTextCost,
        paidChatMediaCost,
        setDailyAiMsgCount,
        setDailyAiImageCount,
        setDailyAiImageLimit,
        setPaidChatModeActive,
        setPaidChatTextCost,
        setPaidChatMediaCost,
        setChats,
      }}
    >
      {children}
    </ChatStoreContext.Provider>
  )
}

export function useChatStore() {
  return useContext(ChatStoreContext)
}
