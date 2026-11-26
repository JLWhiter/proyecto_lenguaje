import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, PiggyBank, Plus, RotateCw } from 'lucide-react'
import { EmptyState, ErrorState, FilterChips, Skeleton, useToast } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { toNumber } from '../../lib/format'
import GoalCard from './GoalCard'
import GoalDetailDialog from './GoalDetailDialog'
import { GoalFormDialog, MovementDialog } from './GoalDialogs'
import { ACTIVE, ARCHIVED, DEPOSIT, WITHDRAWAL } from './goalModel'
import GoalsSummary from './GoalsSummary'
import { useGoalActions, useGoalHighlight, useGoals } from './useGoals'

const PRIMARY_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#10B981] px-4 py-2 text-center text-sm font-semibold leading-5 text-white shadow-sm shadow-emerald-200 hover:bg-[#059669]'
const GENERIC_ERROR = 'No se pudo completar la acción.'

export default function GoalsPage() {
  useDocumentTitle('Metas de ahorro')
  const toast = useToast()
  const [estado, setEstado] = useState(ACTIVE)
  const goals = useGoals(estado)
  const actions = useGoalActions()
  const [dialog, setDialog] = useState(null)
  const titleRef = useRef(null)

  const ready = goals.status === 'ready'
  const items = useMemo(() => goals.data?.metas ?? [], [goals.data])
  const summary = goals.data?.resumen
  const showingActive = estado === ACTIVE
  const activeEmpty = ready && showingActive && items.length === 0
  const { highlightId, requested } = useGoalHighlight({ items, ready: ready && showingActive })

  // Un enlace `?meta=<id>` (Alertas, Resumen) siempre apunta a una meta activa.
  useEffect(() => {
    if (requested) setEstado(ACTIVE)
  }, [requested])

  /** Archivar, restaurar o eliminar: al terminar cierra el detalle y devuelve el foco al título. */
  function finish(promise) {
    promise
      .then((done) => {
        if (!done) return
        setDialog(null)
        titleRef.current?.focus({ preventScroll: true })
      })
      .catch((error) => toast.error(error?.message || GENERIC_ERROR))
  }

  const handlers = {
    deposit: (goal, back) => setDialog({ type: 'movement', kind: DEPOSIT, goal, back }),
    withdraw: (goal, back) => setDialog({ type: 'movement', kind: WITHDRAWAL, goal, back }),
    edit: (goal, back) => setDialog({ type: 'form', goal, back }),
    detail: (goal) => setDialog({ type: 'detail', goal }),
    archive: (goal) => finish(actions.setArchived(goal, true)),
    restore: (goal) => finish(actions.setArchived(goal, false)),
    delete: (goal) => finish(actions.remove(goal)),
  }

  function handleAction(type, goal) {
    // Desde el detalle, los formularios vuelven al detalle al cerrarse.
    handlers[type]?.(goal, dialog?.type === 'detail' ? dialog : null)
  }

  function handleRemoveMovement(goal, movement) {
    actions.removeMovement(goal, movement).catch((error) => toast.error(error?.message || GENERIC_ERROR))
  }

  const closeDialog = () => setDialog((current) => current?.back ?? null)
  const openCreate = () => setDialog({ type: 'form' })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 ref={titleRef} tabIndex={-1} className="text-3xl font-bold text-slate-900 outline-none">
            Metas de ahorro
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Ponle nombre, monto y fecha a lo que quieres lograr y registra lo que vas separando. Las metas no mueven dinero entre tus cuentas.
          </p>
        </div>
        {!activeEmpty && (
          <button type="button" onClick={openCreate} className={`${PRIMARY_BUTTON} shrink-0 self-start whitespace-nowrap sm:self-auto`}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva meta
          </button>
        )}
      </div>

      {showingActive && ready && toNumber(summary?.metas_activas) > 0 && <GoalsSummary summary={summary} />}

      <FilterChips
        label="Mostrar metas"
        options={[
          { key: ACTIVE, label: <TabLabel text="Activas" count={summary?.metas_activas} /> },
          { key: ARCHIVED, label: <TabLabel text="Archivadas" /> },
        ]}
        value={estado}
        onChange={setEstado}
      />

      {goals.status === 'loading' && <GoalsSkeleton />}

      {goals.status === 'error' && <ErrorState title="No pudimos cargar tus metas" error={goals.error} onRetry={goals.reload} />}

      {ready && goals.error && (
        <output className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>No pudimos actualizar tus metas; puede que veas datos de hace un momento.</span>
          <button type="button" onClick={goals.reload} className="inline-flex min-h-10 items-center gap-1.5 font-semibold text-amber-900 hover:underline">
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
        </output>
      )}

      {ready && items.length === 0 && <EmptyGoals active={showingActive} onCreate={openCreate} />}

      {ready && items.length > 0 && (
        <section aria-label={showingActive ? 'Metas activas' : 'Metas archivadas'}>
          <ul className="grid gap-4 xl:grid-cols-2">
            {items.map((goal) => (
              <li key={goal.id} className="min-w-0">
                <GoalCard
                  goal={goal}
                  highlighted={highlightId === goal.id}
                  busy={actions.pending?.id === goal.id && actions.pending.type !== 'movement'}
                  onAction={handleAction}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {dialog?.type === 'form' && <GoalFormDialog goal={dialog.goal} goals={showingActive ? items : []} onClose={closeDialog} />}
      {dialog?.type === 'movement' && <MovementDialog goal={dialog.goal} kind={dialog.kind} onClose={closeDialog} />}
      {dialog?.type === 'detail' && (
        <GoalDetailDialog
          goalId={dialog.goal.id}
          fallback={dialog.goal}
          pending={actions.pending}
          onAction={handleAction}
          onRemoveMovement={handleRemoveMovement}
          onClose={closeDialog}
        />
      )}
    </div>
  )
}

function TabLabel({ text, count }) {
  return (
    <>
      <span>{text}</span>
      {count !== undefined && count !== null && <span className="tabular-nums opacity-70">{count}</span>}
    </>
  )
}

function EmptyGoals({ active, onCreate }) {
  if (!active) {
    return (
      <EmptyState
        icon={Archive}
        title="No tienes metas archivadas"
        description="Cuando archives una meta (por ejemplo, al cumplirla), la verás aquí con todo su historial."
        className="py-10"
      />
    )
  }
  return (
    <EmptyState
      icon={PiggyBank}
      title="Crea tu primera meta"
      description="Ponle nombre y fecha a algo que quieras lograr —una laptop, un viaje o tu fondo de emergencia— y registra lo que vas separando. Te diremos cuánto ahorrar al mes y te avisaremos si te atrasas."
      action={
        <button type="button" onClick={onCreate} className={PRIMARY_BUTTON}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Crear meta
        </button>
      }
      className="py-10"
    />
  )
}

function GoalsSkeleton() {
  return (
    <output aria-label="Cargando metas" className="block space-y-6">
      <span className="grid gap-4 xl:grid-cols-2">
        {[0, 1].map((index) => (
          <span key={index} className="block rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <span className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
              <span className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-5 w-40 max-w-full" />
                <Skeleton className="h-4 w-24" />
              </span>
            </span>
            <span className="mt-4 grid grid-cols-3 gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </span>
            <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
            <Skeleton className="mt-3 h-12 w-full" />
            <Skeleton className="mt-4 h-10 w-full" />
          </span>
        ))}
      </span>
    </output>
  )
}
