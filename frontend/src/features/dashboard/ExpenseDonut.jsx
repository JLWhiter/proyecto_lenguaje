import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { formatPercent, toNumber } from '../../lib/format'
import { monthLabel } from '../../lib/period'
import { Amount, CARD, CARD_TITLE } from './DashboardBits'
import { movementsLink } from './dashboardUtils'
import { useDashboardMoney } from './useDashboardMoney'

const OTHERS = 'otras categorías'

function DonutTooltip({ active, payload, format }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="font-semibold">{item.name}</p>
      <p className="mt-0.5 tabular-nums">
        {format(item.monto)} · {formatPercent(item.value, { digits: 1 })}
      </p>
    </div>
  )
}

/** Gastos del período por categoría (top 5 + "Otras categorías"), con el total gastado al centro. */
export default function ExpenseDonut({ data, period, canRegister, onRegisterExpense }) {
  const { text } = useDashboardMoney()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const items =(Array.isArray(data.distribucion_gastos) ? data.distribucion_gastos : []).map((item) => ({
    ...item,
    monto: toNumber(item.monto),
    value: toNumber(item.value),
  }))
  const total = text(data.gastos_mensuales)
  const periodText = monthLabel(period)

  return (
    <section aria-labelledby="distribution-title" className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="distribution-title" className={CARD_TITLE}>
            Distribución de gastos
          </h2>
          <p className="mt-1 text-sm text-slate-500">Por categoría · {periodText}</p>
        </div>
        {items.length > 0 && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {items.length} {items.length === 1 ? 'categoría' : 'categorías'}
          </span>
        )}
      </div>

      {items.length > 0 ? (
        <div className="mt-5 flex flex-col items-center gap-5 xl:flex-row xl:items-center">
          <div className="relative h-52 w-52 shrink-0">
            <div className="h-full w-full" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer={false}>
                  <Pie
                    data={items}
                    dataKey="monto"
                    nameKey="name"
                    innerRadius={66}
                    outerRadius={98}
                    startAngle={90}
                    endAngle={-270}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={3}
                    rootTabIndex={-1}
                    isAnimationActive={!reduceMotion}
                  >
                    {items.map((item) => (
                      <Cell key={item.name} fill={item.color || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip content={(props) => <DonutTooltip {...props} format={text} />} wrapperStyle={{ outline: 'none', zIndex: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
              <span className="text-xs font-medium text-slate-500">Total gastado</span>
              <span className={`mt-0.5 max-w-full break-words font-bold leading-tight text-slate-900 ${total.length > 12 ? 'text-sm' : 'text-lg'}`}>
                <Amount value={data.gastos_mensuales} />
              </span>
            </div>
          </div>

          <ul className="w-full min-w-0 space-y-1" aria-label={`Gastos por categoría en ${periodText}`}>
            {items.map((item) => {
              const isOthers = item.name.toLocaleLowerCase('es') === OTHERS
              return (
                <li key={item.name}>
                  <Link
                    to={movementsLink(period, { tipo: 'GASTO', categoria: isOthers ? '' : item.name })}
                    className="flex min-h-11 items-start gap-3 rounded-xl px-3 py-1.5 transition hover:bg-slate-50"
                  >
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: item.color || '#94a3b8' }} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 break-words text-sm font-medium text-slate-700">{item.name}</span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-500">{formatPercent(item.value, { digits: 1 })}</span>
                      </span>
                      <Amount value={item.monto} className="block text-sm font-semibold text-slate-900" />
                    </span>
                    <span className="sr-only">(ver movimientos)</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          <p className="font-semibold text-slate-700">Sin gastos en {periodText}</p>
          <p className="mt-1">Cuando registres gastos verás aquí en qué se va tu dinero.</p>
          {canRegister && (
            <button
              type="button"
              onClick={onRegisterExpense}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Plus className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Registrar gasto
            </button>
          )}
        </div>
      )}
    </section>
  )
}
