import { useState } from 'react'
import { downloadCreativeFile } from '../../lib/downloadCreative'

type Props = {
  url: string | null | undefined
  mode: string
  id: string
  label?: string | null
  /** z-index over превью */
  className?: string
}

export default function MediaDownloadButton({ url, mode, id, label, className = '' }: Props) {
  const [busy, setBusy] = useState(false)
  if (!String(url || '').trim()) return null

  return (
    <button
      type="button"
      title="Скачать"
      disabled={busy}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        setBusy(true)
        void downloadCreativeFile(String(url), { mode, id, label })
          .catch(() => {
            /* toast optional */
          })
          .finally(() => setBusy(false))
      }}
      className={`absolute bottom-2 left-2 z-[5] flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white shadow-md ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-black/55 active:scale-95 disabled:opacity-50 ${className}`.trim()}
      aria-label="Скачать файл"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3v12m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" />
      </svg>
    </button>
  )
}
