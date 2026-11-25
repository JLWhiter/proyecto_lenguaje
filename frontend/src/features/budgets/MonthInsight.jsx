import { AlertTriangle, ArrowRightLeft, CheckCircle2, Info, Lightbulb, SlidersHorizontal } from 'lucide-react'
import { usePreferences } from '../../context/PreferencesContext'
import { maskAmounts } from './budgetModel'

const TONES = {
  success: { card: 'border-emerald-200 bg-emerald-50/70', tile: 'bg-emerald-100 text-emerald-700', eyebrow: 'text-emerald-700', Icon: CheckCircle2 },
  warning: { card: 'border-amber-200 bg-amber-50/70', tile: 'bg-amber-100 text-amber-700', eyebrow: 'text-amber-700', Icon: AlertTriangle },
  danger: { card: 'border-red-200 bg-red-50/70', tile: 'bg-red-100 text-red-700', eyebrow: 'text-red-700', Icon: AlertTriangle },
  info: { card: 'border-sky-200 bg-sky-50/70', tile: 'bg-sky-100 text-sky-700', eyebrow: 'text-sky-700', Icon: Info },
}

/**
 * "Análisis del mes": el `ia_alert` que calcula el backend con reglas sobre tus presupuestos
 * y movimientos (no es texto fijo). Se oculta si viene vacío (sin presupuestos o mes futuro).
 * Con `accion` de tipo rebalance y `canApply`, ofrece "Aplicar sugerencia" y "Ajustar monto".
 */
export default function MonthInsight({ insight, canApply, applying = false, onApply, onAdjust, className = '' }) {
  const { showAmounts } = usePreferences()
  if (!insight?.titulo) return null

  const tone = TONES[insight.nivel] ?? TONES.info
  const action = insight.accion?.type === 'rebalance' ? insight.accion : null
  const showActions = canApply && action
  const text = (value) => (showAmounts ? value : maskAmounts(value))

  return (
    <section aria-labelledby="budget-insight-title" className={`rounded-[28px] border p-4 shadow-sm sm:p-6 ${tone.card} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${tone.tile}`}>
          <tone.Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-bold uppercase tracking-[0.16em] ${tone.eyebrow}`}>Análisis del mes</p>
          <h2 id="budget-insight-title" className="mt-1 break-words text-lg font-semibold leading-snug text-slate-900">
            {insight.titulo}
          </h2>
          {insight.resumen && <p className="mt-2 text-sm leading-6 text-slate-700">{text(insight.resumen)}</p>}
        </div>
      </div>

      {insight.sugerencia && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700 ring-1 ring-slate-900/5">
          <Lightbulb className="mt-1 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <p className="min-w-0">
            <span className="font-semibold text-slate-900">Sugerencia: </span>
            {text(insight.sugerencia)}
          </p>
        </div>
      )}

      {showActions && (
        <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => onApply(action)}
            aria-disabled={applying || undefined}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 aria-disabled:cursor-wait aria-disabled:opacity-60"
          >
            <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
            {applying ? 'Aplicando…' : 'Aplicar sugerencia'}
          </button>
          <button
            type="button"
            onClick={() => onAdjust(action)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Ajustar monto
          </button>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-slate-500">Calculado con tus presupuestos y los gastos que registraste en Movimientos.</p>
    </section>
  )
}
