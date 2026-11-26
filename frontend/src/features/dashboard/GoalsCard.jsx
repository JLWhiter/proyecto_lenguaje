import { Link } from 'react-router-dom'
import { ChevronRight, PiggyBank, Plus } from 'lucide-react'
import { GoalIconTile, GoalProgress, StatusBadge } from '../goals/GoalBits'
import { ACTIVE, STATUS, topGoals } from '../goals/goalModel'
import { useGoals } from '../goals/useGoals'
import { Amount, CARD, CARD_TITLE, CardLink } from './DashboardBits'
import { goalsLink } from './dashboardUtils'

const SHOWN = 2

/**
 * Las 2 metas activas que más atención piden, con su progreso. Sin metas, una invitación breve;
 * mientras carga o si falla, no ocupa espacio (las metas tienen su propia pantalla).
 */
export default function GoalsCard() {
  const goals = useGoals(ACTIVE)
  if (goals.status !== 'ready') return null
  const all = goals.data?.metas ?? []
  const shown = topGoals(all, SHOWN)
  if (shown.length === 0) return <GoalsPrompt />

  return (
    <section aria-labelledby="dashboard-goals-title" className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <PiggyBank className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 id="dashboard-goals-title" className={CARD_TITLE}>
            Metas de ahorro
          </h2>
        </div>
        <CardLink to={goalsLink()}>{all.length > SHOWN ? `Ver todas (${all.length})` : 'Ver metas'}</CardLink>
      </div>

      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {shown.map((goal) => (
          <li key={goal.id} className="min-w-0">
            <GoalItem goal={goal} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function GoalItem({ goal }) {
  const tracking = goal.estado === STATUS.IN_PROGRESS || goal.estado === STATUS.BEHIND
  return (
    <Link
      to={goalsLink(goal.id)}
      className="flex h-full flex-col rounded-2xl border border-slate-200 p-3.5 transition hover:border-emerald-200 hover:bg-emerald-50/40 sm:p-4"
    >
      <span className="flex items-start gap-3">
        <GoalIconTile goal={goal} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block break-words font-semibold text-slate-900">{goal.nombre}</span>
          <StatusBadge status={goal.estado} className="mt-1" />
        </span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      </span>
      <span className="mt-3 block text-sm text-slate-600">
        <Amount value={goal.ahorrado} className="font-semibold text-slate-900" /> de <Amount value={goal.objetivo} />
      </span>
      <GoalProgress goal={goal} legend={false} className="mt-1.5" />
      {tracking && (
        <span className="mt-2 block text-xs text-slate-600">
          Ahorra <Amount value={goal.ahorro_mensual_necesario} className="font-semibold text-slate-800" /> al mes para llegar a tiempo.
        </span>
      )}
    </Link>
  )
}

function GoalsPrompt() {
  return (
    <section aria-labelledby="dashboard-goals-title" className={`${CARD} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <PiggyBank className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="dashboard-goals-title" className="text-base font-semibold text-slate-900">
            ¿Ahorras para algo?
          </h2>
          <p className="text-sm text-slate-500">Crea una meta y te diremos cuánto separar cada mes para lograrla.</p>
        </div>
      </div>
      <Link
        to={goalsLink()}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <Plus className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        Crear meta
      </Link>
    </section>
  )
}
