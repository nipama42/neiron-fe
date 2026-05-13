export type ContentType = 'photo' | 'video' | 'voice' | 'chat'

export interface Template {
  id: number
  type: ContentType
  model: string
  title: string
  promptTemplate: string
  previewColor: string
  creditCost: number
  isNew?: boolean
}

export interface User {
  id: string
  telegramId: number | null
  tgUsername: string
  tgFirstName: string
  email: string | null
  creditsBalance: number
  shareByDefault: boolean
  referralCode: string
  createdAt: string
  hasCompletedFirstGeneration: boolean
  hasCompletedFirstPurchase: boolean
  purchasesCount: number
}

/** Публичный шаблон автора (лента «Главная») */
export interface UserPublishedTemplate {
  id: number
  type: 'photo' | 'video'
  title: string
  authorUsername: string
  likes: number
  /** Классы Tailwind для placeholder-фона; позже заменим на coverImageUrl */
  coverGradient: string
  coverImageUrl?: string
}
