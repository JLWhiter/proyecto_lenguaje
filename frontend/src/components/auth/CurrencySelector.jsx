import { ChevronDownIcon, WalletIcon } from '../icons'
import FieldMessage from './FieldMessage'
import { fieldDescribedBy } from './feedback'

export const CURRENCIES = [
  { value: 'PEN', label: 'Sol Peruano (PEN - S/)' },
  { value: 'USD', label: 'Dólar estadounidense (USD - $)' },
  { value: 'EUR', label: 'Euro (EUR - €)' },
]

export default function CurrencySelector({
  id = 'currency',
  value,
  onChange,
  error = '',
  labelExtra = <span className="text-[11px] font-medium text-[#94A3B8]">Moneda de tu cuenta</span>,
  hint = 'Se usará como moneda predeterminada de tu cuenta financiera.',
  ...props
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-[#1F2937]">
          Moneda principal
        </label>
        {labelExtra}
      </div>

      <div className="group relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#94A3B8] transition-colors group-focus-within:text-[#10B981]">
          <WalletIcon className="h-[18px] w-[18px]" />
        </span>
        <select
          id={id}
          value={value}
          onChange={onChange}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={fieldDescribedBy(id, error, hint)}
          className={`h-12 w-full min-w-0 appearance-none truncate rounded-xl border bg-[#FBFDFC] pl-11 pr-11 text-base text-[#1F2937] transition-all duration-200 focus:bg-white focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[14px] ${
            error
              ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
              : 'border-[#E5E7EB] hover:border-[#C8D6D0] focus:border-[#10B981] focus:ring-[#10B981]/10'
          }`}
          {...props}
        >
          {CURRENCIES.map((currency) => (
            <option key={currency.value} value={currency.value}>
              {currency.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]">
          <ChevronDownIcon className="h-[18px] w-[18px]" />
        </span>
      </div>

      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  )
}
