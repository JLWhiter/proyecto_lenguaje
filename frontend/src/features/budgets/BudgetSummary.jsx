import { CalendarCheck2, CalendarClock, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { ProgressBar } from '../../components/ui'
import { usePreferences } from '../../context/PreferencesContext'
import { useMoney } from '../../hooks/useMoney'
import { toNumber } from '../../lib/format'
import { formatPct, stateForPercentage, stylesFor, SUMMARY_STATE_LABEL } from './budgetModel'
import Money from './Money'

/** Consumo total del mes: estado por porcentaje, gastado / asignado / disponible, días y proyección. */
export default function BudgetSummary({ summary, phase, count, periodLabel }) {
  const percentage = toNumber(summary?.porcentaje)
  const state = stateForPercentage(percentage)
  const styles = stylesFor(state)
  const remaining = toNumber(summary?.restante)
  const over = remaining < 0

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="budget-summary-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="budget-summary-title" className="text-lg font-semibold text-slate-900">
              Consumo total del mes
            </h2>
            <p className="text-sm text-slate-500">
              {count === 1 ? '1 presupuesto' : `${count} presupuestos`} · {periodLabel}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
          {SUMMARY_STATE_LABEL[state]} · {formatPct(percentage)}
        </span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-sm text-slate-500">Gastado</dt>
          <dd className="mt-1 break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            <Money value={summary?.total_consumido} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sm text-slate-500">Asignado</dt>
          <dd className="mt-1 break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            <Money value={summary?.total_asignado} />
          </dd>
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className="text-sm text-slate-500">{over ? 'Te pasaste por' : 'Disponible'}</dt>
          <dd className={`mt-1 break-words text-xl font-bold tracking-tight sm:text-2xl ${over ? 'text-red-600' : 'text-emerald-700'}`}>
            <Money value={remaining} absolute />
          </dd>
        </div>
      </dl>

      <ProgressBar
        value={percentage}
        label={`Consumo total del mes: ${formatPct(percentage)}`}
        className={`mt-5 h-3 ${styles.track}`}
        barClassName={styles.bar}
      />

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-slate-600">
        <span>
          <span className={`font-semibold tabular-nums ${styles.text}`}>{formatPct(percentage)}</span> del total asignado
        </span>
        <DaysLeft phase={phase} days={toNumber(summary?.dias_restantes)} />
      </div>

      {phase === 'current' && <ProjectionLine summary={summary} />}
    </section>
  )
}

function DaysLeft({ phase, days }) {
  if (phase === 'past') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <CalendarCheck2 className="h-4 w-4 text-slate-400" aria-hidden="true" />
        Mes cerrado
      </span>
    )
  }
  if (phase === 'future') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden="true" />
        Aún no empieza
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden="true" />
      {days <= 1 ? 'Hoy cierra el mes' : `Quedan ${days} días`}
    </span>
  )
}

/** Proyección al cierre del mes en curso frente al total asignado. */
function ProjectionLine({ summary }) {
  const { money } = useMoney()
  const { showAmounts } = usePreferences()
  const projected = toNumber(summary?.proyeccion)
  const limit = toNumber(summary?.total_asignado)
  if (limit <= 0) return null

  const ratio = (projected / limit) * 100
  const overBy = projected - limit
  const tone =
    overBy > 0 ? 'border-red-200 bg-red-50 text-red-800' : ratio >= 90 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'
  const Icon = overBy > 0 ? TrendingUp : TrendingDown

  let text
  if (!showAmounts) {
    text = overBy > 0 ? 'Al ritmo actual superarías tu presupuesto total.' : 'Al ritmo actual cerrarías el mes dentro de tu presupuesto total.'
  } else if (overBy > 0) {
    text = `Al ritmo actual cerrarías el mes en ${money(projected)}: ${money(overBy)} por encima de lo asignado.`
  } else {
    text = `Al ritmo actual cerrarías el mes en ${money(projected)} (${formatPct(ratio)} de lo asignado) y te sobrarían ${money(-overBy)}.`
  }

  return (
    <p className={`mt-4 flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-6 ${tone}`}>
      <Icon className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="font-semibold">Proyección: </span>
        {text}
      </span>
    </p>
  )
}
