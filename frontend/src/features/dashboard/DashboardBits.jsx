// Piezas pequeñas reutilizadas por las tarjetas del Resumen.
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { HIDDEN_AMOUNT, variationInfo } from './dashboardUtils'
import { useDashboardMoney } from './useDashboardMoney'

export const CARD = 'min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6'
export const CARD_TITLE = 'text-xl font-bold text-slate-900 sm:text-2xl'

/** Monto con `tabular-nums`; '••••' (y "Monto oculto" para lectores de pantalla) si los montos están ocultos. */
export function Amount({ value, signed = false, className = '' }) {
  const { hidden, text, signedText } = useDashboardMoney()
  if (hidden) {
    return (
      <span className={className}>
        <span aria-hidden="true">{HIDDEN_AMOUNT}</span>
        <span className="sr-only">Monto oculto</span>
      </span>
    )
  }
  return <span className={`tabular-nums ${className}`}>{signed ? signedText(value) : text(value)}</span>
}

/** Píldora de variación: flecha y color según el signo (y si subir es bueno o malo). */
export function VariationBadge({ pct, increaseIsGood = true, prefix = '', className = '' }) {
  const info = variationInfo(pct, { increaseIsGood })
  const Icon = info.Icon
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${info.className} ${className}`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
      <span aria-hidden="true">
        {prefix}
        {info.text}
      </span>
      <span className="sr-only">
        {prefix}
        {info.srText}
      </span>
    </span>
  )
}

/** Enlace de texto con flecha (área táctil ≥ 40 px). */
export function CardLink({ to, children, className = '', ...props }) {
  return (
    <Link
      to={to}
      className={`inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline ${className}`}
      {...props}
    >
      {children}
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  )
}
