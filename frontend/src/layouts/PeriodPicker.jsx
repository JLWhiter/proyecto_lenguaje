import { CalendarDays, ChevronDown } from 'lucide-react'
import { usePeriod } from '../context/PeriodContext'

/**
 * Selector del período global. Es un <select> nativo (abre el selector del sistema en móvil)
 * con la apariencia de la píldora del header.
 */
export default function PeriodPicker({ className = '' }) {
  const { period, setPeriod, options, label, shortLabel } = usePeriod()

  return (
    <div
      className={`relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/30 hover:bg-white sm:gap-2 ${className}`}
    >
      <CalendarDays className="hidden h-4 w-4 text-emerald-600 min-[400px]:block" aria-hidden="true" />
      <span aria-hidden="true" className="whitespace-nowrap">
        <span className="sm:hidden">{shortLabel}</span>
        <span className="hidden sm:inline">{label}</span>
      </span>
      <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
      <select
        aria-label="Período"
        value={period}
        onChange={(event) => setPeriod(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full text-base opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
