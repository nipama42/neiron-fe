/** Совпадает с сервером MAX_CHAT_FILES_PER_MESSAGE */
export const MAX_CHAT_FILES_PER_MESSAGE = 4
export const ALLOWED_CHAT_FILE_MIME_RE =
  /^(image\/(jpeg|jpg|png|webp|gif)|application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.openxmlformats-officedocument\.presentationml\.presentation)$/i

export type ChatAttachmentPayload = {
  kind: 'image' | 'file'
  dataUrl: string
  mime: string
  name?: string
  /** Только в клиентском стейте (React key); в JSON сообщения не попадает */
  clientKey?: string
}

export function tryParseChatUserContent(content: string): { text: string; attachments: ChatAttachmentPayload[] } | null {
  const t = content.trim()
  if (!t.startsWith('{')) return null
  try {
    const o = JSON.parse(t) as {
      v?: number
      text?: string
      images?: unknown
      attachments?: unknown
    }
    if (o?.v !== 1) return null
    if (Array.isArray(o.attachments)) {
      const attachments = o.attachments
        .map((a) => {
          const item = a as { kind?: unknown; dataUrl?: unknown; mime?: unknown; name?: unknown }
          if (typeof item?.dataUrl !== 'string' || !item.dataUrl) return null
          const kind = item.kind === 'file' ? 'file' : 'image'
          return {
            kind,
            dataUrl: item.dataUrl,
            mime: typeof item.mime === 'string' ? item.mime : '',
            name: typeof item.name === 'string' ? item.name : undefined,
          } as ChatAttachmentPayload
        })
        .filter((x): x is ChatAttachmentPayload => Boolean(x))
      return { text: typeof o.text === 'string' ? o.text : '', attachments }
    }
    // legacy v1: images string[]
    if (Array.isArray(o.images)) {
      const attachments = o.images
        .filter((x): x is string => typeof x === 'string' && x.length > 0)
        .map((url) => ({ kind: 'image' as const, dataUrl: url, mime: 'image/jpeg' }))
      return { text: typeof o.text === 'string' ? o.text : '', attachments }
    }
    return null
  } catch {
    return null
  }
}

/** Сжатие до JPEG data URL для лимита размера и совместимости с OpenAI vision. */
export async function resizeImageFileToJpegDataUrl(
  file: File,
  maxEdge = 1536,
  quality = 0.82
): Promise<string> {
  if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.type)) {
    throw new Error('Поддерживаются только JPEG, PNG, WebP и GIF')
  }
  const bmp = await createImageBitmap(file)
  try {
    const w = bmp.width
    const h = bmp.height
    const scale = Math.min(1, maxEdge / Math.max(w, h))
    const tw = Math.max(1, Math.round(w * scale))
    const th = Math.max(1, Math.round(h * scale))
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Не удалось подготовить изображение')
    ctx.drawImage(bmp, 0, 0, tw, th)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    bmp.close?.()
  }
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('Не удалось прочитать файл'))
    fr.onload = () => {
      const s = typeof fr.result === 'string' ? fr.result : ''
      if (!s.startsWith('data:')) {
        reject(new Error('Не удалось подготовить файл'))
        return
      }
      resolve(s)
    }
    fr.readAsDataURL(file)
  })
}
