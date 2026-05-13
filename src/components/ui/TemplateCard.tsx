import type { Template, ContentType } from '../../types'
import CreditCoin from './CreditCoin'

interface Props {
  template: Template
}

const BADGE_STYLES: Record<ContentType, { bg: string; text: string; label: string }> = {
  photo: { bg: 'bg-[var(--color-brand-light)]', text: 'text-[var(--color-brand-dark)]', label: 'Фото' },
  video: { bg: 'bg-[var(--color-brand-light)]', text: 'text-[var(--color-brand-dark)]', label: 'Видео' },
  voice: { bg: 'bg-emerald-50', text: 'text-emerald-900', label: 'Голос' },
  chat: { bg: 'bg-blue-50', text: 'text-blue-900', label: 'Чат' },
}

const TYPE_COLOR: Record<ContentType, string> = {
  photo: 'var(--color-type-photo-icon)',
  video: 'var(--color-type-video-icon)',
  voice: 'var(--color-type-voice-icon)',
  chat: 'var(--color-type-chat-icon)',
}

function TypeIcon({ type }: { type: ContentType }) {
  const c = TYPE_COLOR[type]
  if (type === 'photo') {
    return (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <rect x="3" y="5" width="20" height="16" rx="3" stroke={c} strokeWidth="1.5" fill="none" />
        <circle cx="13" cy="13" r="4" stroke={c} strokeWidth="1.5" fill="none" />
        <circle cx="19" cy="8" r="1.5" fill={c} />
      </svg>
    )
  }
  if (type === 'video') {
    return (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <rect x="2" y="6" width="16" height="14" rx="3" stroke={c} strokeWidth="1.5" fill="none" />
        <path d="M18 10L24 7V19L18 16V10Z" stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round" />
      </svg>
    )
  }
  if (type === 'voice') {
    return (
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <rect x="9" y="2" width="8" height="14" rx="4" stroke={c} strokeWidth="1.5" fill="none" />
        <path d="M4 14C4 19.5 22 19.5 22 14" stroke={c} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <line x1="13" y1="20" x2="13" y2="24" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <rect x="3" y="5" width="20" height="16" rx="3" stroke={c} strokeWidth="1.5" fill="none" />
      <line x1="7" y1="10" x2="15" y2="10" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="13" x2="19" y2="13" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="7" y1="16" x2="12" y2="16" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function TemplateCard({ template }: Props) {
  const badge = BADGE_STYLES[template.type]

  return (
    <div className="bg-surface rounded-xl overflow-hidden">
      <div className={`relative h-18 flex items-center justify-center ${template.previewColor}`} style={{ height: 72 }}>
        <TypeIcon type={template.type} />
        <span
          className={`absolute top-2 left-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full`}
        >
          {badge.label}
        </span>
        {template.isNew ? <span
          className={`absolute top-2 right-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500 text-white`}
        >
          Новое
        </span> : null}
      </div>
      <div className="px-2 py-2">
        <p className="text-[11px] font-medium  leading-tight line-clamp-1">{template.title}</p>
        <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">{template.model}</p>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[9px] text-brand font-medium tabular-nums">{template.creditCost}</span>
          <CreditCoin className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  )
}
