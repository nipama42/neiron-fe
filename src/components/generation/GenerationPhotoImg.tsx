import { useEffect, useState } from 'react'
import type { GenerationMediaLike } from '../../lib/generationPhoto'
import { generationPhotoSrcPair } from '../../lib/generationPhoto'

/** Показывает временный URL Kie; при ошибке загрузки — сжатый файл из хранилища. */
export default function GenerationPhotoImg({
  item,
  overrideSrc,
  className,
  alt = '',
  priority = false,
  sizes,
  width,
  height,
}: {
  item: GenerationMediaLike | null | undefined
  overrideSrc?: string | null
  className?: string
  alt?: string
  priority?: boolean
  sizes?: string
  width?: number
  height?: number
}) {
  const trimmedOverride =
    typeof overrideSrc === 'string' && overrideSrc.trim().length ? overrideSrc.trim() : ''

  const pair = trimmedOverride ? null : generationPhotoSrcPair(item)
  const [src, setSrc] = useState(trimmedOverride || pair?.primary || '')

  useEffect(() => {
    if (trimmedOverride) setSrc(trimmedOverride)
    else setSrc(pair?.primary ?? '')
  }, [trimmedOverride, pair?.primary])

  if (!(trimmedOverride || pair?.primary)) return null

  return (
    <img
      src={src}
      className={className}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'low'}
      referrerPolicy="no-referrer"
      sizes={sizes}
      width={width}
      height={height}
      draggable={false}
      onError={() => {
        if (!pair?.fallback || src === pair.fallback) return
        setSrc(pair.fallback)
      }}
    />
  )
}
