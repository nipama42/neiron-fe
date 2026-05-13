import CreditCoin from './CreditCoin'

interface Props {
  balance: number
  onClick?: () => void
}

export default function BalancePill({ balance, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 text-gray-900 dark:text-gray-100 ${onClick ? 'cursor-pointer active:opacity-70 transition-opacity' : 'cursor-default'}`}
    >
      <span className="text-sm font-semibold tabular-nums leading-none tracking-tight">{balance}</span>
      <CreditCoin className="w-[1.375rem] h-[1.375rem] sm:w-6 sm:h-6" />
    </button>
  )
}
