import { Link } from 'react-router-dom'
import { Plus, Target, TrendingDown, TrendingUp } from 'lucide-react'
import { ProgressBar } from '../../components/ui'
import { formatPercent, toNumber } from '../../lib/format'
import { monthPhrase } from '../../lib/period'
import { Amount, CardLink, VariationBadge } from './DashboardBits'
import { budgetTone, movementsLink, previousMonthText } from './dashboardUtils'

const STAT_CARD = 'flex min-w-0 flex-col rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5'

const FLOWS = {
  income: {
    title: 'Ingresos del mes',
    Icon: TrendingUp,
    icon: 'bg-emerald-50 text-emerald-600',
    field: 'ingresos_mensuales',
    pct: 'ingresos_variacion_pct',
    increaseIsGood: true,
    tipo: 'INGRESO',
    link: 'Ver ingresos',
  },
  expense: {
    title: 'Gastos del mes',
    Icon: TrendingDown,
    icon: 'bg-red-50 text-red-600',
    field: 'gastos_mensuales',
    pct: 'gastos_variacion_pct',
    // Gastar más que el mes anterior es malo: ↑ en rojo, ↓ en verde.
    increaseIsGood: false,
    tipo: 'GASTO',
    link: 'Ver gastos',
  },
}

/** Ingresos o gastos del período con su variación frente al mes anterior. */
export function FlowCard({ kind, data, period }) {
  const flow = FLOWS[kind]
  const Icon = flow.Icon
  const titleId = `flow-${kind}-title`
  return (
    <section aria-labelledby={titleId} className={STAT_CARD}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-base font-semibold text-slate-700">
          {flow.title}
        </h2>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${flow.icon}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-4 min-w-0 break-words text-3xl font-bold tracking-tight text-slate-900">
        <Amount value={data[flow.field]} />
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <VariationBadge pct={data[flow.pct]} increaseIsGood={flow.increaseIsGood} />
        <span>vs. {previousMonthText(period)}</span>
      </p>
      <div className="mt-auto pt-2">
        <CardLink to={movementsLink(period, { tipo: flow.tipo })}>{flow.link}</CardLink>
      </div>
    </section>
  )
}

/** Consumo del presupuesto del mes (suma de todos los presupuestos por categoría). */
export function BudgetCard({ data, period, search, className = '' }) {
  const limit = toNumber(data.presupuesto_limite)
  const budgetsLink = { pathname: '/app/presupuestos', search }

  if (limit <= 0) {
    return (
      <section aria-labelledby="budget-title" className={`${STAT_CARD} ${className}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 id="budget-title" className="text-base font-semibold text-slate-700">
            Presupuesto del mes
          </h2>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Target className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-500">
          Aún no tienes presupuestos para {monthPhrase(period)}. Pon un límite por categoría y te avisaremos antes de pasarte.
        </p>
        <div className="mt-auto pt-4">
          <Link
            to={budgetsLink}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Crear presupuesto
          </Link>
        </div>
      </section>
    )
  }

  const percentage = toNumber(data.presupuesto_porcentaje)
  const remaining = toNumber(data.presupuesto_restante)
  const tone = budgetTone(percentage)

  return (
    <section aria-labelledby="budget-title" className={`${STAT_CARD} ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="budget-title" className="text-base font-semibold text-slate-700">
          Presupuesto del mes
        </h2>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tone.chip}`}>{tone.label}</span>
      </div>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
        <span className={`text-3xl font-bold tracking-tight tabular-nums ${tone.text}`}>{formatPercent(percentage, { digits: 1 })}</span>
        <span className="text-sm text-slate-500">usado</span>
      </p>
      <ProgressBar
        value={percentage}
        label={`Presupuesto consumido: ${formatPercent(percentage, { digits: 1 })}`}
        className={`mt-3 h-3 ${tone.track}`}
        barClassName={tone.bar}
      />
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0">
          <dt className="text-slate-500">Gastado</dt>
          <dd className="break-words font-semibold text-slate-800">
            <Amount value={data.presupuesto_consumido} />
            <span className="block text-xs font-normal text-slate-500">
              de <Amount value={limit} />
            </span>
          </dd>
        </div>
        <div className="min-w-0 text-right">
          <dt className="text-slate-500">{remaining < 0 ? 'Te pasaste por' : 'Te quedan'}</dt>
          <dd className={`break-words font-semibold ${remaining < 0 ? 'text-red-600' : 'text-slate-800'}`}>
            <Amount value={Math.abs(remaining)} />
          </dd>
        </div>
      </dl>
      <div className="mt-auto pt-2">
        <CardLink to={budgetsLink}>Ver presupuestos</CardLink>
      </div>
    </section>
  )
}
