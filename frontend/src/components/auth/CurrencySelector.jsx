import { ChevronDownIcon, WalletIcon } from '../icons'

export const CURRENCIES = [
  { value: 'PEN', label: 'Sol Peruano (PEN - S/)' },
  { value: 'USD', label: 'Dólar estadounidense (USD - $)' },
  { value: 'EUR', label: 'Euro (EUR - €)' },
]

export default function CurrencySelector({ id = 'currency', value, onChange, error = '', ...props }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-[#1F2937]">
          Moneda principal
        </label>
        <span className="text-[11px] font-medium text-[#94A3B8]">Moneda de tu cuenta</span>
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
          aria-describedby={error ? `${id}-error` : undefined}
          className={`h-12 w-full appearance-none rounded-xl border bg-[#FBFDFC] pl-11 pr-11 text-[13px] text-[#1F2937] transition-all duration-200 focus:bg-white focus:outline-none focus:ring-4 sm:text-[14px] ${
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

      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-2 text-[12px] font-medium text-[#DC5A5A]">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-[12px] leading-relaxed text-[#64748B]">
          Se usará como moneda predeterminada de tu cuenta financiera.
        </p>
      )}
    </div>
  )
}
