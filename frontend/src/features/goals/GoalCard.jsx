import { useId } from 'react'
import {
  ArchiveRestore,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarClock,
  CalendarX2,
  CheckCircle2,
  ChevronRight,
  Pencil,
  Trash2,
} from 'lucide-react'
import { IconButton } from '../../components/ui'
import { toNumber } from '../../lib/format'
import { Amount } from '../transactions/Money'
import { GoalIconTile, GoalProgress, StatusBadge } from './GoalBits'
import { estimateInfo, formatGoalDate, monthsText, STATUS } from './goalModel'
import { goalElementId } from './useGoals'

const ACTION =
  'inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3.5'
const OUTLINE = `${ACTION} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`
const PRIMARY = `${ACTION} bg-emerald-600 text-white hover:bg-emerald-700`
const DANGER = `${ACTION} border border-red-200 bg-white text-red-600 hover:bg-red-50`

/**
 * Tarjeta de una meta: progreso con la marca de lo esperado, montos, cuánto ahorrar al mes y acciones.
 * `onAction(type, goal)` con type: deposit | withdraw | detail | edit | restore | delete.
 */
export default function GoalCard({ goal, highlighted = false, busy = false, onAction }) {
  const titleId = useId()
  const reachedOrOver = toNumber(goal.restante) <= 0

  return (
    <article
      id={goalElementId(goal.id)}
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      data-highlighted={highlighted || undefined}
      className={`flex h-full scroll-mt-24 flex-col rounded-[24px] border bg-white p-4 shadow-sm outline-none transition duration-500 sm:p-5 ${
        highlighted ? 'border-emerald-400 ring-4 ring-emerald-200' : 'border-slate-200'
      } ${busy ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <GoalIconTile goal={goal} />
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 id={titleId} className="break-words text-lg font-bold leading-snug text-slate-900">
            {goal.nombre}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusBadge status={goal.estado} />
            {goal.descripcion ? <span className="min-w-0 break-words text-sm text-slate-500">{goal.descripcion}</span> : null}
          </div>
        </div>
        {!goal.archivada && (
          <IconButton
            label={`Editar meta ${goal.nombre}`}
            variant="ghost"
            onClick={() => onAction('edit', goal)}
            disabled={busy}
            className="-mr-1 -mt-1 text-slate-500"
          >
            <Pencil className="h-4 w-4" />
          </IconButton>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <AmountTerm label="Ahorrado" value={goal.ahorrado} />
        <AmountTerm label="Objetivo" value={goal.objetivo} />
        <AmountTerm label="Falta" value={goal.restante} className={reachedOrOver ? 'text-emerald-700' : 'text-slate-800'} />
      </dl>

      <GoalProgress goal={goal} className="mt-4" />

      {goal.archivada ? <ArchivedNote goal={goal} /> : <GoalOutlook goal={goal} />}

      <div className="mt-auto pt-4">
        {goal.archivada ? <ArchivedActions goal={goal} busy={busy} onAction={onAction} /> : <ActiveActions goal={goal} busy={busy} onAction={onAction} />}
      </div>
    </article>
  )
}

function AmountTerm({ label, value, className = 'text-slate-800' }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className={`mt-1 break-words text-sm font-semibold sm:text-base ${className}`}>
        <Amount value={value} />
      </dd>
    </div>
  )
}

const OUTLOOK_TONES = {
  [STATUS.IN_PROGRESS]: 'bg-slate-50 text-slate-700',
  [STATUS.BEHIND]: 'bg-amber-50 text-amber-900',
  [STATUS.REACHED]: 'bg-emerald-50 text-emerald-800',
  [STATUS.OVERDUE]: 'bg-red-50 text-red-800',
}

/** Qué hacer ahora según el estado: cuánto ahorrar al mes, cuándo llegarías, o que ya se logró/venció. */
export function GoalOutlook({ goal, className = 'mt-3' }) {
  const tone = OUTLOOK_TONES[goal.estado] ?? OUTLOOK_TONES[STATUS.IN_PROGRESS]
  const date = formatGoalDate(goal.fecha_objetivo)

  if (goal.estado === STATUS.REACHED) {
    return (
      <OutlookBox icon={CheckCircle2} tone={tone} className={className}>
        ¡Lo lograste! Puedes archivarla o seguir sumando.
      </OutlookBox>
    )
  }
  if (goal.estado === STATUS.OVERDUE) {
    return (
      <OutlookBox icon={CalendarX2} tone={tone} className={className}>
        Venció el {date} y te faltan <Amount value={goal.restante} className="font-semibold" />. Cambia la fecha para seguir.
      </OutlookBox>
    )
  }
  const estimate = estimateInfo(goal)
  return (
    <OutlookBox icon={CalendarClock} tone={tone} className={className}>
      Ahorra <Amount value={goal.ahorro_mensual_necesario} className="font-semibold" /> al mes para llegar al {date} (
      {monthsText(goal.meses_restantes)}).
      {estimate && <span className={`mt-1 block text-xs ${estimate.late ? 'font-medium' : 'opacity-80'}`}>{estimate.text}</span>}
    </OutlookBox>
  )
}

function OutlookBox({ icon, tone, className, children }) {
  const Icon = icon
  return (
    <p className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm leading-6 ${tone} ${className}`}>
      <Icon className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  )
}

function ArchivedNote({ goal }) {
  return (
    <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
      Archivada. Fecha objetivo: {formatGoalDate(goal.fecha_objetivo)}. Restáurala para seguir registrando aportes.
    </p>
  )
}

function ActiveActions({ goal, busy, onAction }) {
  const empty = toNumber(goal.ahorrado) <= 0
  return (
    <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
      <button type="button" onClick={() => onAction('deposit', goal)} disabled={busy} aria-label={`Aportar a ${goal.nombre}`} className={PRIMARY}>
        <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden="true" />
        Aportar
      </button>
      <button
        type="button"
        onClick={() => onAction('withdraw', goal)}
        disabled={busy || empty}
        title={empty ? 'Aún no tienes nada ahorrado en esta meta' : undefined}
        aria-label={`Retirar de ${goal.nombre}`}
        className={OUTLINE}
      >
        <ArrowUpFromLine className="h-4 w-4 shrink-0" aria-hidden="true" />
        Retirar
      </button>
      <button type="button" onClick={() => onAction('detail', goal)} aria-label={`Ver detalle de ${goal.nombre}`} className={OUTLINE}>
        <span className="truncate">Detalle</span>
        <ChevronRight className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
      </button>
    </div>
  )
}

function ArchivedActions({ goal, busy, onAction }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
      <button type="button" onClick={() => onAction('restore', goal)} disabled={busy} aria-label={`Restaurar ${goal.nombre}`} className={OUTLINE}>
        <ArchiveRestore className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">Restaurar</span>
      </button>
      <button type="button" onClick={() => onAction('detail', goal)} aria-label={`Ver detalle de ${goal.nombre}`} className={OUTLINE}>
        <span className="truncate">Detalle</span>
        <ChevronRight className="hidden h-4 w-4 shrink-0 sm:block" aria-hidden="true" />
      </button>
      <button type="button" onClick={() => onAction('delete', goal)} disabled={busy} aria-label={`Eliminar ${goal.nombre}`} className={DANGER}>
        <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">Eliminar</span>
      </button>
    </div>
  )
}
