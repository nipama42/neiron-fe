/** Иконка кредитов — `/neuron-coin.png` чёрная на прозрачном фоне: светлая тема как есть, тёмная — invert в белый */
export default function CreditCoin({
  className = 'w-5 h-5',
  onBrandBackground,
}: {
  className?: string
  /** Белая монета на сплошном фоне бренда (например строка «Популярный» в топапе) */
  onBrandBackground?: boolean
}) {
  /** На светлой теме «брендовый» блок тёмный — монета белая; в тёмной теме блок часто светлый — чёрная монета без фильтра */
  const tone =
    onBrandBackground === true
      ? '[filter:brightness(0)_invert(1)] dark:[filter:none]'
      : 'dark:invert'
  return (
    <img
      src="/neuron-coin.png"
      alt=""
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      className={`block object-contain shrink-0 ${tone} ${className}`}
      draggable={false}
    />
  )
}
