import { useId, useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { toNumber } from '../../lib/format'
import { monthLabel } from '../../lib/period'
import { Amount, CARD, CARD_TITLE, VariationBadge } from './DashboardBits'
import { parsePercentText } from './dashboardUtils'
import { useDashboardMoney } from './useDashboardMoney'

const GREEN = '#10B981'

function pointLabel(point) {
  return monthLabel(point?.periodo) || point?.name || ''
}

function BalanceTooltip({ active, payload, format }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
      <p className="font-semibold">{pointLabel(point)}</p>
      <p className="mt-0.5 tabular-nums text-emerald-300">Saldo al cierre: {format(point.value)}</p>
    </div>
  )
}

/** Margen vertical para que la línea no toque los bordes (el eje Y está oculto). */
function yDomain(points) {
  const values = points.map((point) => toNumber(point.value))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min) * 0.15 || Math.abs(max) * 0.1 || 1
  return [min - pad, max + pad]
}

/** Saldo total al cierre de cada mes (hasta 6 meses) terminando en el período elegido. */
export default function BalanceChart({ data }) {
  const gradientId = useId().replace(/:/g, '')
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const { text } = useDashboardMoney()
  const points = useMemo(
    () => (Array.isArray(data.evolucion_saldo) ? data.evolucion_saldo : []).map((point) => ({ ...point, value: toNumber(point.value) })),
    [data.evolucion_saldo],
  )
  const trend = parsePercentText(data.evolucion_tendencia)
  const first = points[0]
  const last = points[points.length - 1]

  // Resumen en texto del gráfico (también para lectores de pantalla, junto a la tabla oculta).
  const summary =
    points.length > 1
      ? `Pasó de ${text(first.value)} en ${pointLabel(first).toLowerCase()} a ${text(last.value)} en ${pointLabel(last).toLowerCase()}.`
      : ''

  return (
    <section aria-labelledby="evolution-title" className={`${CARD} flex flex-col`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="evolution-title" className={CARD_TITLE}>
            Evolución de saldo
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Saldo al cierre de cada mes
            {data.evolucion_periodo && (
              <>
                {' · '}
                <span className="whitespace-nowrap">{String(data.evolucion_periodo).replace(' - ', ' – ')}</span>
              </>
            )}
          </p>
        </div>
        {points.length > 1 && <VariationBadge pct={trend ?? 0} increaseIsGood prefix="Tendencia " />}
      </div>

      {points.length === 1 ? (
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          <p className="font-semibold text-slate-700">Saldo al cierre de {pointLabel(last).toLowerCase()}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            <Amount value={last.value} />
          </p>
          <p className="mt-2">La evolución aparecerá cuando tengas movimientos en más de un mes.</p>
        </div>
      ) : points.length > 1 ? (
        <>
          {/* Desde md la tarjeta se estira a la altura de la de distribución: el gráfico ocupa ese espacio. */}
          <div className="relative mt-5 h-56 sm:h-64 md:h-auto md:min-h-64 md:flex-1" aria-hidden="true">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={points} margin={{ top: 12, right: 14, bottom: 0, left: 14 }} accessibilityLayer={false}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor={GREEN} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={GREEN} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} interval="preserveStartEnd" />
                  <YAxis hide domain={yDomain(points)} />
                  <Tooltip
                    cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }}
                    content={(props) => <BalanceTooltip {...props} format={text} />}
                    wrapperStyle={{ outline: 'none' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Saldo"
                    stroke={GREEN}
                    strokeWidth={3}
                    fill={`url(#${gradientId})`}
                    dot={{ r: 4, fill: '#fff', stroke: GREEN, strokeWidth: 2.5 }}
                    activeDot={{ r: 6, fill: '#fff', stroke: GREEN, strokeWidth: 3 }}
                    isAnimationActive={!reduceMotion}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">{summary}</p>
          <table className="sr-only">
            <caption>Saldo total al cierre de cada mes</caption>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.periodo || point.name}>
                  <th scope="row">{pointLabel(point)}</th>
                  <td>{text(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          <p className="font-semibold text-slate-700">Aún no hay datos para graficar</p>
          <p className="mt-1">El gráfico aparecerá cuando tengas movimientos hasta este mes.</p>
        </div>
      )}
    </section>
  )
}
