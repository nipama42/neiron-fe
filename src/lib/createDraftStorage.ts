/** Черновик «Создать» — переживает переходы по вкладкам (sessionStorage). */

export const CREATE_DRAFT_KEY = 'neiro_create_draft_v1'

export type DraftMediaMode = 'photo' | 'video' | 'audio' | 'music'

export interface StoredAttachment {
  id: string
  name: string
  type: string
  dataUrl: string
}

export interface StoredCreateDraft {
  v: 1
  mode: DraftMediaMode
  modelId: string
  prompt: string
  aspect: string
  quality: string
  duration: string
  publishPublic: boolean
  attachments: StoredAttachment[]
  musicInstrumental?: boolean
  musicVocalGender?: 'm' | 'f'
  musicGenre?: string
  musicTitle?: string
}

export function loadCreateDraft(): StoredCreateDraft | null {
  try {
    const raw = sessionStorage.getItem(CREATE_DRAFT_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as StoredCreateDraft
    if (p?.v !== 1 || typeof p.prompt !== 'string') return null
    if (!Array.isArray(p.attachments)) p.attachments = []
    return p
  } catch {
    return null
  }
}

export function saveCreateDraft(draft: StoredCreateDraft): void {
  try {
    sessionStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify(draft))
  } catch (e) {
    console.warn('[createDraft] sessionStorage save failed', e)
  }
}
