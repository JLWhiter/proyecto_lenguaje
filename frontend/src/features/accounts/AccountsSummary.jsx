import { Link } from 'react-router-dom'
import { EyeOff, Landmark, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Skeleton } from '../../components/ui'
import { usePreferences } from '../../context/PreferencesContext'
import { toNumber } from '../../lib/format'
import { monthName, shiftMonth } from '../../lib/period'
import Amount from './Amount'
import { useBalanceVariation } from './useAccounts'

function percentOf(part, total) {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, (part / total) * 100))
}

function formatPct(value) {
  if (value > 0 && value < 1) return '<1%'
  return `${Math.round(value)}%`
}

const TREND_CHIPS = {
  up: { className: 'bg-emerald-50 text-emerald-700', Icon: TrendingUp },
  down: { className: 'bg-red-50 text-red-700', Icon: TrendingDown },
  flat: { className: 'bg-slate-100 text-slate-600', Icon: Minus },
}

function trendOf(value) {
  if (value > 0) return 'up'
  return value < 0 ? 'down' : 'flat'
}

/** '+13.6%', '−2%' o '0%' (`null` si no hay porcentaje). */
function formatPctChange(pct) {
  if (pct === null) return null
  if (pct === 0) return '0%'
  const sign = pct > 0 ? '+' : '−'
  return `${sign}${Math.abs(pct).toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`
}

/** "+13.6% vs. cierre de octubre" con el dato real del resumen del mes actual (oculto si no hay con qué comparar). */
function BalanceVariation({ month }) {
  const variation = useBalanceVariation(month)
  const { showAmounts } = usePreferences()
  const previousMonth = monthName(shiftMonth(month, -1)).toLocaleLowerCase('es')

  if (variation.status === 'loading') return <Skeleton className="mt-3 h-7 w-56 max-w-full" />
  if (variation.status !== 'ready') return null

  const { pct } = variation.data
  // Con los saldos ocultos solo mostramos el porcentaje (no revela montos).
  const delta = showAmounts ? variation.data.delta : null
  if (pct === null && delta === null) return null

  const chip = TREND_CHIPS[trendOf(pct ?? delta)]
  const pctText = formatPctChange(pct)

  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${chip.className}`}>
        <chip.Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {pctText ?? <Amount value={delta} signed />}
      </span>
      <span>
        {pctText !== null && delta !== null && (
          <>
            <Amount value={delta} signed className="font-semibold text-slate-600" />{' '}
          </>
        )}
        vs. cierre de {previousMonth}
      </span>
    </p>
  )
}

/** Patrimonio total, variación del mes y reparto entre bancos/billeteras y efectivo. */
export default function AccountsSummary({ data, count, month }) {
  const { showAmounts } = usePreferences()
  const liquidez = toNumber(data.liquidez)
  const efectivo = toNumber(data.efectivo)
  const base = Math.max(0, liquidez) + Math.max(0, efectivo)
  const liquidShare = percentOf(Math.max(0, liquidez), base)
  const cashShare = base > 0 ? 100 - liquidShare : 0

  const rows = [
    { key: 'liquidez', label: 'Bancos y billeteras', value: liquidez, share: liquidShare, dot: 'bg-emerald-500' },
    { key: 'efectivo', label: 'Efectivo', value: efectivo, share: cashShare, dot: 'bg-amber-400' },
  ]

  return (
    <section aria-labelledby="accounts-summary-title" className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-6 xl:grid-cols-2 xl:items-center xl:gap-10">
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <Landmark className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 id="accounts-summary-title" className="text-base font-semibold text-slate-700">
                Patrimonio total
              </h2>
            </div>
            <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {count === 1 ? '1 cuenta' : `${count} cuentas`}
            </span>
          </div>
          <p className="mt-4 break-words text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl xl:text-5xl">
            <Amount value={data.patrimonio} />
          </p>
          <BalanceVariation month={month} />
          {!showAmounts && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              Saldos ocultos en este dispositivo.
              <Link to="/app/configuracion" className="inline-flex min-h-10 items-center font-semibold text-emerald-700 hover:underline">
                Cambiar en Configuración
              </Link>
            </p>
          )}
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-700">¿Dónde está tu dinero?</h3>
          {/* La barra es decorativa; el reparto se lee en este texto (y en la lista de abajo). */}
          <p className="sr-only">{`Bancos y billeteras ${formatPct(liquidShare)}, efectivo ${formatPct(cashShare)}`}</p>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            {base > 0 && (
              <>
                <span className="h-full bg-emerald-500" style={{ width: `${liquidShare}%` }} />
                <span className="h-full bg-amber-400" style={{ width: `${cashShare}%` }} />
              </>
            )}
          </div>
          <dl className="mt-4 space-y-2">
            {rows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3.5 py-3 sm:px-4">
                <dt className="flex min-w-0 items-center gap-2">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.dot}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium leading-5 text-slate-600 sm:text-sm">{row.label}</span>
                    <span className="block text-xs text-slate-400">{formatPct(row.share)} del total</span>
                  </span>
                </dt>
                {/* El monto nunca se parte: si no cabe, es la etiqueta la que pasa a dos líneas. */}
                <dd className="shrink-0 whitespace-nowrap text-right text-sm font-bold text-slate-900 sm:text-base">
                  <Amount value={row.value} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
