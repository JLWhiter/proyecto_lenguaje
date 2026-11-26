import { PiggyBank } from 'lucide-react'
import { ProgressBar } from '../../components/ui'
import { toNumber } from '../../lib/format'
import { Amount } from '../transactions/Money'
import { percentText } from './goalModel'

/** Total ahorrado frente al total de las metas activas, cuántas hay y cuántas ya se alcanzaron. */
export default function GoalsSummary({ summary }) {
  const target = toNumber(summary?.total_objetivo)
  const saved = toNumber(summary?.total_ahorrado)
  const percentage = target > 0 ? (saved / target) * 100 : 0
  const active = toNumber(summary?.metas_activas)
  const reached = toNumber(summary?.alcanzadas)

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="goals-summary-title">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <PiggyBank className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="goals-summary-title" className="text-lg font-semibold text-slate-900">
            Tu ahorro para metas
          </h2>
          <p className="text-sm text-slate-500">Suma de tus metas activas</p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        <div className="min-w-0">
          <dt className="text-sm text-slate-500">Ahorrado</dt>
          <dd className="mt-1 break-words text-xl font-bold tracking-tight text-emerald-700 sm:text-2xl">
            <Amount value={saved} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sm text-slate-500">Objetivo total</dt>
          <dd className="mt-1 break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            <Amount value={target} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sm text-slate-500">Metas activas</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-2xl">{active}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sm text-slate-500">Alcanzadas</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-2xl">{reached}</dd>
        </div>
      </dl>

      <ProgressBar
        value={percentage}
        label={`Ahorro total de tus metas activas: ${percentText(percentage)}`}
        className="mt-5 h-3 bg-emerald-100"
        barClassName="bg-emerald-500"
      />
      <p className="mt-2.5 text-sm text-slate-600">
        <span className="font-semibold tabular-nums text-emerald-700">{percentText(percentage)}</span> del total que te propusiste
      </p>
    </section>
  )
}
