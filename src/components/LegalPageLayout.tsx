import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../store/authStore'

export default function LegalPageLayout({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  const backHref = token ? '/explore' : '/'
  const backLabel = token ? 'К приложению' : 'К входу и регистрации'

  return (
    <div className="min-h-screen bg-base text-[var(--color-brand)]">
      <div className="sticky top-0 z-20 border-b border-[var(--color-brand)]/10 bg-base/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            to={backHref}
            className="text-sm font-medium text-[var(--color-muted)] hover:text-[var(--color-brand)] transition-colors"
          >
            ← {backLabel}
          </Link>
          <img src="/mainlogo.png" alt="NEIRON" className="h-6 w-auto opacity-80" />
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-8 pb-16">{children}</div>
    </div>
  )
}
