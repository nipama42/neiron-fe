import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { likePublicGeneration, unlikePublicGeneration } from '../api/explore'
import {
  deleteGenerationLogItem,
  getMe,
  getMyGenerationsLogPage,
  patchGenerationPublic,
  postGenerationRecord,
  postGenerationReject,
} from '../api/me'
import type { GenerationLogItem } from '../api/auth'
import { useAuth } from '../store/authStore'
import { useTelegram } from '../hooks/useTelegram'
import { fetchKiePhotoPriceEntries } from '../api/kiePhotoPrices'
import { fetchKieVideoPriceEntries } from '../api/kieVideoPrices'
import { kiePhotoMaxImageInputs } from '../lib/kiePhotoLimits'
import { kieVideoMaxImageInputs } from '../lib/kieVideoLimits'
import { kiePhotoCostCoins, kiePhotoCostFromEntries, type KiePhotoPriceEntry } from '../lib/kiePhotoQuote'
import { kieVideoCostFromEntries, type KieVideoPriceEntry } from '../lib/kieVideoQuote'
import { loadCreateDraft, saveCreateDraft, type StoredCreateDraft } from '../lib/createDraftStorage'
import { fetchDisabledModelIds } from '../api/models'
import {
  beginGenerationAttempt,
  endGenerationAttempt,
  getGenerationBannerState,
  KIE_PARALLEL_MAX,
  useGenerationSlotsFull,
} from '../lib/generationInFlight'
import {
  formatGenerationErrorMessage,
  isClientTransportGenerationError,
  showGenerationTaskToast,
} from '../lib/generationTaskToast'
import CreditCoin from '../components/ui/CreditCoin'
import GenerationDetailStatsDl from '../components/generation/GenerationDetailStatsDl'
import MediaDownloadButton from '../components/ui/MediaDownloadButton'
import MusicCardCover from '../components/ui/MusicCardCover'
import PendingGenerationNeuralCard from '../components/ui/PendingGenerationNeuralCard'
import GenerationPhotoImg from '../components/generation/GenerationPhotoImg'
import {
  generationPhotoOptimizedUrl,
  triggerOptimizedPhotoDownload,
} from '../lib/generationPhoto'

type MediaMode = 'photo' | 'video' | 'audio' | 'music'

type ModelId =
  | 'kie-gpt-image-2'
  | 'kie-wan-27'
  | 'kie-wan-27-pro'
  | 'kie-seedream-45'
  | 'kie-qwen2-image'
  | 'kie-nano-banana-2'
  | 'kie-nano-banana-pro'
  | 'kie-seedream-50-lite'
  | 'kie-flux-2-pro'
  | 'kie-kling-21-std'
  | 'kie-kling-21-pro'
  | 'kie-kling-30'
  | 'kie-grok-imagine-extend'
  | 'kie-wan-27-video'
  | 'kie-openai-sora-2'
  | 'kie-kling-26'
  | 'kie-wan-26-video'
  | 'kie-google-veo-31'
  | 'kie-kling-25-turbo'
  | 'voice-studio'
  | 'sfx-lab'
  | 'kie-suno'

interface MediaRules {
  maxFiles: number
  accept: string
  maxSizeMb: number
  hint: string
}

interface ModelDef {
  id: ModelId
  label: string
  modes: MediaMode[]
  showDuration: boolean
  aspectRatios: string[]
  qualityOptions: { value: string; label: string }[]
  /** Per-model duration options for video; overrides global DURATION_OPTIONS_VIDEO */
  videoDurations?: { value: string; label: string }[]
  media: MediaRules
}

const MODELS: ModelDef[] = [
  {
    id: 'kie-gpt-image-2',
    label: 'GPT Image 2',
    modes: ['photo'],
    showDuration: false,
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9'],
    qualityOptions: [
      { value: 'std', label: '1K' },
      { value: '2k', label: '2K' },
      { value: 'high', label: '4K' },
    ],
    media: {
      maxFiles: kiePhotoMaxImageInputs('kie-gpt-image-2') ?? 8,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Референсы / редактирование, каждое до 15 МБ. Без файлов — только промпт.',
    },
  },
  {
    id: 'kie-wan-27',
    label: 'Wan 2.7 Image',
    modes: ['photo'],
    showDuration: false,
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9'],
    qualityOptions: [
      { value: 'std', label: '1K' },
      { value: 'high', label: '4K' },
    ],
    media: {
      maxFiles: kiePhotoMaxImageInputs('kie-wan-27') ?? 8,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Каждое изображение до 15 МБ',
    },
  },
  {
    id: 'kie-wan-27-pro',
    label: 'Wan 2.7 Image Pro',
    modes: ['photo'],
    showDuration: false,
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9'],
    qualityOptions: [
      { value: 'std', label: '1K' },
      { value: 'high', label: '4K' },
    ],
    media: {
      maxFiles: kiePhotoMaxImageInputs('kie-wan-27-pro') ?? 8,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Каждое изображение до 15 МБ',
    },
  },
  {
    id: 'kie-seedream-45',
    label: 'Seedream 4.5',
    modes: ['photo'],
    showDuration: false,
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9'],
    qualityOptions: [
      { value: '2k', label: '2K' },
      { value: 'high', label: '4K' },
    ],
    media: {
      maxFiles: kiePhotoMaxImageInputs('kie-seedream-45') ?? 8,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Каждое изображение до 15 МБ',
    },
  },
  {
    id: 'kie-qwen2-image',
    label: 'Qwen2 Image',
    modes: ['photo'],
    showDuration: false,
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9'],
    qualityOptions: [
      { value: 'std', label: '1K' },
      { value: 'high', label: '4K' },
    ],
    media: {
      maxFiles: kiePhotoMaxImageInputs('kie-qwen2-image') ?? 8,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Каждое изображение до 15 МБ',
    },
  },
  {
    id: 'kie-nano-banana-2',
    label: 'Google Nano Banana 2',
    modes: ['photo'],
    showDuration: false,
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9'],
    qualityOptions: [
      { value: 'nb2-1k', label: '1K' },
      { value: 'nb2-2k', label: '2K' },
      { value: 'nb2-4k', label: '4K' },
    ],
    media: {
      maxFiles: kiePhotoMaxImageInputs('kie-nano-banana-2') ?? 14,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Каждое изображение до 15 МБ',
    },
  },
  {
    id: 'kie-nano-banana-pro',
    label: 'Google Nano Banana Pro',
    modes: ['photo'],
    showDuration: false,
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9'],
    qualityOptions: [
      { value: 'nbp-12k', label: '2K' },
      { value: 'nbp-4k', label: '4K' },
    ],
    media: {
      maxFiles: kiePhotoMaxImageInputs('kie-nano-banana-pro') ?? 8,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Каждое изображение до 15 МБ',
    },
  },
  {
    id: 'kie-seedream-50-lite',
    label: 'Seedream 5.0 Lite',
    modes: ['photo'],
    showDuration: false,
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9'],
    qualityOptions: [
      { value: 'std', label: '1K' },
      { value: 'high', label: '4K' },
    ],
    media: {
      maxFiles: kiePhotoMaxImageInputs('kie-seedream-50-lite') ?? 8,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Каждое изображение до 15 МБ',
    },
  },
  {
    id: 'kie-flux-2-pro',
    label: 'Flux-2 Pro',
    modes: ['photo'],
    showDuration: false,
    aspectRatios: ['9:16', '3:4', '1:1', '4:3', '16:9', '3:2', '2:3'],
    qualityOptions: [
      { value: 'f2p-1k', label: '1K' },
      { value: 'f2p-2k', label: '2K' },
    ],
    media: {
      maxFiles: kiePhotoMaxImageInputs('kie-flux-2-pro') ?? 8,
      accept: 'image/*',
      maxSizeMb: 10,
      hint: 'Референсы / редактирование, до 8 фото (JPEG/PNG/WEBP), до 10 МБ каждое',
    },
  },
  // ── Kling ──────────────────────────────────────────────────────────────
  {
    id: 'kie-kling-21-std',
    label: 'Kling 2.1 Standard',
    modes: ['video'],
    showDuration: true,
    aspectRatios: ['9:16', '1:1', '16:9'],
    qualityOptions: [{ value: '720p', label: '720p' }],
    videoDurations: [
      { value: '5', label: '5 с' },
      { value: '10', label: '10 с' },
    ],
    media: {
      maxFiles: kieVideoMaxImageInputs('kie-kling-21-std') ?? 1,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Базовая версия Kling 2.1 для быстрых роликов 720p с поддержкой text-to-video и image-to-video.',
    },
  },
  {
    id: 'kie-kling-21-pro',
    label: 'Kling 2.1 Pro',
    modes: ['video'],
    showDuration: true,
    aspectRatios: ['9:16', '1:1', '16:9'],
    qualityOptions: [{ value: '1080p', label: '1080p' }],
    videoDurations: [
      { value: '5', label: '5 с' },
      { value: '10', label: '10 с' },
    ],
    media: {
      maxFiles: kieVideoMaxImageInputs('kie-kling-21-pro') ?? 1,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Версия Kling 2.1 Pro ориентирована на более детализированное видео 1080p и сценарии, где важна визуальная четкость.',
    },
  },
  {
    id: 'kie-kling-30',
    label: 'Kling 3.0',
    modes: ['video'],
    showDuration: true,
    aspectRatios: ['9:16', '1:1', '16:9'],
    qualityOptions: [
      { value: 'std', label: '720p' },
      { value: 'pro', label: '1080p' },
      { value: '4k', label: '4K' },
    ],
    videoDurations: [
      { value: '5', label: '5 с' },
      { value: '10', label: '10 с' },
      { value: '15', label: '15 с' },
    ],
    media: {
      maxFiles: kieVideoMaxImageInputs('kie-kling-30') ?? 1,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Kling 3.0 лучше всего подходит для сценариев с управлением камерой и multi-shot генерацией в одном ролике.',
    },
  },
  {
    id: 'kie-kling-26',
    label: 'Kling 2.6',
    modes: ['video'],
    showDuration: true,
    aspectRatios: ['9:16', '1:1', '16:9'],
    qualityOptions: [{ value: 'std', label: '720p' }],
    videoDurations: [
      { value: '5', label: '5 с' },
      { value: '10', label: '10 с' },
    ],
    media: {
      maxFiles: kieVideoMaxImageInputs('kie-kling-26') ?? 1,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Kling 2.6 используют, когда нужен синхронный аудио-видео результат с голосом и эффектами в одной генерации.',
    },
  },
  {
    id: 'kie-kling-25-turbo',
    label: 'Kling 2.5 Turbo',
    modes: ['video'],
    showDuration: true,
    aspectRatios: ['9:16', '1:1', '16:9'],
    qualityOptions: [{ value: 'std', label: '720p' }],
    videoDurations: [
      { value: '5', label: '5 с' },
      { value: '10', label: '10 с' },
    ],
    media: {
      maxFiles: kieVideoMaxImageInputs('kie-kling-25-turbo') ?? 1,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Kling 2.5 Turbo лучше всего для быстрых итераций: модель сделана как ускоренный вариант для черновых прогонов.',
    },
  },
  // ── Wan ────────────────────────────────────────────────────────────────
  {
    id: 'kie-wan-27-video',
    label: 'Wan 2.7 Video',
    modes: ['video'],
    showDuration: true,
    /** Совпадает с enum `ratio` в docs.kie.ai Wan 2.7 text-to-video. */
    aspectRatios: ['9:16', '1:1', '16:9', '4:3', '3:4'],
    qualityOptions: [
      { value: '720p', label: '720p' },
      { value: '1080p', label: '1080p' },
    ],
    videoDurations: [
      { value: '5', label: '5 с' },
      { value: '10', label: '10 с' },
      { value: '15', label: '15 с' },
    ],
    media: {
      maxFiles: kieVideoMaxImageInputs('kie-wan-27-video') ?? 1,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Wan 2.7 сильна в задачах image-to-video с first/last frame и продолжением клипа до 15 секунд.',
    },
  },
  {
    id: 'kie-wan-26-video',
    label: 'Wan 2.6 Video',
    modes: ['video'],
    showDuration: true,
    /** Wan 2.6 T2V/I2V в KIE OpenAPI не принимают aspect_ratio в input — только prompt/duration/resolution (+ image). */
    aspectRatios: [],
    qualityOptions: [
      { value: '720p', label: '720p' },
      { value: '1080p', label: '1080p' },
    ],
    videoDurations: [
      { value: '5', label: '5 с' },
      { value: '10', label: '10 с' },
      { value: '15', label: '15 с' },
    ],
    media: {
      maxFiles: kieVideoMaxImageInputs('kie-wan-26-video') ?? 1,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Wan 2.6 подходит для длинных роликов до 15 секунд и multi-shot сценариев с image-to-video входом.',
    },
  },
  // ── Google ─────────────────────────────────────────────────────────────
  {
    id: 'kie-google-veo-31',
    label: 'Google Veo 3.1',
    modes: ['video'],
    showDuration: true,
    aspectRatios: ['9:16', '16:9'],
    qualityOptions: [
      { value: '720p', label: '720p' },
      { value: '1080p', label: '1080p' },
    ],
    videoDurations: [{ value: '8', label: '8 с' }],
    media: {
      maxFiles: kieVideoMaxImageInputs('kie-google-veo-31') ?? 1,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Google Veo 3.1 лучше всего для кинематографичных сцен с точным следованием сложному промпту и продвинутой работой со стилем.',
    },
  },
  // ── Grok / xAI ─────────────────────────────────────────────────────────
  {
    id: 'kie-grok-imagine-extend',
    label: 'Grok Imagine',
    modes: ['video'],
    showDuration: true,
    aspectRatios: ['9:16', '1:1', '16:9'],
    qualityOptions: [
      { value: '480p', label: '480p' },
      { value: '720p', label: '720p' },
    ],
    videoDurations: [
      { value: '5', label: '5 с' },
      { value: '10', label: '10 с' },
      { value: '15', label: '15 с' },
    ],
    media: {
      maxFiles: kieVideoMaxImageInputs('kie-grok-imagine-extend') ?? 1,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'Grok Imagine ориентирован на extension-сценарии, когда нужно естественно продолжить уже существующий видеоклип.',
    },
  },
  // ── OpenAI ─────────────────────────────────────────────────────────────
  {
    id: 'kie-openai-sora-2',
    label: 'OpenAI Sora 2',
    modes: ['video'],
    showDuration: true,
    aspectRatios: ['9:16', '1:1', '16:9'],
    qualityOptions: [{ value: 'std', label: 'Стандарт' }],
    videoDurations: [
      { value: '10', label: '10 с' },
      { value: '15', label: '15 с' },
    ],
    media: {
      maxFiles: kieVideoMaxImageInputs('kie-openai-sora-2') ?? 1,
      accept: 'image/*',
      maxSizeMb: 15,
      hint: 'OpenAI Sora 2 обычно выбирают для задач, где важны реалистичная динамика сцены и высокое соответствие текстовому описанию.',
    },
  },
  {
    id: 'voice-studio',
    label: 'Voice Studio',
    modes: ['audio'],
    showDuration: true,
    aspectRatios: [],
    qualityOptions: [
      { value: 'fast', label: 'Быстрый' },
      { value: 'natural', label: 'Естественный' },
    ],
    media: {
      maxFiles: 1,
      accept: 'audio/*',
      maxSizeMb: 25,
      hint: 'Опционально: образец голоса (wav, mp3, m4a), до 25 МБ',
    },
  },
  {
    id: 'sfx-lab',
    label: 'SFX Lab',
    modes: ['audio'],
    showDuration: false,
    aspectRatios: [],
    qualityOptions: [
      { value: 'light', label: 'Лёгкий' },
      { value: 'rich', label: 'Насыщенный' },
    ],
    media: {
      maxFiles: 1,
      accept: 'audio/*',
      maxSizeMb: 20,
      hint: 'До 1 референса звука для стиля, до 20 МБ',
    },
  },
  {
    id: 'kie-suno',
    label: 'Suno',
    modes: ['music'],
    showDuration: false,
    aspectRatios: [],
    qualityOptions: [
      { value: 'V4_5PLUS', label: '4.5+' },
      { value: 'V5', label: 'V5' },
    ],
    media: {
      maxFiles: 0,
      accept: 'audio/*',
      maxSizeMb: 1,
      hint: 'Текст, жанр и версия. Референсы не требуются.',
    },
  },
]

const DURATION_OPTIONS_VIDEO = [
  { value: '5', label: '5 с' },
  { value: '10', label: '10 с' },
]

const MUSIC_GENRES: { value: string; label: string }[] = [
  { value: 'Pop', label: 'Поп' },
  { value: 'Rock', label: 'Рок' },
  { value: 'Hip-Hop', label: 'Хип-хоп' },
  { value: 'Electronic', label: 'Электроника' },
  { value: 'Jazz', label: 'Джаз' },
  { value: 'R&B', label: 'R&B' },
  { value: 'Classical', label: 'Классика' },
  { value: 'Folk', label: 'Фолк' },
  { value: 'Metal', label: 'Метал' },
  { value: 'Country', label: 'Кантри' },
  { value: 'Reggae', label: 'Регги' },
  { value: 'Latin', label: 'Латино' },
]

/** file — только для свежезагруженных; из черновика достаточно dataUrl + type/name */
type AttachedFile = {
  id: string
  file: File | null
  url: string
  name: string
  type: string
  dataUrl?: string
}

function revokeList(list: AttachedFile[]) {
  for (const a of list) {
    if (a.url.startsWith('blob:')) URL.revokeObjectURL(a.url)
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error ?? new Error('read failed'))
    r.readAsDataURL(file)
  })
}

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif|tiff?)$/i

function isImageAttachment(a: AttachedFile): boolean {
  if (a.type.startsWith('image/')) return true
  if (a.dataUrl?.startsWith('data:image/')) return true
  if (IMAGE_EXT_RE.test(a.name)) return true
  return false
}

/** Снимок списка вложений: порядок и id (детект гонки async persist vs смена файлов). */
function attachmentListIdentity(list: AttachedFile[]): string {
  return list.map((a) => `${a.id}:${a.file ? 'f' : a.dataUrl ? 'd' : '0'}`).join('|')
}

function acceptsFile(file: File, accept: string): boolean {
  const parts = accept.split(',').map((s) => s.trim())
  const name = file.name.toLowerCase()
  for (const p of parts) {
    if (p === 'image/*') {
      if (file.type.startsWith('image/')) return true
      if (!file.type && IMAGE_EXT_RE.test(name)) return true
    }
    if (p === 'video/*' && file.type.startsWith('video/')) return true
    if (p === 'audio/*' && file.type.startsWith('audio/')) return true
    if (p.startsWith('.') && name.endsWith(p.toLowerCase())) return true
    if (p.includes('/') && file.type === p) return true
  }
  return false
}

function useLandscape(): boolean {
  const [landscape, setLandscape] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(orientation: landscape)').matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)')
    const onChange = () => setLandscape(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return landscape
}

function useDesktopMediaQuery(): boolean {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = () => setDesktop(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return desktop
}

function aspectParts(ratio: string): [number, number] {
  const [a, b] = ratio.split(':').map((x) => Number(x))
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) return [1, 1]
  return [a, b]
}

function aspectPreviewSize(w: number, h: number, maxPx: number): CSSProperties {
  if (w >= h) {
    const bw = maxPx
    const bh = Math.max(1, Math.round((maxPx * h) / w))
    return { width: bw, height: bh }
  }
  const bh = maxPx
  const bw = Math.max(1, Math.round((maxPx * w) / h))
  return { width: bw, height: bh }
}

function AspectRatioPicker({
  values,
  value,
  onChange,
  landscape,
}: {
  values: string[]
  value: string
  onChange: (v: string) => void
  /** Только плотность сетки; превью всегда в «логических» пропорциях кадра (без поворота). */
  landscape: boolean
}) {
  const previewMax = landscape ? 40 : 44
  const previewMaxCompact = landscape ? 22 : 24
  const gridCols =
    landscape ? 'sm:grid-cols-5' : 'sm:grid-cols-3 lg:grid-cols-5'

  return (
    <div
      className={`flex flex-nowrap gap-1.5 overflow-x-auto p-0.5 w-full [-webkit-overflow-scrolling:touch] sm:grid sm:gap-2 sm:overflow-visible sm:pb-0 ${gridCols}`}
    >
      {values.map((r) => {
        const [w, h] = aspectParts(r)
        const active = value === r
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={`flex shrink-0 flex-row items-center gap-2 rounded-xl px-2 py-2 transition-all border-2 min-w-0 sm:flex-col sm:rounded-2xl sm:px-1.5 sm:py-2.5 sm:w-full sm:gap-0 ${active
              ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 shadow-md shadow-[var(--color-brand)]/15'
              : 'border-transparent bg-slate-50/90 dark:bg-slate-800/50 ring-1 ring-slate-200/90 dark:ring-slate-600/70 hover:border-slate-300 dark:hover:border-slate-500'
              }`}
          >
            <div className="flex items-center justify-center shrink-0 rounded-lg bg-slate-100/90 dark:bg-slate-900/50 w-9 h-9 sm:w-full sm:h-[3.25rem] sm:rounded-xl lg:h-14">
              <div
                className={`rounded-md border-2 bg-transparent shrink-0 sm:hidden ${
                  active
                    ? 'border-[var(--color-brand)]'
                    : 'border-slate-400/85 dark:border-slate-500'
                }`}
                style={aspectPreviewSize(w, h, previewMaxCompact)}
              />
              <div
                className={`rounded-md border-2 bg-transparent shrink-0 hidden sm:block ${
                  active
                    ? 'border-[var(--color-brand)]'
                    : 'border-slate-400/85 dark:border-slate-500'
                }`}
                style={aspectPreviewSize(w, h, previewMax)}
              />
            </div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums sm:mt-1.5">
              {r.replace(':', '∶')}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function formatGenerationDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

const MEDIA_MODE_TAB_ACTIVE =
  'ring-2 ring-[var(--color-media-chrome-ring-strong)] bg-[var(--color-media-chrome-bg-active)] text-[var(--color-brand)] shadow-sm'
const MEDIA_MODE_TAB_IDLE =
  'ring-1 ring-[var(--color-media-chrome-ring)] bg-[var(--color-media-chrome-bg)] text-[var(--color-brand)] opacity-[0.94] hover:opacity-100'

const MODE_TABS: {
  id: MediaMode
  title: string
  caption: string
  activeClass: string
  idleClass: string
  icon: ReactNode
}[] = [
    {
      id: 'photo',
      title: 'Фото',
      caption: 'Картинки',
      activeClass: MEDIA_MODE_TAB_ACTIVE,
      idleClass: MEDIA_MODE_TAB_IDLE,
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.5" fill="currentColor" stroke="none" />
          <path d="M21 15l-4-4-4 4-3-3-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'video',
      title: 'Видео',
      caption: 'Клипы',
      activeClass: MEDIA_MODE_TAB_ACTIVE,
      idleClass: MEDIA_MODE_TAB_IDLE,
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="2" y="6" width="14" height="12" rx="2" />
          <path d="M16 10l6-3v10l-6-3v-4z" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      id: 'music',
      title: 'Песни',
      caption: 'Музыка',
      activeClass: MEDIA_MODE_TAB_ACTIVE,
      idleClass: MEDIA_MODE_TAB_IDLE,
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M9 18V5l12-2v13" strokeLinecap="round" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      ),
    },
  ]

function promptPlaceholder(mode: MediaMode): string {
  switch (mode) {
    case 'photo':
      return 'Опишите изображение: стиль, сцена, детали…'
    case 'video':
      return 'Опишите видео: действие, камера, настроение…'
    case 'audio':
      return 'Опишите звук: голос, эффект, атмосфера…'
    case 'music':
      return 'Опишите трек: жанр, темп, настроение, инструменты…'
    default:
      return 'Что хотите создать?'
  }
}

function initialAttachedFromDraft(d: StoredCreateDraft | null): AttachedFile[] {
  if (!d?.attachments?.length) return []
  return d.attachments.map((x) => ({
    id: x.id,
    file: null,
    url: x.dataUrl,
    name: x.name,
    type: x.type,
    dataUrl: x.dataUrl,
  }))
}

function initialCreateFields() {
  const d = loadCreateDraft()
  const modes: MediaMode[] = ['photo', 'video', 'audio', 'music']
  let mode: MediaMode = d?.mode && modes.includes(d.mode) ? d.mode : 'photo'
  if (mode === 'audio') mode = 'photo'
  const rawModel = d?.modelId ?? 'kie-gpt-image-2'
  const modelId =
    rawModel === 'melody-flow' || rawModel === 'verse-pro' ? 'kie-suno' : rawModel
  const defaultGenre =
    d?.musicGenre && MUSIC_GENRES.some((g) => g.value === d.musicGenre)
      ? d.musicGenre
      : MUSIC_GENRES[0]!.value
  const mDef = MODELS.find((m) => m.id === modelId)
  let q = d?.quality ?? 'std'
  if (modelId === 'kie-suno' && mDef?.qualityOptions?.length) {
    const allowed = new Set(mDef.qualityOptions.map((o) => o.value))
    const u = String(q).toUpperCase().replace(/-/g, '_')
    q = allowed.has(u) ? u : mDef.qualityOptions[0]!.value
  }
  return {
    mode,
    modelId,
    prompt: d?.prompt ?? '',
    aspect: d?.aspect ?? '1:1',
    quality: q,
    duration: d?.duration ?? '5',
    publishPublic: d?.publishPublic ?? false,
    attached: initialAttachedFromDraft(d),
    musicInstrumental: Boolean(d?.musicInstrumental),
    musicVocalGender: (d?.musicVocalGender === 'f' ? 'f' : 'm') as 'm' | 'f',
    musicGenre: defaultGenre,
    musicTitle: d?.musicTitle ?? '',
  }
}

function getGenerationResultUrl(item: GenerationLogItem | null | undefined): string {
  if (!item) return ''
  const candidates = [item.resultDisplayUrl, item.resultMainUrl, item.resultUrl]
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

export default function CreatePage() {
  const { token, user, mergeUser } = useAuth()
  const isApi = Boolean(token && token !== 'local-dev')
  const HISTORY_PAGE_SIZE = 16
  const HISTORY_REQUEST_MIN_GAP_MS = 800
  const [historyFeedItems, setHistoryFeedItems] = useState<GenerationLogItem[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyFeedLoading, setHistoryFeedLoading] = useState(false)
  const [historyFeedBusyMore, setHistoryFeedBusyMore] = useState(false)
  const historyRequestTsRef = useRef(0)
  const historyLoadedCountRef = useRef(0)
  /** Не класть user.generationsLog в deps loadHistoryPage — mergeUser даёт новый массив при каждом getMe и ломает список. */
  const generationsLogRef = useRef<GenerationLogItem[]>([])
  const canShowMoreHistory = historyFeedItems.length < historyTotal
  const { ready, platform } = useTelegram()
  const ic = useMemo(() => initialCreateFields(), [])
  const [mode, setMode] = useState<MediaMode>(ic.mode)
  const [modelId, setModelId] = useState<string>(ic.modelId)
  const [prompt, setPrompt] = useState(ic.prompt)
  const [aspect, setAspect] = useState(ic.aspect)
  const [quality, setQuality] = useState(ic.quality)
  const [duration, setDuration] = useState(ic.duration)
  const [attached, setAttached] = useState<AttachedFile[]>(ic.attached)
  /** Сброс нативного file input (WebView часто кэширует выбор по одному и тому же инстансу). */
  const [mediaAttachEpoch, setMediaAttachEpoch] = useState(0)
  const [modelSheetOpen, setModelSheetOpen] = useState(false)
  const [sheetMounted, setSheetMounted] = useState(false)
  const [sheetVisible, setSheetVisible] = useState(false)
  const [mediaDrag, setMediaDrag] = useState(false)
  const [publishPublic, setPublishPublic] = useState(ic.publishPublic)
  const [musicInstrumental, setMusicInstrumental] = useState(ic.musicInstrumental)
  const [musicVocalGender, setMusicVocalGender] = useState<'m' | 'f'>(ic.musicVocalGender)
  const [musicGenre, setMusicGenre] = useState(ic.musicGenre)
  const [musicTitle, setMusicTitle] = useState(ic.musicTitle)
  const [saveHint, setSaveHint] = useState<string | null>(null)
  /** Все 3 слота Kie заняты — блокируем промпт и медиа */
  const slotsFull = useGenerationSlotsFull()
  const [errorToast, setErrorToast] = useState<string | null>(null)
  /** data URL только что сгенерированного кадра (не кладём в sessionStorage) */
  const [inlinePreviewById, setInlinePreviewById] = useState<Record<string, string>>({})
  /** Открытая карточка «Недавние генерации» (полноэкранный просмотр) */
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [historyCopied, setHistoryCopied] = useState(false)
  const [historyActionBusy, setHistoryActionBusy] = useState(false)
  const [historyLikeBusy, setHistoryLikeBusy] = useState(false)
  const [kiePhotoPriceEntries, setKiePhotoPriceEntries] = useState<KiePhotoPriceEntry[] | null>(null)
  const [kieVideoPriceEntries, setKieVideoPriceEntries] = useState<KieVideoPriceEntry[] | null>(null)
  /** ID из БД с is_active=false — убрать из списка на «Создать». При ошибке API — пустой Set (показываем все). */
  const [disabledModelIds, setDisabledModelIds] = useState<Set<string>>(() => new Set())
  const landscape = useLandscape()
  const desktop = useDesktopMediaQuery()
  const attachedRef = useRef<AttachedFile[]>(ic.attached)
  const pickFilesInputRef = useRef<HTMLInputElement>(null)
  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const compressedAutoDownloadGenIdsRef = useRef(new Set<string>())
  const modelPickerRef = useRef<HTMLDivElement>(null)
  /** Связка label+id надёжнее ref.click() в TG WebView / iOS при повторном выборе после удаления */
  const filePickInputId = useId()

  const queueAutoDownloadCompressedPhoto = useCallback((g: GenerationLogItem, gid: string) => {
    const compressed = generationPhotoOptimizedUrl(g)
    if (!compressed || compressedAutoDownloadGenIdsRef.current.has(gid)) return
    compressedAutoDownloadGenIdsRef.current.add(gid)
    void triggerOptimizedPhotoDownload(compressed, gid)
  }, [])

  useEffect(() => {
    ready()
    // expand() только в initTelegramMiniAppViewport — повтор при входе на страницу в TG даёт «вспышку»/затемнение.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const entries = await fetchKieVideoPriceEntries()
      if (!cancelled) setKieVideoPriceEntries(entries)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const ids = await fetchDisabledModelIds()
        if (cancelled) return
        setDisabledModelIds(new Set(ids))
      } catch {
        if (!cancelled) setDisabledModelIds(new Set())
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!errorToast) return
    const t = window.setTimeout(() => setErrorToast(null), 5200)
    return () => window.clearTimeout(t)
  }, [errorToast])

  useEffect(() => {
    generationsLogRef.current = user?.generationsLog ?? []
  }, [user?.generationsLog])

  const generationStatusByIdRef = useRef<Map<string, string | null>>(new Map())

  /** Тост при смене pending → failed; карточки failed в UI не показываем. */
  useEffect(() => {
    const log = user?.generationsLog ?? []
    const prev = generationStatusByIdRef.current
    for (const g of log) {
      if (g.generationStatus !== 'failed') continue
      if (prev.get(g.id) === 'pending') {
        showGenerationTaskToast({
          kind: 'error',
          modelLabel: g.modelLabel,
          message: formatGenerationErrorMessage(g.generationError),
        })
      }
    }
    const next = new Map<string, string | null>()
    for (const g of log) next.set(g.id, g.generationStatus ?? null)
    generationStatusByIdRef.current = next
  }, [user?.generationsLog])

  /** Пока в журнале есть pending — подтягиваем статусы (после F5 тоже). */
  useEffect(() => {
    if (!token || token === 'local-dev') return
    const log = user?.generationsLog ?? []
    if (!log.some((g) => g.generationStatus === 'pending')) return
    const id = window.setInterval(() => {
      getMe(token)
        .then((r) => mergeUser(r.user))
        .catch(() => { })
    }, 4000)
    return () => window.clearInterval(id)
  }, [token, mergeUser, user?.generationsLog])

  /** Синхронизируем карточки истории с актуальными данными из /me (тот же id, но новый статус/URL). */
  useEffect(() => {
    const log = user?.generationsLog ?? []
    if (!log.length) return
    const byId = new Map(log.map((g) => [g.id, g] as const))
    setHistoryFeedItems((prev) => {
      let changed = false
      const merged = prev.map((item) => {
        const fresh = byId.get(item.id)
        if (!fresh) return item
        const merged: GenerationLogItem = { ...item, ...fresh }
        if (
          item.generationStatus !== merged.generationStatus ||
          item.generationError !== merged.generationError ||
          item.resultUrl !== merged.resultUrl ||
          item.resultDisplayUrl !== merged.resultDisplayUrl ||
          item.resultMainUrl !== merged.resultMainUrl
        ) {
          changed = true
        }
        return merged
      })
      const next = merged.filter((item) => item.generationStatus !== 'failed')
      if (next.length !== merged.length) changed = true
      return changed ? next : prev
    })
  }, [user?.generationsLog])

  useEffect(() => {
    const failedIds = new Set(
      (user?.generationsLog ?? [])
        .filter((g) => g.generationStatus === 'failed')
        .map((g) => g.id)
    )
    if (!failedIds.size) return
    setInlinePreviewById((prev) => {
      let changed = false
      const next: Record<string, string> = {}
      for (const [id, url] of Object.entries(prev)) {
        if (failedIds.has(id)) {
          changed = true
          continue
        }
        next[id] = url
      }
      return changed ? next : prev
    })
  }, [user?.generationsLog])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const entries = await fetchKiePhotoPriceEntries()
      if (!cancelled && entries.length) setKiePhotoPriceEntries(entries)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user) return
    if (loadCreateDraft()) return
    setPublishPublic(Boolean(user.shareByDefault))
  }, [user?.id, user?.shareByDefault])

  useEffect(() => {
    if (desktop) {
      setSheetVisible(false)
      setSheetMounted(false)
      return
    }
    if (!modelSheetOpen) {
      setSheetVisible(false)
      const t = window.setTimeout(() => setSheetMounted(false), 320)
      return () => window.clearTimeout(t)
    }
    setSheetMounted(true)
    setSheetVisible(false)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSheetVisible(true))
    })
    return () => cancelAnimationFrame(id)
  }, [modelSheetOpen, desktop])

  useEffect(() => {
    if (!desktop || !modelSheetOpen) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target
      if (!(target instanceof Node)) return
      if (!modelPickerRef.current?.contains(target)) {
        setModelSheetOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModelSheetOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [desktop, modelSheetOpen])

  const modelsForMode = useMemo(() => {
    let list = MODELS.filter((m) => m.modes.includes(mode))
    list = list.filter((m) => !disabledModelIds.has(m.id))
    if (mode !== 'photo') return list
    const photoPriority: Record<string, number> = {
      'kie-nano-banana-2': 0,
      'kie-nano-banana-pro': 1,
      'kie-gpt-image-2': 2,
      'kie-flux-2-pro': 3,
    }
    return [...list].sort((a, b) => {
      const pa = photoPriority[a.id] ?? 1000
      const pb = photoPriority[b.id] ?? 1000
      if (pa !== pb) return pa - pb
      return 0
    })
  }, [mode, disabledModelIds])

  const model = useMemo(
    () => MODELS.find((m) => m.id === modelId) ?? modelsForMode[0] ?? MODELS[0],
    [modelId, modelsForMode]
  )

  useEffect(() => {
    if (!modelsForMode.some((m) => m.id === modelId)) {
      const fallback = modelsForMode[0]?.id
      if (fallback) setModelId(fallback)
    }
  }, [mode, modelsForMode, modelId])

  useEffect(() => {
    if (model.aspectRatios.length && !model.aspectRatios.includes(aspect)) {
      setAspect(model.aspectRatios[0])
    }
  }, [model, aspect])

  useEffect(() => {
    if (model.qualityOptions.length) {
      const first = model.qualityOptions[0].value
      if (!model.qualityOptions.some((q) => q.value === quality)) {
        setQuality(first)
      }
    }
  }, [model, quality])

  const durationOptions = useMemo(() => {
    if (mode !== 'video' || !model.showDuration) return []
    return model.videoDurations ?? DURATION_OPTIONS_VIDEO
  }, [mode, model.showDuration, model.videoDurations])

  useEffect(() => {
    if (!durationOptions.length) return
    if (!durationOptions.some((d) => d.value === duration)) {
      setDuration(durationOptions[0].value)
    }
  }, [durationOptions, duration])

  const historyItem = useMemo(() => {
    if (!historyId) return null
    const fromFeed = historyFeedItems.find((g) => g.id === historyId)
    const fromUser = (user?.generationsLog ?? []).find((g) => g.id === historyId)
    if (fromFeed && fromUser) return { ...fromFeed, ...fromUser }
    return fromFeed ?? fromUser ?? null
  }, [historyFeedItems, user?.generationsLog, historyId])

  useEffect(() => {
    if (!historyId) return
    const g =
      historyFeedItems.find((x) => x.id === historyId) ??
      (user?.generationsLog ?? []).find((x) => x.id === historyId)
    if (!g || g.generationStatus === 'failed') setHistoryId(null)
  }, [historyFeedItems, user?.generationsLog, historyId])

  useEffect(() => {
    historyLoadedCountRef.current = historyFeedItems.length
  }, [historyFeedItems.length])

  const loadHistoryPage = useCallback(
    async (opts?: { reset?: boolean; count?: number }) => {
      if (!token || !isApi) {
        const local = (generationsLogRef.current ?? []).filter((g) => g.generationStatus !== 'failed')
        const nextCount = opts?.count ?? HISTORY_PAGE_SIZE
        setHistoryFeedItems(local.slice(0, nextCount))
        setHistoryTotal(local.length)
        historyLoadedCountRef.current = Math.min(local.length, nextCount)
        return
      }
      const reset = Boolean(opts?.reset)
      const count = Math.max(HISTORY_PAGE_SIZE, opts?.count ?? HISTORY_PAGE_SIZE)
      const now = Date.now()
      if (!reset && now - historyRequestTsRef.current < HISTORY_REQUEST_MIN_GAP_MS) return
      historyRequestTsRef.current = now
      const offset = reset ? 0 : historyLoadedCountRef.current
      if (reset) setHistoryFeedLoading(true)
      else setHistoryFeedBusyMore(true)
      try {
        const page = await getMyGenerationsLogPage(token, {
          limit: count,
          offset,
        })
        if (reset) {
          setHistoryFeedItems(page.items)
          historyLoadedCountRef.current = page.items.length
        } else {
          setHistoryFeedItems((prev) => {
            const seen = new Set(prev.map((x) => x.id))
            const unique = page.items.filter((x) => !seen.has(x.id))
            const merged = unique.length ? [...prev, ...unique] : prev
            historyLoadedCountRef.current = merged.length
            return merged
          })
        }
        setHistoryTotal(page.total)
      } catch {
        if (reset) {
          const local = (generationsLogRef.current ?? []).filter((g) => g.generationStatus !== 'failed')
          setHistoryFeedItems(local.slice(0, count))
          setHistoryTotal(local.length)
          historyLoadedCountRef.current = Math.min(local.length, count)
        }
      } finally {
        if (reset) setHistoryFeedLoading(false)
        else setHistoryFeedBusyMore(false)
      }
    },
    [token, isApi, HISTORY_PAGE_SIZE]
  )

  useEffect(() => {
    void loadHistoryPage({ reset: true, count: HISTORY_PAGE_SIZE })
  }, [loadHistoryPage, HISTORY_PAGE_SIZE, user?.id])

  useEffect(() => {
    if (!user?.generationsLog?.length) return
    void loadHistoryPage({ reset: true, count: HISTORY_PAGE_SIZE })
  }, [user?.generationsLog?.[0]?.id, loadHistoryPage, HISTORY_PAGE_SIZE])

  useEffect(() => {
    setHistoryCopied(false)
  }, [historyId])

  useEffect(() => {
    setHistoryActionBusy(false)
  }, [historyId])

  useEffect(() => {
    if (!historyId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHistoryId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [historyId])

  useEffect(() => {
    if (!historyId) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [historyId])

  const copyHistoryPrompt = useCallback(async () => {
    if (!historyItem) return
    const t = (historyItem.prompt?.trim() || historyItem.promptPreview || '').trim()
    if (!t) return
    try {
      await navigator.clipboard.writeText(t)
      setHistoryCopied(true)
      window.setTimeout(() => setHistoryCopied(false), 2000)
    } catch {
      setSaveHint('Не удалось скопировать')
      window.setTimeout(() => setSaveHint(null), 2500)
    }
  }, [historyItem])

  const toggleHistoryPublic = useCallback(async () => {
    if (!token || !historyItem || historyActionBusy) return
    setHistoryActionBusy(true)
    try {
      const r = await patchGenerationPublic(token, historyItem.id, !historyItem.inPublicFeed)
      mergeUser(r.user)
      const fresh = r.user.generationsLog?.find((g) => g.id === historyItem.id)
      setHistoryFeedItems((prev) => {
        const i = prev.findIndex((g) => g.id === historyItem.id)
        if (i === -1) return prev
        const next = [...prev]
        next[i] = fresh ? { ...next[i], ...fresh } : { ...next[i], inPublicFeed: !historyItem.inPublicFeed }
        return next
      })
      setSaveHint(
        historyItem.inPublicFeed
          ? 'Работа снята с публикации в профиле.'
          : 'Работа опубликована в профиле.'
      )
      window.setTimeout(() => setSaveHint(null), 2500)
    } catch (e) {
      setErrorToast(e instanceof Error ? e.message : 'Не удалось изменить публикацию')
    } finally {
      setHistoryActionBusy(false)
    }
  }, [token, historyItem, historyActionBusy, mergeUser])

  const removeHistoryGeneration = useCallback(async () => {
    if (!token || !historyItem || historyActionBusy) return
    setHistoryActionBusy(true)
    const removedId = historyItem.id
    try {
      const r = await deleteGenerationLogItem(token, historyItem.id)
      setHistoryFeedItems((prev) => prev.filter((g) => g.id !== removedId))
      setInlinePreviewById((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, removedId)) return prev
        const next = { ...prev }
        delete next[removedId]
        return next
      })
      setHistoryTotal((prev) => Math.max(0, prev - 1))
      mergeUser(r.user)
      setHistoryId(null)
      setSaveHint('Генерация удалена из истории.')
      window.setTimeout(() => setSaveHint(null), 2500)
    } catch (e) {
      setErrorToast(e instanceof Error ? e.message : 'Не удалось удалить генерацию')
    } finally {
      setHistoryActionBusy(false)
    }
  }, [token, historyItem, historyActionBusy, mergeUser])

  const toggleHistoryLike = useCallback(async () => {
    if (!token || !isApi || !historyItem?.inPublicFeed || historyLikeBusy) return
    const id = historyItem.id
    const prevIds = user?.likedPublicGenerationIds ?? []
    const liked = prevIds.includes(id)
    const optimisticIds = liked ? prevIds.filter((x) => x !== id) : [...prevIds, id]
    const prevLikes = Number(historyItem.likes ?? 0)
    const optimisticLikes = liked ? Math.max(0, prevLikes - 1) : prevLikes + 1

    mergeUser({ likedPublicGenerationIds: optimisticIds })
    setHistoryFeedItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, likes: optimisticLikes } : x))
    )
    setHistoryLikeBusy(true)
    try {
      const r = liked ? await unlikePublicGeneration(token, id) : await likePublicGeneration(token, id)
      mergeUser(r.user)
    } catch (e) {
      mergeUser({ likedPublicGenerationIds: prevIds })
      setHistoryFeedItems((prev) =>
        prev.map((x) => (x.id === id ? { ...x, likes: prevLikes } : x))
      )
      setErrorToast(e instanceof Error ? e.message : 'Не удалось изменить лайк')
    } finally {
      setHistoryLikeBusy(false)
    }
  }, [
    token,
    isApi,
    historyItem,
    historyLikeBusy,
    user?.likedPublicGenerationIds,
    mergeUser,
  ])

  useEffect(() => {
    const rules = model.media
    const modelLabel = model.label
    let removed = 0
    setAttached((prev) => {
      const maxBytes = rules.maxSizeMb * 1024 * 1024
      const filtered = prev.filter((a) => {
        if (a.dataUrl && a.dataUrl.startsWith('data:image/')) {
          const mime = a.type && a.type.startsWith('image/') ? a.type : 'image/png'
          const pseudo = new File([], a.name || 'image.png', { type: mime })
          if (acceptsFile(pseudo, rules.accept)) return true
          if (IMAGE_EXT_RE.test(a.name || '')) return true
        }
        if (a.file && acceptsFile(a.file, rules.accept) && a.file.size <= maxBytes) return true
        return false
      })
      const trimmed = filtered.slice(0, rules.maxFiles)
      removed = prev.length - trimmed.length
      prev
        .filter((p) => !trimmed.some((t) => t.id === p.id))
        .forEach((a) => {
          if (a.url.startsWith('blob:')) URL.revokeObjectURL(a.url)
        })
      attachedRef.current = trimmed
      return trimmed
    })
    if (removed > 0) {
      setMediaAttachEpoch((e) => e + 1)
      const t1 = window.setTimeout(() => {
        setSaveHint(`У «${modelLabel}» не больше ${rules.maxFiles} фото — лишние убраны из списка.`)
      }, 0)
      const t2 = window.setTimeout(() => setSaveHint(null), 5200)
      return () => {
        window.clearTimeout(t1)
        window.clearTimeout(t2)
      }
    }
  }, [model.id, model.label, model.media.maxFiles, model.media.accept, model.media.maxSizeMb])

  const persistDraftImmediate = useCallback(async () => {
    try {
      const snap = attachedRef.current
      if (snap.length === 0) {
        saveCreateDraft({
          v: 1,
          mode,
          modelId,
          prompt: prompt.trim(),
          aspect,
          quality,
          duration,
          publishPublic,
          attachments: [],
          musicInstrumental,
          musicVocalGender,
          musicGenre,
          musicTitle: musicTitle.trim(),
        })
        return
      }
      const idKey = attachmentListIdentity(snap)
      const attachments = await Promise.all(
        snap.map(async (a) => {
          if (a.file) {
            const dataUrl = await readFileAsDataUrl(a.file)
            return { id: a.id, name: a.file.name, type: a.file.type, dataUrl }
          }
          if (a.dataUrl) {
            return { id: a.id, name: a.name, type: a.type, dataUrl: a.dataUrl }
          }
          return null
        })
      )
      if (attachmentListIdentity(attachedRef.current) !== idKey) return
      const ok = attachments.filter(Boolean) as StoredCreateDraft['attachments']
      saveCreateDraft({
        v: 1,
        mode,
        modelId,
        prompt: prompt.trim(),
        aspect,
        quality,
        duration,
        publishPublic,
        attachments: ok,
        musicInstrumental,
        musicVocalGender,
        musicGenre,
        musicTitle: musicTitle.trim(),
      })
    } catch {
      /* ignore */
    }
  }, [
    mode,
    modelId,
    prompt,
    aspect,
    quality,
    duration,
    publishPublic,
    musicInstrumental,
    musicVocalGender,
    musicGenre,
    musicTitle,
  ])

  useEffect(() => {
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return
        await persistDraftImmediate()
      })()
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [attached, persistDraftImmediate])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        void persistDraftImmediate()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [persistDraftImmediate])

  useEffect(() => {
    attachedRef.current = attached
  }, [attached])

  useEffect(() => {
    return () => revokeList(attachedRef.current)
  }, [])

  /** В TG WebView «невидимый» input + длинный accept часто не открывает галерею — для фото достаточно image/* */
  const fileAcceptAttr = useMemo(() => {
    if (mode === 'photo') return 'image/*'
    return model.media.accept
  }, [mode, model.media.accept])

  /**
   * Фото-референсы: multiple нужен, чтобы выбрать сразу несколько снимков (иначе часто упираются в 1–2 файла).
   * Для видео/аудио в TG WebView по-прежнему отключаем multiple — там диалог с длинным accept ломается.
   */
  const fileAllowMultiple = useMemo(() => {
    if (model.media.maxFiles <= 1) return false
    if (mode === 'photo' && model.media.accept.includes('image')) return true
    const p = platform.toLowerCase()
    if (p === 'ios' || p === 'android' || p === 'android_x') return false
    return true
  }, [mode, model.media.maxFiles, model.media.accept, platform])

  const showAspect = model.aspectRatios.length > 0
  const showQuality = model.qualityOptions.length > 0
  const showDurationBlock = durationOptions.length > 0
  /** Резервная панель (например голос): без длительности — только для не фото/видео/музыки */
  const showSecondarySettings =
    (showAspect || showQuality) && mode !== 'video' && mode !== 'photo' && mode !== 'music'

  const kiePhotoCost = useMemo(() => {
    if (mode === 'music' && modelId === 'kie-suno') {
      const q = showQuality ? quality : 'V4_5'
      const fromApi = kiePhotoCostFromEntries(kiePhotoPriceEntries ?? undefined, modelId, q)
      if (fromApi != null) return fromApi
      return kiePhotoCostCoins(modelId, q)
    }
    if (mode !== 'photo' || !modelId.startsWith('kie-')) return null
    const q = showQuality ? quality : 'std'
    const fromApi = kiePhotoCostFromEntries(kiePhotoPriceEntries ?? undefined, modelId, q)
    if (fromApi != null) return fromApi
    return kiePhotoCostCoins(modelId, q)
  }, [mode, modelId, quality, showQuality, kiePhotoPriceEntries])

  const kieVideoCost = useMemo(() => {
    if (mode !== 'video' || !modelId.startsWith('kie-')) return null
    const q = showQuality ? quality : '720p'
    const d = showDurationBlock ? duration : '5'
    return kieVideoCostFromEntries(kieVideoPriceEntries ?? undefined, modelId, q, d)
  }, [mode, modelId, quality, duration, showQuality, showDurationBlock, kieVideoPriceEntries])

  const isKieVideoPriceReady = useMemo(() => {
    if (!(mode === 'video' && modelId.startsWith('kie-'))) return true
    return typeof kieVideoCost === 'number' && Number.isFinite(kieVideoCost) && kieVideoCost >= 0
  }, [mode, modelId, kieVideoCost])

  const isKieMusicPriceReady = useMemo(() => {
    if (!(mode === 'music' && modelId === 'kie-suno')) return true
    return typeof kiePhotoCost === 'number' && Number.isFinite(kiePhotoCost) && kiePhotoCost >= 0
  }, [mode, modelId, kiePhotoCost])

  const canSubmitSunoMusic = useMemo(() => {
    if (mode !== 'music' || modelId !== 'kie-suno') return true
    if (!musicGenre.trim()) return false
    if (musicInstrumental) return true
    return prompt.trim().length > 0
  }, [mode, modelId, musicGenre, musicInstrumental, prompt])

  const modelMinPriceById = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of MODELS) {
      if (!m.id.startsWith('kie-')) continue
      const lowestQuality = m.qualityOptions[0]?.value ?? 'std'
      const apiCost = kiePhotoCostFromEntries(kiePhotoPriceEntries ?? undefined, m.id, lowestQuality)
      const fallbackCost = kiePhotoCostCoins(m.id, lowestQuality)
      const minCost = apiCost ?? fallbackCost
      if (typeof minCost === 'number') map[m.id] = minCost
    }
    return map
  }, [kiePhotoPriceEntries])

  const videoModelMinPriceById = useMemo(() => {
    const map: Record<string, number> = {}
    if (!kieVideoPriceEntries?.length) return map
    for (const m of MODELS) {
      if (!m.modes.includes('video') || !m.id.startsWith('kie-')) continue
      const durations = m.videoDurations ?? DURATION_OPTIONS_VIDEO
      let min: number | null = null
      for (const q of m.qualityOptions) {
        for (const d of durations) {
          const cost = kieVideoCostFromEntries(kieVideoPriceEntries, m.id, q.value, d.value)
          if (typeof cost === 'number' && (min === null || cost < min)) min = cost
        }
      }
      if (min !== null) map[m.id] = min
    }
    return map
  }, [kieVideoPriceEntries])

  const addMedia = useCallback(
    (files: FileList | File[] | null) => {
      if (slotsFull) return
      if (!files) return
      const list = Array.isArray(files) ? files : Array.from(files)
      if (!list.length) return
      /** Снимок до очистки input: иначе React вызовет updater позже, а onChange уже сделает value='' и FileList станет пустым */
      const picked = list
      const rules = model.media
      const maxBytes = rules.maxSizeMb * 1024 * 1024
      let next = [...attachedRef.current]
      if (rules.maxFiles === 1 && picked.length > 0) {
        next.forEach((a) => {
          if (a.url.startsWith('blob:')) URL.revokeObjectURL(a.url)
        })
        next = []
      }
      for (const file of picked) {
        if (next.length >= rules.maxFiles) break
        if (!acceptsFile(file, rules.accept)) continue
        if (file.size > maxBytes) continue
        next.push({
          id: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
          name: file.name,
          type: file.type,
        })
      }
      attachedRef.current = next
      flushSync(() => {
        setAttached(next)
        setMediaAttachEpoch((e) => e + 1)
      })
      void persistDraftImmediate()
    },
    [model.media, slotsFull, persistDraftImmediate]
  )

  const removeMedia = (id: string) => {
    const prev = attachedRef.current
    const t = prev.find((p) => p.id === id)
    if (t?.url.startsWith('blob:')) URL.revokeObjectURL(t.url)
    const next = prev.filter((p) => p.id !== id)
    attachedRef.current = next
    flushSync(() => {
      setAttached(next)
      setMediaAttachEpoch((e) => e + 1)
    })
    void persistDraftImmediate()
    requestAnimationFrame(() => {
      const el = pickFilesInputRef.current
      if (el) el.value = ''
    })
  }

  const insertPromptText = useCallback((text: string, target: HTMLTextAreaElement | null) => {
    if (!text) return
    const start = target?.selectionStart ?? prompt.length
    const end = target?.selectionEnd ?? start
    const next = `${prompt.slice(0, start)}${text}${prompt.slice(end)}`
    setPrompt(next)
    requestAnimationFrame(() => {
      const caret = start + text.length
      try {
        ;(target ?? promptInputRef.current)?.setSelectionRange(caret, caret)
      } catch {
        /* ignore */
      }
    })
  }, [prompt])

  const handlePromptPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData?.getData('text/plain') ?? e.clipboardData?.getData('text') ?? ''
    if (!text) return
    e.preventDefault()
    insertPromptText(text, e.currentTarget)
  }, [insertPromptText])

  const handlePromptBeforeInput = useCallback((e: React.FormEvent<HTMLTextAreaElement>) => {
    const native = e.nativeEvent
    if (!(native instanceof InputEvent)) return
    if (native.inputType !== 'insertFromPaste') return
    const dataTransfer = (native as InputEvent & { dataTransfer?: DataTransfer | null }).dataTransfer
    const text = dataTransfer?.getData('text/plain') ?? native.data ?? ''
    if (!text) return
    e.preventDefault()
    insertPromptText(text, e.currentTarget)
  }, [insertPromptText])

  const submit = async () => {
    if (mode === 'music' && modelId === 'kie-suno') {
      if (!canSubmitSunoMusic) return
    } else if (!prompt.trim()) {
      return
    }
    setSaveHint(null)
    const mediaSnap = [...attachedRef.current]
    const payload = {
      mode,
      model: modelId,
      prompt: prompt.trim(),
      attachments: mediaSnap.map((a) => ({ name: a.name, type: a.type })),
      ...(showAspect && { aspect }),
      ...(showQuality && { quality }),
      ...(showDurationBlock && { duration }),
    }
    console.log(payload)

    if (isApi && token) {
      await persistDraftImmediate()
      const submittedAt = Date.now()
      const submittedPrompt = prompt.trim()
      beginGenerationAttempt(model.label)
      showGenerationTaskToast({
        kind: 'start',
        modelLabel: model.label,
        slotsFilled: getGenerationBannerState().activeSlotCount,
        maxSlots: KIE_PARALLEL_MAX,
      })
      try {
        let imageInputs: string[] | undefined
        if ((mode === 'photo' || mode === 'video') && mediaSnap.length) {
          const imgs = mediaSnap.filter((a) => isImageAttachment(a))
          imageInputs = await Promise.all(
            imgs.map(async (a) => {
              if (a.file) {
                return readFileAsDataUrl(a.file)
              }
              if (a.dataUrl?.startsWith('data:image/')) return a.dataUrl
              throw new Error('Нет данных изображения')
            })
          )
        }
        const r = await postGenerationRecord(token, {
          mode,
          modelId,
          modelLabel: model.label,
          prompt: prompt.trim(),
          publishPublic,
          aspect: showAspect ? aspect : null,
          quality: showQuality ? quality : null,
          duration: showDurationBlock ? duration : null,
          ...(imageInputs?.length ? { imageInputs } : {}),
          ...(mode === 'music' && modelId === 'kie-suno'
            ? {
              musicGenre: musicGenre.trim(),
              musicTitle: musicTitle.trim() || null,
              musicInstrumental,
              musicVocalGender: musicInstrumental ? null : musicVocalGender,
            }
            : {}),
        })
        if ('accepted' in r && r.accepted) {
          mergeUser(r.user)
          const waitGenId = r.generationId
          void (async () => {
            try {
              for (let i = 0; i < 450; i++) {
                await new Promise((res) => setTimeout(res, 2000))
                const me = await getMe(token)
                mergeUser(me.user)
                const g = me.user.generationsLog?.find((x) => x.id === waitGenId)
                if (!g) break
                const generatedUrl = getGenerationResultUrl(g)
                if (generatedUrl) {
                  if (mode === 'photo') {
                    queueAutoDownloadCompressedPhoto(g, waitGenId)
                    if (generatedUrl.trim().startsWith('data:')) {
                      setInlinePreviewById((prev) => ({ ...prev, [waitGenId]: generatedUrl }))
                    }
                  }
                  showGenerationTaskToast({
                    kind: 'success',
                    modelLabel: model.label,
                    detail: publishPublic
                      ? 'Результат в списке (и в профиле, если включён показ).'
                      : 'Результат в списке ниже.',
                  })
                  return
                }
                if (g.generationStatus === 'failed') {
                  return
                }
              }
            } catch {
              /* ignore */
            }
          })()
        } else {
          const firstId = r.user.generationsLog?.[0]?.id
          const img = 'resultImage' in r && typeof r.resultImage === 'string' ? r.resultImage.trim() : ''
          if (img && firstId) {
            setInlinePreviewById((prev) => ({ ...prev, [firstId]: img }))
          }
          mergeUser(r.user)
          const resultUrl = 'resultUrl' in r && typeof r.resultUrl === 'string' ? r.resultUrl : ''
          if (mode === 'photo' && (img || resultUrl)) {
            showGenerationTaskToast({
              kind: 'success',
              modelLabel: model.label,
              detail: publishPublic
                ? 'Результат в списке (и в профиле, если включён показ).'
                : 'Результат в списке ниже.',
            })
          } else {
            showGenerationTaskToast({
              kind: 'success',
              modelLabel: model.label,
              detail: publishPublic
                ? 'Генерация добавлена в публичный профиль.'
                : 'Сохранено в истории генераций.',
            })
          }
        }
      } catch (e) {
        const reason = e instanceof Error ? e.message : 'Ошибка сохранения'
        let recoveredAsOk = false
        try {
          const fresh = await getMe(token)
          mergeUser(fresh.user)
          // Если сетевой ответ от POST потерян, но запись уже есть в журнале — считаем задачу успешной.
          const matched = (fresh.user.generationsLog ?? []).some((g) => {
            if (g.modelId !== modelId) return false
            if (!g.createdAt) return false
            const t = new Date(g.createdAt).getTime()
            if (!Number.isFinite(t) || t < submittedAt - 30_000) return false
            const gp = (g.prompt ?? g.promptPreview ?? '').trim()
            return gp.includes(submittedPrompt.slice(0, 24))
          })
          if (matched) recoveredAsOk = true
        } catch {
          /* ignore */
        }
        if (recoveredAsOk) {
          showGenerationTaskToast({
            kind: 'success',
            modelLabel: model.label,
            detail: 'Результат добавлен в список генераций.',
          })
        } else {
          showGenerationTaskToast({
            kind: 'error',
            modelLabel: model.label,
            message: `Запрос не выполнен: ${formatGenerationErrorMessage(reason)}`,
          })
        }
        const limitOrConcurrent = /лимит|одновременно|Уже выполняется генерация/i.test(reason)
        const insufficient = /Недостаточно/i.test(reason)
        const clientNet = isClientTransportGenerationError(reason)
        if (!limitOrConcurrent && !insufficient && !clientNet) {
          void postGenerationReject(token, {
            mode,
            modelId,
            reason,
          }).catch(() => { })
        }
      } finally {
        endGenerationAttempt()
      }
    }
  }

  const fieldClass =
    'rounded-xl border border-slate-200 dark:border-slate-600 bg-surface text-slate-900 dark:text-slate-100 text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400/35 dark:focus:ring-slate-500/35 min-w-0'
  const selectClass = `w-full ${fieldClass} appearance-none pr-10`

  const labelClass = 'text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1'
  const SelectChevron = () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  const canAddMore = attached.length < model.media.maxFiles

  return (
    <div className="pt-2 pb-24 flex flex-col gap-3 lg:gap-4 w-full max-w-lg lg:max-w-4xl xl:max-w-5xl mx-auto relative">
      {errorToast ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[70] flex justify-center px-3 sm:bottom-24 lg:bottom-28"
          role="alert"
          aria-live="assertive"
        >
          <div className="pointer-events-auto max-w-md rounded-2xl border border-red-200/90 bg-red-50/95 px-3.5 py-2.5 text-sm text-red-900 shadow-lg shadow-red-900/10 dark:border-red-800/60 dark:bg-red-950/90 dark:text-red-100">
            {errorToast}
          </div>
        </div>
      ) : null}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface shadow-sm flex flex-col overflow-hidden">
        <div className="px-3 pt-3 pb-2 border-b border-slate-100 dark:border-slate-700/80">
          <div className="space-y-3">
            <div>
              <p className={labelClass}>Тип контента</p>
              <div className="grid grid-cols-3 gap-2 sm:gap-2 lg:gap-3">
                {MODE_TABS.map((tab) => {
                  const on = mode === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMode(tab.id)}
                      className={`flex flex-col items-start gap-1.5 rounded-2xl px-3 py-3 text-left transition-all duration-200 active:scale-[0.98] ${on ? tab.activeClass : tab.idleClass
                        }`}
                    >
                      <span
                        className={`rounded-xl p-1.5 ${on ? 'bg-[var(--color-media-chrome-icon-on)]' : 'bg-[var(--color-media-chrome-icon-off)]'
                          }`}
                      >
                        {tab.icon}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold leading-tight">{tab.title}</span>
                        <span className="block text-[10px] opacity-80 mt-0.5 font-medium">{tab.caption}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div ref={modelPickerRef} className="relative">
              <p className={labelClass}>Нейросеть</p>
              <button
                type="button"
                onClick={() => setModelSheetOpen((prev) => (desktop ? !prev : true))}
                className={`w-full flex items-center justify-between gap-2 ${fieldClass} py-2.5 px-3 text-left`}
              >
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-medium">{model.label}</span>
                  {mode === 'photo' && model.media.accept.includes('image') ? (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Референсы: до {model.media.maxFiles} фото
                    </span>
                  ) : null}
                  {mode === 'video' && model.media.hint?.trim() ? (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-3">
                      {model.media.hint.trim()}
                    </span>
                  ) : null}
                </span>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`shrink-0 text-slate-400 transition-transform duration-200${modelSheetOpen ? ' rotate-180' : ''}`}
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {desktop && modelSheetOpen ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-xl dark:border-slate-600">
                  <ul className="max-h-[360px] overflow-y-auto p-2 dropdown-menu">
                    {modelsForMode.map((m) => {
                      const active = m.id === modelId
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setModelId(m.id)
                              setModelSheetOpen(false)
                            }}
                            className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition-colors ${active
                              ? 'bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-600'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                              }`}
                          >
                            <div className='flex items-center justify-between w-full'>
                              <div>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{m.label}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                                  {m.media.hint || (m.media.maxFiles === 1 ? '1 фото' : `до ${m.media.maxFiles} фото`)}
                                </p>
                                {mode === 'photo' && m.media.accept.includes('image') ? (
                                  <p className="text-[10px] font-medium text-slate-600 dark:text-slate-300 mt-1">
                                    До {m.media.maxFiles} фото
                                  </p>
                                ) : null}
                              </div>
                              <>
                                {mode === 'photo' && typeof modelMinPriceById[m.id] === 'number' ? (
                                  <div className='flex items-center'>
                                    <p className="text-[14px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                                      от {modelMinPriceById[m.id]} 
                                    </p>
                                    <div className='inline-block ml-1'><CreditCoin /></div>
                                  </div>
                                ) : null}
                                {mode === 'video' && typeof videoModelMinPriceById[m.id] === 'number' ? (
                                  <div className='flex items-center'>  
                                    <p className="text-[14px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                                      от {videoModelMinPriceById[m.id]} 
                                    </p>
                                    <div className='inline-block ml-1'><CreditCoin /></div>
                                  </div>
                                ) : null}
                                {mode === 'music' && typeof modelMinPriceById[m.id] === 'number' ? (
                                  <div className='flex items-center'>
                                    <p className="text-[14px] font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                                      от {modelMinPriceById[m.id]} 
                                    </p>
                                    <div className='inline-block ml-1'><CreditCoin /></div>
                                  </div>
                                ) : null}
                              </>
                            </div>
                            {active ? (
                              <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                className="shrink-0 text-emerald-600 dark:text-emerald-400"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <span className="w-5 shrink-0" />
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}
            </div>

            {mode === 'video' && (showQuality || showDurationBlock) ? (
              <div className={`grid gap-2 ${showQuality && showDurationBlock ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {showQuality ? (
                  <div>
                    <p className={labelClass}>Качество</p>
                    <div className="relative">
                      <select
                        value={quality}
                        onChange={(e) => setQuality(e.target.value)}
                        className={selectClass}
                      >
                        {model.qualityOptions.map((q) => (
                          <option key={q.value} value={q.value}>
                            {q.label}
                          </option>
                        ))}
                      </select>
                      <SelectChevron />
                    </div>
                  </div>
                ) : null}
                {showDurationBlock ? (
                  <div>
                    <p className={labelClass}>Длительность</p>
                    <div className="relative">
                      <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className={selectClass}
                      >
                        {durationOptions.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <SelectChevron />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {mode === 'video' && showAspect ? (
              <div>
                <p className={labelClass}>Формат кадра</p>
                <AspectRatioPicker
                  values={model.aspectRatios}
                  value={aspect}
                  onChange={setAspect}
                  landscape={landscape}
                />
              </div>
            ) : null}

            {mode === 'photo' && showQuality ? (
              <div>
                <p className={labelClass}>Качество</p>
                <div className="relative">
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className={selectClass}
                  >
                    {model.qualityOptions.map((q) => (
                      <option key={q.value} value={q.value}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
              </div>
            ) : null}

            {mode === 'photo' && showAspect ? (
              <div>
                <p className={labelClass}>Формат кадра</p>
                <AspectRatioPicker
                  values={model.aspectRatios}
                  value={aspect}
                  onChange={setAspect}
                  landscape={landscape}
                />
              </div>
            ) : null}

            {mode === 'music' && modelId === 'kie-suno' && showQuality ? (
              <div>
                <p className={labelClass}>Версия Suno</p>
                <div className="relative">
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className={selectClass}
                    disabled={slotsFull}
                  >
                    {model.qualityOptions.map((q) => (
                      <option key={q.value} value={q.value}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
              </div>
            ) : null}

            {mode === 'music' && modelId === 'kie-suno' ? (
              <div className="space-y-3 pt-0.5">
                <div>
                  <p className={labelClass}>Жанр</p>
                  <div className="relative">
                    <select
                      value={musicGenre}
                      onChange={(e) => setMusicGenre(e.target.value)}
                      className={selectClass}
                      disabled={slotsFull}
                    >
                      {MUSIC_GENRES.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </div>
                </div>
                <div>
                  <p className={labelClass}>Название трека</p>
                  <input
                    type="text"
                    value={musicTitle}
                    onChange={(e) => setMusicTitle(e.target.value)}
                    placeholder="По желанию"
                    className={`w-full ${fieldClass}`}
                    maxLength={80}
                    disabled={slotsFull}
                  />
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={musicInstrumental}
                    onChange={(e) => setMusicInstrumental(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 accent-slate-900 focus:ring-slate-400/40 dark:border-slate-600 dark:text-slate-100 dark:accent-white"
                    disabled={slotsFull}
                  />
                  <span className="text-sm text-slate-800 dark:text-slate-100">Только инструментал (без вокала)</span>
                </label>
                {!musicInstrumental ? (
                  <div>
                    <p className={labelClass}>Вокал</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setMusicVocalGender('m')}
                        disabled={slotsFull}
                        className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ring-1 ${musicVocalGender === 'm'
                          ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900 dark:ring-white'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 ring-slate-200 dark:ring-slate-600 text-slate-700 dark:text-slate-200'
                          } disabled:opacity-50`}
                      >
                        Мужской
                      </button>
                      <button
                        type="button"
                        onClick={() => setMusicVocalGender('f')}
                        disabled={slotsFull}
                        className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ring-1 ${musicVocalGender === 'f'
                          ? 'bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900 dark:ring-white'
                          : 'bg-slate-100/80 dark:bg-slate-800/60 ring-slate-200 dark:ring-slate-600 text-slate-700 dark:text-slate-200'
                          } disabled:opacity-50`}
                      >
                        Женский
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {model.media.maxFiles > 0 ? (
          <div
            className={`px-3 pt-3 pb-2 border-b border-slate-100 dark:border-slate-700/80 transition-colors outline-none  rounded-none ${mediaDrag ? 'bg-slate-100/80 dark:bg-slate-800/50 ring-2 ring-inset ring-slate-300 dark:ring-slate-500' : ''
              } ${slotsFull ? 'opacity-60 pointer-events-none' : ''}`}
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (!slotsFull) setMediaDrag(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setMediaDrag(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setMediaDrag(false)
              if (slotsFull || !canAddMore) return
              addMedia(e.dataTransfer.files)
            }}
            onPaste={(e) => {
              if (slotsFull || !canAddMore) return
              const cd = e.clipboardData
              if (!cd) return
              if (cd.files?.length) {
                e.preventDefault()
                addMedia(cd.files)
                return
              }
              const fromItems: File[] = []
              for (const it of Array.from(cd.items ?? [])) {
                if (it.kind === 'file' && (it.type.startsWith('image/') || it.type.startsWith('video/'))) {
                  const f = it.getAsFile()
                  if (f) fromItems.push(f)
                }
              }
              if (fromItems.length) {
                e.preventDefault()
                addMedia(fromItems)
              }
            }}
            tabIndex={slotsFull ? -1 : 0}
            role="group"
            aria-label="Медиа: загрузка файлов, перетаскивание и вставка. Ссылку указывать не нужно."
          >
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">
              Медиа для модели
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-snug mb-2">
              {mode === 'video' ? (
                <>
                  {isKieVideoPriceReady && kieVideoCost != null ? (
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      от {kieVideoCost} кредитов.{' '}
                    </span>
                  ) : null}
                  {model.media.maxFiles === 1 ? '1 фото' : `до ${model.media.maxFiles} фото`}. Файлы с устройства: кнопка ниже, перетаскивание или вставка из буфера — без ссылок.
                </>
              ) : mode === 'photo' && model.media.accept.includes('image') ? (
                <>
                  {model.media.hint}{' '}
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    Лимит: {model.media.maxFiles} фото.
                  </span>{' '}
                  Добавление — <span className="text-slate-600 dark:text-slate-300">только файлы</span> (галерея, + или вставка); URL не используем. Превью в квадрате.
                </>
              ) : (
                <>
                  {model.media.hint}{' '}
                  <span className="font-medium text-slate-600 dark:text-slate-300">Файлы с устройства</span> — без
                  ввода ссылок.
                </>
              )}
            </p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-0.5 px-0.5 items-center">
              {attached.map((a) => (
                <div
                  key={a.id}
                  className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800"
                >
                  {a.type.startsWith('video/') ? (
                    <video src={a.url} className="w-full h-full object-cover" muted />
                  ) : a.type.startsWith('audio/') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center p-1">
                      <svg className="w-8 h-8 text-sky-600 dark:text-sky-400" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                      <span className="text-[8px] text-slate-500 dark:text-slate-400 truncate max-w-[90%] px-0.5">
                        {a.name}
                      </span>
                    </div>
                  ) : (
                    <img
                      src={a.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeMedia(a.id)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/65 text-white text-xs leading-5 z-[1]"
                    aria-label="Удалить файл"
                  >
                    ×
                  </button>
                </div>
              ))}
              {canAddMore ? (
                slotsFull ? (
                  <div
                    className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 aspect-square rounded-xl border-2 border-dashed border-slate-300/60 dark:border-slate-600/60 flex flex-col items-center justify-center gap-0.5 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                    aria-hidden
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                    </svg>
                    <span className="text-[9px] font-medium">
                      {attached.length}/{model.media.maxFiles}
                    </span>
                  </div>
                ) : (
                  <label
                    htmlFor={filePickInputId}
                    aria-label="Загрузить файлы с устройства"
                    className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 overflow-hidden touch-manipulation cursor-pointer flex flex-col items-center justify-center gap-0.5 active:bg-slate-50 dark:active:bg-slate-800/80"
                  >
                    <input
                      id={filePickInputId}
                      key={`${modelId}-${mode}-${fileAcceptAttr}-${fileAllowMultiple ? 'multi' : 'one'}-${mediaAttachEpoch}`}
                      ref={pickFilesInputRef}
                      type="file"
                      accept={fileAcceptAttr}
                      multiple={fileAllowMultiple}
                      disabled={slotsFull}
                      className="sr-only"
                      tabIndex={-1}
                      onChange={(e) => {
                        addMedia(e.target.files)
                        e.target.value = ''
                      }}
                    />
                    <span className="pointer-events-none flex flex-col items-center justify-center gap-0.5 px-0.5" aria-hidden>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                      </svg>
                      <span className="text-[8px] font-semibold text-center leading-tight">С устройства</span>
                      <span className="text-[9px] font-medium tabular-nums">
                        {attached.length}/{model.media.maxFiles}
                      </span>
                    </span>
                  </label>
                )
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="border-t border-slate-100 dark:border-slate-700/80 bg-gradient-to-b from-slate-50/80 to-transparent dark:from-slate-900/35 dark:to-transparent px-3 sm:px-4 pt-4 pb-1">
          <div className="mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Промпт
            </p>
          </div>
          <textarea
            ref={promptInputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPaste={handlePromptPaste}
            onBeforeInput={handlePromptBeforeInput}
            placeholder={
              mode === 'music' && modelId === 'kie-suno'
                ? musicInstrumental
                  ? 'Текст не нужен — выбран инструментал'
                  : 'Текст песни: куплеты, припев, слова…'
                : promptPlaceholder(mode)
            }
            rows={8}
            disabled={slotsFull || (mode === 'music' && modelId === 'kie-suno' && musicInstrumental)}
            className="w-full min-h-[168px] resize-y rounded-2xl border border-slate-200/95 bg-white px-4 py-3.5 text-base leading-relaxed text-slate-900 shadow-sm placeholder:text-slate-400 outline-none transition-[box-shadow,border-color] focus:border-[var(--color-brand)]/55 focus:ring-[3px] focus:ring-[var(--color-brand)]/20 dark:border-slate-600 dark:bg-slate-900/65 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-[var(--color-brand)]/50 disabled:opacity-50 sm:min-h-[192px]"
          />
        </div>
        {isApi ? (
          <label className="flex items-center gap-3 mx-3 mb-2 px-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={publishPublic}
              onChange={(e) => setPublishPublic(e.target.checked)}
              className="peer sr-only"
            />
            <span className=" inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-transparent shadow-sm transition-colors peer-checked:border-[var(--color-brand)] peer-checked:bg-[var(--color-brand)] peer-checked:text-[var(--color-on-brand)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-brand)]/45 dark:border-slate-600 dark:bg-slate-800 dark:peer-checked:border-[var(--color-brand)] dark:peer-checked:bg-[var(--color-brand)]">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M3 8.2l3.1 3L13 4.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
              <span className="font-semibold text-slate-800 dark:text-slate-100">Показать в профиле </span>
              - работа появится на странице Профиль и будет видна другим пользователям.
            </span>
          </label>
        ) : null}
        <div className="flex flex-col items-stretch gap-2 px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-700/80">
          {saveHint ? (
            <p
              className={`text-xs px-1 break-words ${saveHint.includes('Не удалось') ||
                saveHint.includes('Ошибка') ||
                saveHint.includes('Недостаточно') ||
                saveHint.includes('недоступна')
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-600 dark:text-emerald-400'
                }`}
            >
              {saveHint}
            </p>
          ) : null}
          {isApi && modelId.startsWith('kie-') && (mode === 'photo' || mode === 'video' || (mode === 'music' && modelId === 'kie-suno')) ? (
            <p className="text-sm  dark:text-slate-400 px-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-medium">Списание:</span>
              {mode === 'photo' || (mode === 'music' && modelId === 'kie-suno') ? (
                kiePhotoCost != null ? (
                  <span className="inline-flex items-center gap-2 text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 leading-none">
                    <span className="tabular-nums tracking-tight">{kiePhotoCost}</span>
                    <CreditCoin className="w-[1.25rem] h-[1.25rem] sm:w-6 sm:h-6" />
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">рассчитывается…</span>
                )
              ) : kieVideoCost != null ? (
                <span className="inline-flex items-center gap-2 text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 leading-none">
                  <span className="tabular-nums tracking-tight">{kieVideoCost}</span>
                  <CreditCoin className="w-[1.25rem] h-[1.25rem] sm:w-6 sm:h-6" />
                </span>
              ) : (
                <span className="text-xs text-red-600 dark:text-red-400">
                  {mode === 'video'
                    ? 'Цена не настроена для выбранных качества/длительности'
                    : 'Цена не настроена для выбранной модели в админке'}
                </span>
              )}
            </p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 mr-auto px-1">
              {slotsFull ? 'Лимит задач занят (3/3)' : 'Можно запускать до 3 задач параллельно'}
            </span>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={
                slotsFull ||
                !isKieVideoPriceReady ||
                !isKieMusicPriceReady ||
                (mode === 'music' && modelId === 'kie-suno' ? !canSubmitSunoMusic : !prompt.trim())
              }
              className="shrink-0 w-12 h-12 rounded-xl bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 flex items-center justify-center disabled:opacity-35 active:opacity-90"
              aria-label="Создать"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {showSecondarySettings ? (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface p-3 space-y-3 shadow-sm">
        {showAspect ? (
          <div>
            <p className={labelClass}>Формат кадра</p>
            <AspectRatioPicker
              values={model.aspectRatios}
              value={aspect}
              onChange={setAspect}
              landscape={landscape}
            />
          </div>
        ) : null}

        {showQuality ? (
          <div>
            <p className={labelClass}>Качество</p>
            <div className="relative">
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className={selectClass}
              >
                {model.qualityOptions.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>
        ) : null}

        {showDurationBlock ? (
          <div>
            <p className={labelClass}>Длительность</p>
            <div className="relative">
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={selectClass}
              >
                {durationOptions.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>
        ) : null}
      </div>
      ) : null}

      {isApi ? (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-surface p-3 shadow-sm">
          <p className={labelClass}>Ваши последние генерации</p>
          <div className="mt-2 flex flex-col gap-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
              {historyFeedItems.map((g) => {
                const src = inlinePreviewById[g.id] ?? getGenerationResultUrl(g)
                const isPending = g.generationStatus === 'pending'
                const isPhoto = g.mode === 'photo' && Boolean(src) && !isPending
                const isVideo = g.mode === 'video' && Boolean(src) && !isPending
                const isMusic = g.mode === 'music' && Boolean(src) && !isPending
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setHistoryId((prev) => (prev === g.id ? null : g.id))}
                    className="group relative aspect-square w-full overflow-hidden rounded-2xl bg-[var(--color-media-chrome-bg)] text-left"
                  >
                    {isPending ? (
                      <PendingGenerationNeuralCard
                        mode={g.mode}
                        modelLabel={g.modelLabel}
                        createdAt={g.createdAt}
                        promptPreview={
                          g.prompt?.trim() || g.musicTitle?.trim() || g.promptPreview || null
                        }
                      />
                    ) : isPhoto ? (
                      inlinePreviewById[g.id] ? (
                        <img
                          src={inlinePreviewById[g.id]}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          fetchPriority="low"
                          className="block h-full w-full min-h-0 object-cover transition duration-300 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <GenerationPhotoImg
                          item={g}
                          alt=""
                          className="block h-full w-full min-h-0 object-cover transition duration-300 group-hover:scale-[1.04]"
                        />
                      )
                    ) : isVideo ? (
                      <video
                        src={src}
                        className="block h-full w-full min-h-0 object-cover transition duration-300 group-hover:scale-[1.04]"
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="auto"
                        onCanPlay={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => { })}
                      />
                    ) : isMusic ? (
                      <div className="relative h-full w-full min-h-0 overflow-hidden">
                        <MusicCardCover className="absolute inset-0" />
                        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/80 via-black/15 to-transparent pointer-events-none" />
                        <div className="absolute inset-x-0 bottom-8 z-[2] space-y-0.5 px-2 text-left">
                          <p className="truncate text-[10px] font-bold text-white drop-shadow-sm">
                            {g.musicTitle?.trim() || g.modelLabel}
                          </p>
                          <p className="truncate text-[9px] text-white/80">
                            {formatGenerationDate(g.createdAt)}
                            {g.inPublicFeed ? ' · Публично' : ' · Не опубликовано'}
                          </p>
                        </div>
                        <audio
                          src={src}
                          controls
                          preload="metadata"
                          className="absolute bottom-0 left-0 right-0 z-[3] h-8 w-full border-0 bg-black/50 px-0.5 [filter:none]"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-slate-200/60 px-2 dark:bg-slate-800/80">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          {g.mode}
                        </span>
                        <span className="line-clamp-2 text-center text-[11px] font-medium text-slate-700 dark:text-slate-200">
                          {g.modelLabel}
                        </span>
                      </div>
                    )}
                    {isPending ? null : isMusic ? null : (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-2 pb-2 pt-8">
                        <p className="truncate text-[10px] font-medium text-white/95">{g.modelLabel}</p>
                        <p className="truncate text-[9px] text-white/70">
                          {formatGenerationDate(g.createdAt)}
                          {g.inPublicFeed ? ' · Публично' : ' · Не опубликовано'}
                        </p>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            {historyFeedLoading ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 px-1 py-1">Загружаем генерации...</p>
            ) : historyFeedItems.length > 0 ? null : (
              <p className="text-xs text-slate-500 dark:text-slate-400 px-1 py-1">
                Здесь появятся готовые работы после генерации.
              </p>
            )}
            {canShowMoreHistory ? (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  disabled={historyFeedBusyMore}
                  onClick={() => {
                    void loadHistoryPage({ reset: false, count: HISTORY_PAGE_SIZE })
                  }}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {historyFeedBusyMore ? 'Загрузка...' : 'Показать еще'}
                </button>
              </div>
            ) : null}
          </div>

          {historyItem ? (
            <div
              className="fixed inset-0 z-[65] flex touch-manipulation items-end justify-center bg-black/70 animate-[fadeIn_.18s_ease-out] modal-backdrop-safe-tg sm:items-center sm:px-3"
              role="dialog"
              aria-modal="true"
              aria-label="Просмотр генерации"
              onClick={() => setHistoryId(null)}
            >
              <div
                className="generation-detail-sheet flex max-h-[min(96dvh,100vh)] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-surface shadow-2xl animate-[slideUp_.22s_cubic-bezier(.2,.8,.2,1)] dark:border-slate-600 sm:max-h-[min(90dvh,900px)] sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative flex shrink-0 items-start justify-between gap-2 border-b border-slate-200 py-2.5 pl-3 pr-2 dark:border-slate-700">
                  <div className="min-w-0 flex-1 pr-10">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {formatGenerationDate(historyItem.createdAt)}
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {historyItem.mode === 'music' && historyItem.musicTitle?.trim()
                        ? historyItem.musicTitle.trim()
                        : historyItem.modelLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryId(null)}
                    className="modal-detail-close absolute right-1.5 top-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 active:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:active:bg-slate-700"
                    aria-label="Закрыть"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden landscape:flex-row sm:flex-row">
                  <div className="relative overflow-hidden flex min-h-[min(32vh,200px)] max-h-[min(42vh,280px)] shrink-0 items-center justify-center bg-[var(--color-media-chrome-bg)] p-2 landscape:max-h-none landscape:min-h-0 landscape:w-[44%] landscape:shrink-0 landscape:flex-none sm:max-h-none sm:min-h-[min(320px,50vh)] sm:w-[min(46%,420px)] sm:flex-none">
                    {historyItem.generationStatus === 'pending' ? (
                      <div className="relative z-[1] h-full w-full min-h-[min(32vh,200px)] max-h-[min(42vh,280px)] overflow-hidden rounded-xl sm:min-h-[min(280px,50vh)]">
                        <PendingGenerationNeuralCard
                          mode={historyItem.mode}
                          modelLabel={historyItem.modelLabel}
                          createdAt={historyItem.createdAt}
                          promptPreview={
                            historyItem.prompt?.trim() ||
                            historyItem.musicTitle?.trim() ||
                            historyItem.promptPreview ||
                            null
                          }
                        />
                      </div>
                    ) : (
                      <>
                        {(historyItem.mode === 'photo' &&
                          (inlinePreviewById[historyItem.id] ?? historyItem.resultUrl)) ? (
                          <GenerationPhotoImg
                            item={historyItem}
                            overrideSrc={
                              inlinePreviewById[historyItem.id]?.trim()
                                ? inlinePreviewById[historyItem.id]!.trim()
                                : undefined
                            }
                            alt=""
                            priority
                            className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-55"
                          />
                        ) : (historyItem.mode === 'video' &&
                          (inlinePreviewById[historyItem.id] ?? historyItem.resultUrl)) ? (
                          <video
                            src={inlinePreviewById[historyItem.id] ?? historyItem.resultUrl ?? ''}
                            className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-55 pointer-events-none"
                            autoPlay
                            loop
                            muted
                            playsInline
                          />
                        ) : null}
                        {historyItem.mode === 'photo' &&
                          (inlinePreviewById[historyItem.id] ?? historyItem.resultUrl) ? (
                          <GenerationPhotoImg
                            item={historyItem}
                            overrideSrc={
                              inlinePreviewById[historyItem.id]?.trim()
                                ? inlinePreviewById[historyItem.id]!.trim()
                                : undefined
                            }
                            alt=""
                            priority
                            className="relative z-[1] max-h-[min(40vh,260px)] max-w-full object-contain select-none landscape:max-h-[min(78dvh,80vh)] sm:max-h-[min(72vh,640px)]"
                          />
                        ) : historyItem.mode === 'video' &&
                          (inlinePreviewById[historyItem.id] ?? historyItem.resultUrl) ? (
                          <video
                            src={inlinePreviewById[historyItem.id] ?? historyItem.resultUrl ?? ''}
                            className="relative z-[1] max-h-[min(40vh,260px)] max-w-full object-contain select-none landscape:max-h-[min(78dvh,80vh)] sm:max-h-[min(72vh,640px)]"
                            autoPlay
                            loop
                            controls
                            playsInline
                            preload="metadata"
                          />
                        ) : historyItem.mode === 'music' &&
                          (inlinePreviewById[historyItem.id] ?? historyItem.resultUrl) ? (
                          <div className="relative z-[1] flex h-full min-h-[180px] w-full min-w-0 max-w-lg flex-col justify-end">
                            <MusicCardCover className="absolute inset-0" />
                            <div className="absolute inset-0 z-[0] bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
                            <div className="relative z-[1] w-full px-3 pb-2 pt-4">
                              <p className="text-center text-sm font-bold text-white drop-shadow-md line-clamp-2">
                                {historyItem.musicTitle?.trim() || historyItem.modelLabel}
                              </p>
                            </div>
                            <audio
                              src={inlinePreviewById[historyItem.id] ?? historyItem.resultUrl ?? ''}
                              controls
                              className="relative z-[1] w-full border-0 bg-black/45 [filter:none]"
                              preload="metadata"
                            />
                          </div>
                        ) : (
                          <p className="px-3 text-center text-sm text-white/70">Нет медиа для этого типа.</p>
                        )}
                      </>
                    )}
                    {historyItem.generationStatus !== 'pending' &&
                      (inlinePreviewById[historyItem.id] ?? historyItem.resultUrl)?.trim() ? (
                      <MediaDownloadButton
                        url={inlinePreviewById[historyItem.id] ?? historyItem.resultUrl}
                        mode={historyItem.mode}
                        id={historyItem.id}
                        label={historyItem.musicTitle?.trim() || historyItem.modelLabel}
                      />
                    ) : null}
                  </div>

                  <div className="flex min-h-0 min-w-0 flex-1 flex-col landscape:min-w-0">
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 [-webkit-overflow-scrolling:touch]">
                      <GenerationDetailStatsDl
                        publicationRow={{ isPublic: Boolean(historyItem.inPublicFeed) }}
                        modelLabel={historyItem.modelLabel || '—'}
                        aspect={historyItem.aspect}
                        quality={historyItem.quality}
                        modelId={historyItem.modelId}
                        mode={historyItem.mode}
                        duration={historyItem.duration}
                        cost={historyItem.cost ?? null}
                        showSocial={Boolean(historyItem.inPublicFeed)}
                        authorTag={user?.publicTag}
                        authorName={user?.displayName ?? user?.publicTag}
                        authorAvatarUrl={user?.avatarUrl}
                        likes={Number(historyItem.likes ?? 0)}
                        likedByMe={Boolean(user?.likedPublicGenerationIds?.includes(historyItem.id))}
                        likeDisabled={!token || !isApi}
                        likeBusy={historyLikeBusy}
                        onLike={() => void toggleHistoryLike()}
                      />
                      <div>
                        <p className={labelClass}>Промпт</p>
                        <textarea
                          readOnly
                          rows={7}
                          value={(historyItem.prompt?.trim() || historyItem.promptPreview || '').trim()}
                          className={`min-h-[7.5rem] w-full resize-none ${fieldClass} font-mono text-xs leading-relaxed`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyHistoryPrompt()}
                        disabled={historyActionBusy}
                        className="h-11 w-full rounded-xl bg-[var(--color-brand)] text-[var(--color-on-brand)] px-4 text-sm font-semibold shadow-sm transition hover:bg-[var(--color-brand-dark)] active:opacity-80 sm:w-auto"
                      >
                        {historyCopied ? 'Промпт скопирован' : 'Копировать промпт'}
                      </button>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => void toggleHistoryPublic()}
                          disabled={historyActionBusy}
                          className="h-11 w-full rounded-xl bg-slate-800 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 active:bg-slate-900 disabled:opacity-60 sm:w-auto"
                        >
                          {historyActionBusy
                            ? 'Сохраняем...'
                            : historyItem.inPublicFeed
                              ? 'Снять с публикации'
                              : 'Опубликовать в профиле'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeHistoryGeneration()}
                          disabled={historyActionBusy}
                          className="h-11 w-full rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 active:bg-red-200 disabled:opacity-60 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/55 sm:w-auto"
                        >
                          {historyActionBusy ? 'Удаляем...' : 'Удалить'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {!desktop && sheetMounted ? (
        <div className="fixed inset-0 z-[70] flex flex-col justify-end pointer-events-none">
          <button
            type="button"
            className={`absolute inset-0 bg-black/45 pointer-events-auto transition-opacity duration-300 ${sheetVisible ? 'opacity-100' : 'opacity-0'
              }`}
            aria-label="Закрыть"
            onClick={() => setModelSheetOpen(false)}
          />
          <div
            className={`pointer-events-auto w-full max-w-lg lg:max-w-2xl mx-auto rounded-t-2xl bg-surface border-t border-x border-slate-200 dark:border-slate-600 shadow-2xl transition-transform duration-300 ease-out max-h-[min(72vh,520px)] lg:max-h-[min(70vh,560px)] flex flex-col ${sheetVisible ? 'translate-y-0' : 'translate-y-full'
              }`}
            style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
            <p className="px-4 pt-1 pb-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              Выбор модели
            </p>
            <ul className="overflow-y-auto px-2 pb-3">
              {modelsForMode.map((m) => {
                const active = m.id === modelId
                const rowPriceCoins =
                  mode === 'video' ? videoModelMinPriceById[m.id] : modelMinPriceById[m.id]
                const rowPriceNum =
                  typeof rowPriceCoins === 'number' && Number.isFinite(rowPriceCoins)
                    ? rowPriceCoins
                    : null
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setModelId(m.id)
                        setModelSheetOpen(false)
                      }}
                      className={`w-full flex items-start justify-between gap-2 rounded-xl px-3 py-3.5 text-left transition-colors ${active
                        ? 'bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="min-w-0 flex-1 truncate font-medium text-slate-900 dark:text-slate-100">
                            {m.label}
                          </p>
                          {rowPriceNum !== null ? (
                            <span className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[13px] font-semibold tabular-nums ">
                              от {rowPriceNum}
                              <CreditCoin className="w-4 h-4" />
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                          {m.media.hint || (m.media.maxFiles === 1 ? '1 фото' : `до ${m.media.maxFiles} фото`)}
                        </p>
                        {mode === 'photo' && m.media.accept.includes('image') ? (
                          <p className="mt-1 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                            До {m.media.maxFiles} фото
                          </p>
                        ) : null}
                      </div>
                      {active ? (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="shrink-0 text-emerald-600 dark:text-emerald-400"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <span className="w-5 shrink-0" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}
