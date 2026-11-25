import { toNumber } from '../../lib/format'

/**
 * Barra de progreso accesible. El ancho se limita a 0–100 %.
 *   <ProgressBar value={81.25} label="Presupuesto consumido" className="h-3 bg-amber-100" barClassName="bg-amber-500" />
 */
export default function ProgressBar({ value, max = 100, label, className = 'h-3 bg-slate-100', barClassName = 'bg-emerald-500' }) {
  const percent = Math.min(100, Math.max(0, (toNumber(value) / (toNumber(max) || 100)) * 100))
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className={`overflow-hidden rounded-full ${className}`}
    >
      <div className={`h-full rounded-full transition-[width] duration-500 ${barClassName}`} style={{ width: `${percent}%` }} />
    </div>
  )
}
