import { toNumber } from '../../lib/format'

/**
 * Barra de progreso accesible. El ancho se limita a 0–100 %.
 *   <ProgressBar value={81.25} label="Presupuesto consumido" className="h-3 bg-amber-100" barClassName="bg-amber-500" />
 *
 * La semántica la da un <progress> nativo (solo para lectores de pantalla); la barra visible es
 * decorativa para conservar el diseño (un <progress> no se puede estilizar igual en todos los navegadores).
 */
export default function ProgressBar({ value, max = 100, label, className = 'h-3 bg-slate-100', barClassName = 'bg-emerald-500' }) {
  const percent = Math.min(100, Math.max(0, (toNumber(value) / (toNumber(max) || 100)) * 100))
  return (
    <div className={`overflow-hidden rounded-full ${className}`}>
      <progress className="sr-only" aria-label={label} max={100} value={Math.round(percent)} />
      <div aria-hidden="true" className={`h-full rounded-full transition-[width] duration-500 ${barClassName}`} style={{ width: `${percent}%` }} />
    </div>
  )
}
