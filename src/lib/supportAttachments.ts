import { shrinkImageFileToJpegDataUrl } from './shrinkImageForUpload'

/** Полный URL для вложений поддержки (/public/support-media/...) при разнесённом фронте/API */
export function resolveSupportMediaUrl(urlOrPath: string): string {
  const s = String(urlOrPath || '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  const _viteApi = import.meta.env.VITE_API_URL
  const API_BASE =
    typeof _viteApi === 'string' && _viteApi.trim() !== '' ? _viteApi.trim().replace(/\/+$/, '') : ''
  const path = s.startsWith('/') ? s : `/${s}`
  return API_BASE ? `${API_BASE}${path}` : path
}

export interface SupportAttachmentPayload {
  kind: 'image' | 'video'
  mime: string
  base64: string
  name: string
}

export function fileLooksLikeVideo(file: File): boolean {
  const t = (file.type || '').trim().toLowerCase().split(';')[0]
  if (t.startsWith('video/')) return true
  return /\.(mp4|mov|m4v|webm|3gp|3gpp)$/i.test(file.name || '')
}

/** Мобильные/WebView иногда отдают очень маленькие файлы-превью; 512 отрезало часть валидных вложений. */
const SUPPORT_MEDIA_MIN_BYTES = 32
const SUPPORT_MEDIA_MAX_BYTES = 120 * 1024 * 1024

/** Фото/видео для вложения в поддержку (мобильные/WebView: пустой type, octet-stream, имя без расширения). */
export function isAcceptableSupportMediaFile(file: File): boolean {
  const t = (file.type || '').trim().toLowerCase().split(';')[0]
  if (t.startsWith('image/') || t.startsWith('video/')) return true
  const n = (file.name || '').toLowerCase()
  if (/\.(jpe?g|png|gif|webp|heic|heif|avif|mp4|mov|m4v|webm|3gp|3gpp)$/i.test(n)) return true
  const sz = file.size
  if (!Number.isFinite(sz) || sz < SUPPORT_MEDIA_MIN_BYTES || sz > SUPPORT_MEDIA_MAX_BYTES) return false
  if (t === 'application/octet-stream' || t === 'binary/octet-stream' || t === '') return true
  return false
}

/** Бренды ISO BMFF для HEIF/AVIF — не считаем видео (иначе уйдёт в readAsDataURL вместо JPEG). */
const BMFF_STILL_IMAGE_BRANDS = new Set([
  'mif1',
  'msf1',
  'heic',
  'heix',
  'heim',
  'heis',
  'avif',
  'avis',
])

async function sniffFileHeadLooksLikeVideo(file: File): Promise<boolean> {
  try {
    const buf = await file.slice(0, 48).arrayBuffer()
    const u = new Uint8Array(buf)
    if (u.length < 12) return false
    if (u[0] === 0x1a && u[1] === 0x45 && u[2] === 0xdf && u[3] === 0xa3) return true
    if (
      u.length >= 12 &&
      u[0] === 0x52 &&
      u[1] === 0x49 &&
      u[2] === 0x46 &&
      u[3] === 0x46 &&
      u[8] === 0x41 &&
      u[9] === 0x56 &&
      u[10] === 0x49
    )
      return true
    let ftypOff = -1
    if (u.length >= 12 && u[4] === 0x66 && u[5] === 0x74 && u[6] === 0x79 && u[7] === 0x70) ftypOff = 4
    else if (u[0] === 0x66 && u[1] === 0x74 && u[2] === 0x79 && u[3] === 0x70) ftypOff = 0
    if (ftypOff < 0) return false
    const brand = String.fromCharCode(
      u[ftypOff + 8]!,
      u[ftypOff + 9]!,
      u[ftypOff + 10]!,
      u[ftypOff + 11]!,
    ).toLowerCase()
    if (BMFF_STILL_IMAGE_BRANDS.has(brand)) return false
    return true
  } catch {
    return false
  }
}

export async function encodeSupportAttachmentFiles(files: File[]): Promise<SupportAttachmentPayload[]> {
  const out: SupportAttachmentPayload[] = []
  for (const file of files) {
    const kind =
      fileLooksLikeVideo(file) || (await sniffFileHeadLooksLikeVideo(file)) ? ('video' as const) : ('image' as const)
    let base64: string
    let mime: string
    if (kind === 'image') {
      // Конвертируем в JPEG через canvas; при fallback — реальный MIME из data URL (HEIC/AVIF и т.д.)
      const dataUrl = await shrinkImageFileToJpegDataUrl(file, { maxSide: 1600, quality: 0.88 })
      const mimeMatch = /^data:([^;,]+)/i.exec(dataUrl)
      const fromData = mimeMatch?.[1]?.trim().toLowerCase().split(';')[0] ?? 'image/jpeg'
      const comma = dataUrl.indexOf(',')
      base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
      mime = fromData === 'image/jpg' ? 'image/jpeg' : fromData
    } else {
      base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => {
          const s = String(r.result || '')
          const i = s.indexOf(',')
          resolve(i >= 0 ? s.slice(i + 1) : s)
        }
        r.onerror = () => reject(new Error('read failed'))
        r.readAsDataURL(file)
      })
      const t = (file.type || '').trim().toLowerCase().split(';')[0]
      if (t === 'application/octet-stream' || !t) {
        const n = (file.name || '').toLowerCase()
        if (n.endsWith('.mov')) mime = 'video/quicktime'
        else if (n.endsWith('.m4v') || n.endsWith('.mp4')) mime = 'video/mp4'
        else if (n.endsWith('.webm')) mime = 'video/webm'
        else if (n.endsWith('.3gp')) mime = 'video/3gpp'
        else mime = 'video/mp4'
      } else {
        mime = t
      }
    }
    out.push({ kind, mime, base64, name: file.name })
  }
  return out
}
