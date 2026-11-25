import { useMemo, useState } from 'react'
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  PiggyBank,
  Plus,
  Sparkles,
  Target,
  TrendingDown,
  Wallet,
} from 'lucide-react'
import CategoryIcon from '../../components/finance/CategoryIcon'
import { EmptyState, ErrorState, FilterChips, IconButton, PageSkeleton, parseCountLabel, ProgressBar } from '../../components/ui'
import { usePeriod, useShiftPeriod } from '../../context/PeriodContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useMoney } from '../../hooks/useMoney'
import { formatPercent } from '../../lib/format'
import { useExportTransactions } from '../transactions/useExportTransactions'
import { AdjustBudgetDialog, BudgetDialog, RebalanceDialog } from './BudgetDialogs'
import { useBudgets } from './useBudgets'

// Clave de filtro (texto del backend sin contador) → color del presupuesto.
const FILTER_COLORS = { Normal: 'green', Precaución: 'amber', Crítico: 'red' }

const COLOR_STYLES = {
  red: { icon: 'bg-red-50 text-red-600', badge: 'bg-red-100 text-red-700', text: 'text-red-600', bar: 'bg-red-500' },
  amber: { icon: 'bg-amber-50 text-amber-600', badge: 'bg-amber-100 text-amber-700', text: 'text-amber-600', bar: 'bg-amber-500' },
  green: { icon: 'bg-emerald-50 text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-600', bar: 'bg-emerald-500' },
}

function statusLabel(percentage) {
  if (percentage >= 90) return '• Crítico'
  if (percentage >= 75) return '• Precaución'
  return '• En control'
}

export default function BudgetsPage() {
  useDocumentTitle('Presupuestos')
  const { period, label: periodLabel } = usePeriod()
  const shiftPeriod = useShiftPeriod()
  const { money } = useMoney()
  const budgets = useBudgets(period)
  const { exportCsv } = useExportTransactions()
  const [filter, setFilter] = useState('Todos')
  const [insightDismissed, setInsightDismissed] = useState(false)
  const [dialog, setDialog] = useState(null)

  const data = budgets.data
  const categories = data?.categorias ?? []
  const filterOptions = useMemo(
    () => (data?.filtros ?? []).map((text) => ({ key: parseCountLabel(text).key, label: text })),
    [data?.filtros],
  )
  const visible = categories.filter((item) => !FILTER_COLORS[filter] || item.color === FILTER_COLORS[filter])
  const summary = data?.summary

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">GESTIÓN DE FINANZAS</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Presupuestos Mensuales</h1>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ type: 'budget' })}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#10B981] px-4 py-3 text-sm font-semibold text-white hover:bg-[#059669] sm:self-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo Presupuesto
        </button>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2 text-slate-700 sm:justify-center sm:gap-4">
          <IconButton label="Mes anterior" onClick={() => shiftPeriod(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <div className="flex min-w-0 items-center gap-2 text-lg font-semibold" aria-live="polite">
            <CalendarDays className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <span className="truncate">{periodLabel}</span>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 sm:inline">Período seleccionado</span>
          <IconButton label="Mes siguiente" onClick={() => shiftPeriod(1)}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {budgets.status === 'loading' && <PageSkeleton title={false} stats={0} blocks={3} label="Cargando presupuestos" />}

      {budgets.status === 'error' && (
        <ErrorState title="No pudimos cargar tus presupuestos" error={budgets.error} onRetry={budgets.reload} />
      )}

      {budgets.status === 'ready' && (
        <>
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="budget-summary-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Wallet className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 id="budget-summary-title" className="text-lg font-semibold text-slate-900">
                  Consumo Total del Mes
                </h2>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {statusLabel(summary.porcentaje)} ({formatPercent(summary.porcentaje)})
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <p className="text-sm text-slate-500">Gasto Total Acumulado</p>
                <p className="mt-2 break-words text-2xl font-bold text-slate-900">{money(summary.total_consumido)}</p>
              </div>
              <div className="min-w-0 text-right md:text-left">
                <p className="text-sm text-slate-500">Presupuesto Asignado</p>
                <p className="mt-2 break-words text-2xl font-bold text-slate-900 md:text-right">{money(summary.total_asignado)}</p>
              </div>
            </div>

            <ProgressBar
              value={summary.porcentaje}
              label="Consumo total del mes"
              className="mt-5 h-3 bg-amber-100"
              barClassName="bg-gradient-to-r from-amber-400 to-orange-500"
            />

            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
              <span>Consumido: {formatPercent(summary.porcentaje)}</span>
              <span>Quedan {summary.dias_restantes} días</span>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-emerald-700">
                <PiggyBank className="h-4 w-4" aria-hidden="true" />
                <span>Dinero Restante Disponible:</span>
              </div>
              <span className="text-lg font-bold text-emerald-700">{money(summary.restante)}</span>
            </div>
          </section>

          {categories.length > 0 && !insightDismissed && (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">Alerta de Ritmo de Gasto</h3>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">IA Finova</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{data.ia_alert?.resumen}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={() => setDialog({ type: 'rebalance' })}
                      className="min-h-10 font-semibold text-slate-700 underline underline-offset-2"
                    >
                      Rebalancear Presupuesto
                    </button>
                    <span className="text-slate-400" aria-hidden="true">
                      •
                    </span>
                    <button type="button" onClick={() => setInsightDismissed(true)} className="min-h-10 font-medium text-slate-500 hover:text-slate-700">
                      Descartar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {filterOptions.length > 0 && (
            <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <FilterChips label="Filtrar presupuestos por estado" options={filterOptions} value={filter} onChange={setFilter} />
            </div>
          )}

          <div className="space-y-5">
            {visible.map((item) => {
              const style = COLOR_STYLES[item.color] ?? COLOR_STYLES.green
              return (
                <article key={item.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.icon}`}>
                        <CategoryIcon name={item.icon} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words text-xl font-bold text-slate-900">{item.nombre}</h3>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${style.badge}`}>• {item.badge}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{item.descripcion}</p>
                      </div>
                    </div>
                    <IconButton
                      label={`Ajustar presupuesto de ${item.nombre}`}
                      variant="ghost"
                      onClick={() => setDialog({ type: 'adjust', budget: item })}
                    >
                      <MoreVertical className="h-5 w-5" />
                    </IconButton>
                  </div>

                  <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="min-w-0">
                      <dt className="text-xs uppercase tracking-[0.15em] text-slate-400">Presupuestado</dt>
                      <dd className="mt-1 break-words text-base font-semibold text-slate-800">{money(item.presupuesto)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs uppercase tracking-[0.15em] text-slate-400">Gastado</dt>
                      <dd className="mt-1 break-words text-base font-semibold text-slate-800">{money(item.gastado)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs uppercase tracking-[0.15em] text-slate-400">Restante</dt>
                      <dd className="mt-1 break-words text-base font-semibold text-emerald-700">{money(item.restante)}</dd>
                    </div>
                  </dl>

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                      <span>Consumido</span>
                      <span className={style.text}>{formatPercent(item.porcentaje)}</span>
                    </div>
                    <ProgressBar value={item.porcentaje} label={`Consumo de ${item.nombre}`} className="h-3 bg-slate-100" barClassName={style.bar} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                    <div className="flex min-w-0 items-center gap-2">
                      {item.color === 'green' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                      ) : item.color === 'red' ? (
                        <TrendingDown className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                      ) : (
                        <Activity className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                      )}
                      <span>{item.detalle}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDialog({ type: 'adjust', budget: item })}
                      className="min-h-10 font-semibold text-emerald-700 hover:underline"
                    >
                      {item.color === 'green' ? 'Detalles' : 'Ajustar'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {categories.length === 0 && (
            <EmptyState
              icon={Target}
              title="Todavía no tienes presupuestos"
              description="Crea uno para empezar a planificar tus gastos para este mes."
              action={
                <button
                  type="button"
                  onClick={() => setDialog({ type: 'budget' })}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Crear presupuesto
                </button>
              }
            />
          )}

          {categories.length > 0 && (
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">Consejos de Optimización Finova</h3>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">
                Podrías transferir S/ 150.00 del presupuesto no utilizado en Salud hacia Alimentación para cerrar el mes sin caer en sobregiro
                patrimonial.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setDialog({ type: 'rebalance' })}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Rebalancear Automático
                </button>
                <button type="button" onClick={exportCsv} className="rounded-xl px-2 py-2 text-sm font-semibold text-emerald-700 hover:underline">
                  Ver análisis completo
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {dialog?.type === 'budget' && <BudgetDialog onClose={() => setDialog(null)} />}
      {dialog?.type === 'adjust' && <AdjustBudgetDialog budget={dialog.budget} onClose={() => setDialog(null)} />}
      {dialog?.type === 'rebalance' && <RebalanceDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
