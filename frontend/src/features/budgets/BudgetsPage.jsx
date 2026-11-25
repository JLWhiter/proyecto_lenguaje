import { useMemo, useRef, useState } from 'react'
import { ArrowRightLeft, ChevronLeft, ChevronRight, Copy, Plus, RotateCw, SearchX, Target } from 'lucide-react'
import { EmptyState, ErrorState, FilterChips, IconButton, Skeleton } from '../../components/ui'
import { usePeriod } from '../../context/PeriodContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { monthLabel, shiftMonth } from '../../lib/period'
import BudgetCard from './BudgetCard'
import { BudgetFormDialog, RebalanceDialog } from './BudgetDialogs'
import { BUDGET_STATES, FILTER_ALL, freeMargin, lastPlannableMonth, movementsSearch, periodPhase, stateOf, stylesFor } from './budgetModel'
import BudgetSummary from './BudgetSummary'
import MonthInsight from './MonthInsight'
import { useBudgetActions, useBudgetHighlight, useBudgets } from './useBudgets'

const PRIMARY_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#10B981] px-4 py-2 text-center text-sm font-semibold leading-5 text-white shadow-sm shadow-emerald-200 hover:bg-[#059669] aria-disabled:cursor-wait aria-disabled:opacity-60'
const SECONDARY_BUTTON =
  'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold leading-5 text-slate-700 hover:bg-slate-50 aria-disabled:cursor-wait aria-disabled:opacity-60'

const PHASE_BADGE = {
  past: { label: 'Mes cerrado', className: 'bg-slate-100 text-slate-600' },
  current: { label: 'Mes en curso', className: 'bg-emerald-50 text-emerald-700' },
  future: { label: 'Planificación', className: 'bg-sky-50 text-sky-700' },
}

export default function BudgetsPage() {
  useDocumentTitle('Presupuestos')
  const { period, setPeriod, label: periodLabel, search, defaultPeriod } = usePeriod()
  const phase = periodPhase(period, defaultPeriod)
  const previousMonth = shiftMonth(period, -1)
  const previousLabel = monthLabel(previousMonth)
  const lastMonth = lastPlannableMonth(defaultPeriod)
  const canGoNext = period < lastMonth

  const budgets = useBudgets(period)
  const actions = useBudgetActions({ period, periodLabel })
  const [filter, setFilter] = useState(FILTER_ALL)
  const [dialog, setDialog] = useState(null)
  const listTitleRef = useRef(null)
  const closeDialog = () => setDialog(null)

  const ready = budgets.status === 'ready'
  const data = budgets.data
  const items = useMemo(() => data?.categorias ?? [], [data])
  const isEmpty = ready && items.length === 0
  const canRebalance = items.length >= 2 && phase !== 'past'

  // Solo se pide el mes anterior cuando este está vacío (para ofrecer copiarlo).
  const previous = useBudgets(previousMonth, { enabled: isEmpty })
  const previousCount = previous.status === 'ready' && previous.data ? (previous.data.categorias ?? []).length : null

  const highlightId = useBudgetHighlight({
    items,
    ready,
    periodLabel,
    onReveal: (budget) => {
      if (filter !== FILTER_ALL && stateOf(budget) !== filter) setFilter(FILTER_ALL)
    },
  })

  const counts = useMemo(() => {
    const result = { [FILTER_ALL]: items.length }
    for (const state of BUDGET_STATES) result[state.key] = 0
    for (const item of items) result[stateOf(item)] = (result[stateOf(item)] ?? 0) + 1
    return result
  }, [items])

  const filterOptions = [
    { key: FILTER_ALL, label: <ChipLabel text="Todos" count={counts[FILTER_ALL]} /> },
    ...BUDGET_STATES.map((state) => ({
      key: state.key,
      label: <ChipLabel text={state.label} count={counts[state.key]} dot={stylesFor(state.key).dot} />,
    })),
  ]
  const visible = filter === FILTER_ALL ? items : items.filter((item) => stateOf(item) === filter)
  const activeFilterLabel = BUDGET_STATES.find((state) => state.key === filter)?.label

  function openCreate() {
    setDialog({ type: 'form' })
  }

  function openRebalance(initial = null) {
    setDialog({ type: 'rebalance', initial })
  }

  function openMoveFor(budget) {
    // Con margen libre, este presupuesto cede saldo; sin margen, lo recibe del que más tenga.
    openRebalance(freeMargin(budget) > 0 ? { source: budget.nombre } : { target: budget.nombre })
  }

  async function handleDelete(budget) {
    const deleted = await actions.remove(budget)
    if (deleted) listTitleRef.current?.focus({ preventScroll: true })
  }

  const copying = actions.pending?.type === 'copy'
  const applying = actions.pending?.type === 'apply'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900">Presupuestos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Define cuánto quieres gastar por categoría cada mes. Lo gastado se calcula con los gastos que registras en Movimientos.
          </p>
        </div>
        {!isEmpty && (
          <button type="button" onClick={openCreate} className={`${PRIMARY_BUTTON} shrink-0 self-start whitespace-nowrap sm:self-auto`}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo presupuesto
          </button>
        )}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <IconButton label={`Ir a ${previousLabel}`} onClick={() => setPeriod(previousMonth)}>
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <div className="min-w-0 flex-1 text-center md:flex-none md:text-left" aria-live="polite">
              <p className="truncate text-lg font-semibold text-slate-900">{periodLabel}</p>
              <span className={`mt-0.5 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${PHASE_BADGE[phase].className}`}>
                {PHASE_BADGE[phase].label}
              </span>
            </div>
            <IconButton
              label={canGoNext ? `Ir a ${monthLabel(shiftMonth(period, 1))}` : `Puedes planificar hasta ${monthLabel(lastMonth)}`}
              onClick={() => setPeriod(shiftMonth(period, 1))}
              disabled={!canGoNext}
            >
              <ChevronRight className="h-4 w-4" />
            </IconButton>
          </div>

          {ready && items.length > 0 && (phase !== 'past' || canRebalance) && (
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap md:justify-end">
              {phase !== 'past' && (
                <button
                  type="button"
                  onClick={() => !copying && actions.copyFrom(previousMonth)}
                  aria-disabled={copying || undefined}
                  className={SECONDARY_BUTTON}
                  title={`Copia los presupuestos de ${previousLabel} que aún no tengas en ${periodLabel}`}
                >
                  <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{copying ? 'Copiando…' : `Copiar de ${previousLabel}`}</span>
                </button>
              )}
              {canRebalance && (
                <button type="button" onClick={() => openRebalance()} className={SECONDARY_BUTTON}>
                  <ArrowRightLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Mover saldo</span>
                </button>
              )}
            </div>
          )}
        </div>
        {phase === 'past' && ready && items.length > 0 && (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
            Estás viendo un mes cerrado: sirve de referencia. Puedes corregir límites, pero las sugerencias y el rebalanceo solo aplican al mes en curso o a
            los que planificas.
          </p>
        )}
      </div>

      {budgets.status === 'loading' && <BudgetsSkeleton />}

      {budgets.status === 'error' && (
        <ErrorState title="No pudimos cargar tus presupuestos" error={budgets.error} onRetry={budgets.reload} />
      )}

      {ready && budgets.error && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>No pudimos actualizar tus presupuestos; puede que veas datos de hace un momento.</span>
          <button type="button" onClick={budgets.reload} className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-amber-900 hover:underline">
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      )}

      {isEmpty && (
        <EmptyState
          icon={Target}
          title={`Aún no tienes presupuestos para ${periodLabel}`}
          description={
            previousCount > 0
              ? `En ${previousLabel} tenías ${previousCount === 1 ? '1 presupuesto' : `${previousCount} presupuestos`}. Cópialos para empezar con los mismos límites o crea uno nuevo.`
              : previousCount === 0
                ? `${previousLabel} tampoco tiene presupuestos. Crea uno por categoría para controlar cuánto gastas.`
                : 'Crea un presupuesto por categoría para controlar cuánto gastas, o copia los del mes anterior.'
          }
          action={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-center">
              {previousCount !== 0 && (
                <button
                  type="button"
                  onClick={() => !copying && actions.copyFrom(previousMonth)}
                  aria-disabled={copying || undefined}
                  className={PRIMARY_BUTTON}
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {copying ? 'Copiando…' : `Copiar presupuestos de ${previousLabel}`}
                </button>
              )}
              <button type="button" onClick={openCreate} className={previousCount === 0 ? PRIMARY_BUTTON : SECONDARY_BUTTON}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Crear presupuesto
              </button>
            </div>
          }
          className="py-10"
        />
      )}

      {ready && items.length > 0 && (
        <>
          <div className={`grid gap-6 ${data?.ia_alert?.titulo ? 'xl:grid-cols-2' : ''}`}>
            <BudgetSummary summary={data.summary} phase={phase} count={items.length} periodLabel={periodLabel} />
            <MonthInsight
              insight={data.ia_alert}
              canApply={phase !== 'past' && items.length >= 2}
              applying={applying}
              onApply={(action) => !applying && actions.applySuggestion(action)}
              onAdjust={(action) => openRebalance({ source: action.source_category, target: action.target_category, amount: action.amount })}
            />
          </div>

          <section aria-labelledby="budgets-list-title" className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h2 id="budgets-list-title" ref={listTitleRef} tabIndex={-1} className="text-xl font-bold text-slate-900 outline-none">
                Tus presupuestos
              </h2>
              <FilterChips
                label="Filtrar presupuestos por estado"
                options={filterOptions}
                value={filter}
                onChange={setFilter}
                chipClassName="px-2.5 sm:px-3"
              />
            </div>

            {visible.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title={`Ningún presupuesto en estado ${activeFilterLabel ?? filter}`}
                description={`En ${periodLabel} no hay presupuestos con ese estado.`}
                action={
                  <button type="button" onClick={() => setFilter(FILTER_ALL)} className={SECONDARY_BUTTON}>
                    Ver todos
                  </button>
                }
              />
            ) : (
              <ul className="grid gap-4 xl:grid-cols-2">
                {visible.map((budget) => (
                  <li key={budget.id} className="min-w-0">
                    <BudgetCard
                      budget={budget}
                      phase={phase}
                      movementsTo={{ pathname: '/app/movimientos', search: movementsSearch(search, budget.nombre) }}
                      highlighted={highlightId === budget.id}
                      busy={actions.pending?.type === 'delete' && actions.pending.id === budget.id}
                      canMove={canRebalance}
                      onEdit={(item) => setDialog({ type: 'form', budget: item })}
                      onMove={openMoveFor}
                      onDelete={handleDelete}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {dialog?.type === 'form' && (
        <BudgetFormDialog budget={dialog.budget} period={period} periodLabel={periodLabel} budgets={items} onClose={closeDialog} />
      )}
      {dialog?.type === 'rebalance' && (
        <RebalanceDialog
          period={period}
          periodLabel={periodLabel}
          phase={phase}
          budgets={items}
          initial={dialog.initial}
          onClose={closeDialog}
        />
      )}
    </div>
  )
}

function ChipLabel({ text, count, dot }) {
  return (
    <>
      {/* El punto de color se omite en móvil para que los 5 filtros quepan en dos filas. */}
      {dot && <span aria-hidden="true" className={`hidden h-2 w-2 shrink-0 rounded-full min-[400px]:block ${dot}`} />}
      <span>{text}</span>
      <span className="tabular-nums opacity-70">{count}</span>
    </>
  )
}

function BudgetsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando presupuestos">
      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className={index === 2 ? 'col-span-2 sm:col-span-1' : ''}>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="mt-2 h-7 w-32 max-w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-5 h-3 w-full rounded-full" />
        <Skeleton className="mt-4 h-12 w-full rounded-2xl" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-10 w-24 rounded-full" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-5 w-40 max-w-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
            <Skeleton className="mt-3 h-10 w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Cargando presupuestos</span>
    </div>
  )
}
