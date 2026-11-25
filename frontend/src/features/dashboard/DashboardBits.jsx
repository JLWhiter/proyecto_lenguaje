// Piezas pequeñas reutilizadas por las tarjetas del Resumen.
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { variationInfo } from './dashboardUtils'

// Monto con "Ocultar montos" ('••••' + "Monto oculto" para lectores de pantalla): el mismo de Movimientos.
export { Amount } from '../transactions/Money'

export const CARD = 'min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6'
export const CARD_TITLE = 'text-xl font-bold text-slate-900 sm:text-2xl'

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
