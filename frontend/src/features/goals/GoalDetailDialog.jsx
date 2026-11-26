import { lazy, Suspense } from 'react'
import { Archive, ArchiveRestore, ArrowDownToLine, ArrowUpFromLine, History, Pencil, Trash2 } from 'lucide-react'
import { ErrorState, IconButton, Modal, Skeleton } from '../../components/ui'
import { toNumber } from '../../lib/format'
import { Amount } from '../transactions/Money'
import { GoalIconTile, GoalProgress, StatusBadge } from './GoalBits'
import { GoalOutlook } from './GoalCard'
import { DEPOSIT, formatGoalDate, NO_LEDGER_NOTE } from './goalModel'
import { useGoalDetail } from './useGoals'

// recharts se descarga solo al abrir un detalle (la lista de metas no lo necesita).
const GoalChart = lazy(() => import('./GoalChart'))

const BUTTON =
  'inline-flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50'
const OUTLINE = `${BUTTON} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`
const PRIMARY = `${BUTTON} bg-emerald-600 text-white hover:bg-emerald-700`
const DANGER = `${BUTTON} border border-red-200 bg-white text-red-600 hover:bg-red-50`
const SECTION_TITLE = 'text-base font-bold text-slate-900'
const CHART_SKELETON = <Skeleton className="h-40 w-full rounded-2xl" />

/**
 * Detalle de una meta: indicadores, aporte neto por mes (gráfico) e historial de aportes y retiros.
 * `fallback` (la meta de la tarjeta) se muestra mientras carga el detalle.
 * `onAction(type, goal)` con type: deposit | withdraw | edit | archive | restore | delete.
 */
export default function GoalDetailDialog({ goalId, fallback, pending, onAction, onRemoveMovement, onClose }) {
  const detail = useGoalDetail(goalId)
  const goal = detail.data ?? fallback
  const loading = detail.status === 'loading'
  const busy = Boolean(pending)

  return (
    <Modal
      title={goal.nombre}
      description={goal.descripcion || `Meta para el ${formatGoalDate(goal.fecha_objetivo)}`}
      onClose={onClose}
      size="lg"
      footer={<DetailFooter goal={goal} busy={busy} onAction={onAction} />}
    >
      {detail.status === 'error' ? (
        <ErrorState title="No pudimos cargar esta meta" error={detail.error} onRetry={detail.reload} className="border-0 p-0 shadow-none" />
      ) : (
        <DetailBody goal={goal} loading={loading} pending={pending} onAction={onAction} onRemoveMovement={onRemoveMovement} />
      )}
    </Modal>
  )
}

function DetailBody({ goal, loading, pending, onAction, onRemoveMovement }) {
  const chart = (
    <Suspense fallback={CHART_SKELETON}>
      <GoalChart series={goal.serie_mensual} />
    </Suspense>
  )
  const history = <MovementList goal={goal} pending={pending} onRemove={(movement) => onRemoveMovement(goal, movement)} />
  return (
    <div className="space-y-6">
      <GoalOverview goal={goal} busy={Boolean(pending)} onAction={onAction} />

      <section aria-labelledby="goal-chart-title">
        <h3 id="goal-chart-title" className={SECTION_TITLE}>
          Aporte neto por mes
        </h3>
        <div className="mt-3">{loading ? CHART_SKELETON : chart}</div>
      </section>

      <section aria-labelledby="goal-history-title">
        <h3 id="goal-history-title" className={`${SECTION_TITLE} flex items-center gap-2`}>
          <History className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Historial
        </h3>
        {loading ? <HistorySkeleton /> : history}
      </section>
    </div>
  )
}

function GoalOverview({ goal, busy, onAction }) {
  const empty = toNumber(goal.ahorrado) <= 0
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <GoalIconTile goal={goal} />
        <div className="min-w-0">
          <StatusBadge status={goal.estado} />
          <p className="mt-1 text-sm text-slate-500">
            Creada el {formatGoalDate(goal.creada)} · para el {formatGoalDate(goal.fecha_objetivo)}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 sm:gap-3 sm:p-4">
        <Term label="Ahorrado" value={goal.ahorrado} />
        <Term label="Objetivo" value={goal.objetivo} />
        <Term label="Falta" value={goal.restante} />
      </dl>

      <GoalProgress goal={goal} />
      <GoalOutlook goal={goal} className="" />

      {!goal.archivada && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onAction('deposit', goal)} disabled={busy} className={PRIMARY}>
            <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden="true" />
            Aportar
          </button>
          <button type="button" onClick={() => onAction('withdraw', goal)} disabled={busy || empty} className={OUTLINE}>
            <ArrowUpFromLine className="h-4 w-4 shrink-0" aria-hidden="true" />
            Retirar
          </button>
        </div>
      )}
      <p className="text-xs leading-5 text-slate-500">{NO_LEDGER_NOTE}</p>
    </div>
  )
}

function Term({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-slate-800 sm:text-base">
        <Amount value={value} />
      </dd>
    </div>
  )
}

function MovementList({ goal, pending, onRemove }) {
  const movements = goal.aportes ?? []
  if (movements.length === 0) {
    return <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Aún no registras aportes en esta meta.</p>
  }
  return (
    <ul className="mt-2 divide-y divide-slate-100">
      {movements.map((movement) => (
        <MovementRow
          key={movement.id}
          movement={movement}
          removable={!goal.archivada}
          busy={pending?.type === 'movement' && pending.id === movement.id}
          onRemove={() => onRemove(movement)}
        />
      ))}
    </ul>
  )
}

function MovementRow({ movement, removable, busy, onRemove }) {
  const deposit = movement.tipo === DEPOSIT
  const Icon = deposit ? ArrowDownToLine : ArrowUpFromLine
  const label = deposit ? 'Aporte' : 'Retiro'
  const date = formatGoalDate(movement.fecha)
  return (
    <li className={`flex items-center gap-3 py-2.5 ${busy ? 'opacity-60' : ''}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${deposit ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-800">{movement.nota || label}</p>
        <p className="text-xs text-slate-500">
          {movement.nota ? `${label} · ` : ''}
          {date}
        </p>
      </div>
      <Amount
        value={deposit ? movement.monto : -toNumber(movement.monto)}
        signed
        className={`shrink-0 text-sm font-semibold ${deposit ? 'text-emerald-700' : 'text-red-600'}`}
      />
      {removable && (
        <IconButton label={`Eliminar ${label.toLowerCase()} del ${date}`} variant="ghost" onClick={onRemove} disabled={busy} className="-mr-2">
          <Trash2 className="h-4 w-4" />
        </IconButton>
      )}
    </li>
  )
}

function HistorySkeleton() {
  return (
    <output aria-label="Cargando historial" className="mt-3 block space-y-3">
      {[0, 1, 2].map((index) => (
        <span key={index} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
        </span>
      ))}
    </output>
  )
}

function DetailFooter({ goal, busy, onAction }) {
  if (goal.archivada) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <button type="button" onClick={() => onAction('delete', goal)} disabled={busy} className={DANGER}>
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Eliminar
        </button>
        <button type="button" onClick={() => onAction('restore', goal)} disabled={busy} className={OUTLINE}>
          <ArchiveRestore className="h-4 w-4 shrink-0" aria-hidden="true" />
          Restaurar
        </button>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:flex sm:justify-end">
      <button type="button" onClick={() => onAction('delete', goal)} disabled={busy} className={DANGER}>
        <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Eliminar
      </button>
      <button type="button" onClick={() => onAction('archive', goal)} disabled={busy} className={OUTLINE}>
        <Archive className="h-4 w-4 shrink-0" aria-hidden="true" />
        Archivar
      </button>
      <button type="button" onClick={() => onAction('edit', goal)} disabled={busy} className={OUTLINE}>
        <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
        Editar
      </button>
    </div>
  )
}
