import { useEffect } from 'react'

type SeoJsonLdProps = {
  id: string
  data: Record<string, unknown>
}

/** Вставляет JSON-LD в `<head>`; снимается при размонтировании. */
export default function SeoJsonLd({ id, data }: SeoJsonLdProps) {
  const payload = JSON.stringify(data)

  useEffect(() => {
    const scriptId = `seo-json-ld-${id}`
    let script = document.getElementById(scriptId) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = payload
    return () => {
      script?.remove()
    }
  }, [id, payload])

  return null
}
