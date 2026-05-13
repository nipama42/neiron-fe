import type { ContentType } from '../../types'

interface Option {
  value: ContentType | 'all'
  label: string
}

interface Props {
  options: Option[]
  active: ContentType | 'all'
  onChange: (val: ContentType | 'all') => void
}

export default function FilterChips({ options, active, onChange }: Props) {
  return (
    <div className="flex overflow-x-auto scrollbar-hide gap-1.5 pl-3 pr-3 py-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${active === opt.value
              ? 'bg-brand-light text-brand border-[var(--color-brand)]/20 dark:border-[var(--color-brand)]/30'
              : 'bg-surface text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
