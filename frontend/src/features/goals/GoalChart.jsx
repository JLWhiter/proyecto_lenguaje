import { useMemo } from 'react'
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useVisibleMoney } from '../transactions/useVisibleMoney'
import { chartPoints } from './goalModel'

// Verde de la marca para meses con más aportes que retiros; rojo para meses con retiro neto.
const POSITIVE = '#10B981'
const NEGATIVE = '#EF4444'

function MonthTooltip({ active, payload, format }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="font-semibold">{point.name}</p>
      <p className="mt-0.5 tabular-nums">
        {point.value < 0 ? 'Retiro neto' : 'Aporte neto'}: {format(Math.abs(point.value))}
      </p>
    </div>
  )
}

/** Aporte neto (aportes − retiros) de los últimos 12 meses, con una tabla equivalente para lectores de pantalla. */
export default function GoalChart({ series }) {
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const { text } = useVisibleMoney()
  const points = useMemo(() => chartPoints(series), [series])
  const hasData = points.some((point) => point.value !== 0)

  if (!hasData) {
    return (
      <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
        Aún no registras aportes en los últimos 12 meses. El gráfico aparecerá con tu primer aporte.
      </p>
    )
  }

  return (
    <figure className="m-0">
      <div className="h-40 sm:h-44" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap={2} accessibilityLayer={false}>
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis hide />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            <Tooltip cursor={{ fill: '#f1f5f9' }} content={(props) => <MonthTooltip {...props} format={text} />} wrapperStyle={{ outline: 'none' }} />
            <Bar dataKey="value" name="Aporte neto" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={!reduceMotion}>
              {points.map((point) => (
                <Cell key={point.mes} fill={point.value < 0 ? NEGATIVE : POSITIVE} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          Mes con más aportes que retiros
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-red-500" />
          Mes con retiro neto
        </span>
      </figcaption>
      <table className="sr-only">
        <caption>Aporte neto de los últimos 12 meses</caption>
        <thead>
          <tr>
            <th scope="col">Mes</th>
            <th scope="col">Aporte neto</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.mes}>
              <th scope="row">{point.name}</th>
              <td>{text(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
