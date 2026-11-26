import { Landmark, Plus } from 'lucide-react'
import { monthPhrase } from '../../lib/period'
import { amountTone, directionIcon, MOVEMENT_ICONS, movementTone } from '../transactions/movementStyle'
import { Amount, CARD, CARD_TITLE, CardLink } from './DashboardBits'
import { movementsLink, movementWhen } from './dashboardUtils'

const KINDS = {
  TRANSFER: { label: 'Transferencia', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  DEPOSIT: { label: 'Depósito', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  ADJUSTMENT: { label: 'Ajuste de saldo', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  OPENING: { label: 'Saldo inicial', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
}

const sameText = (a, b) => String(a || '').trim().toLocaleLowerCase('es') === String(b || '').trim().toLocaleLowerCase('es')

function MovementIcon({ item }) {
  const Icon = item.kind === 'OPENING' ? Landmark : MOVEMENT_ICONS[item.icon] || directionIcon(item)
  return (
    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${movementTone(item)}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  )
}

function MovementRow({ item }) {
  const kind = item.kind && item.kind !== 'REGULAR' ? KINDS[item.kind] ?? { label: item.kind_label, className: KINDS.OPENING.className } : null
  // En transferencias/depósitos la categoría suele repetir la clase ("Transferencia"): no se duplica.
  const showCategory = item.categoria && !(kind && (sameText(item.categoria, kind.label) || sameText(item.categoria, item.kind_label)))
  const when = movementWhen(item.occurred_at) || [item.fecha, item.hora].filter(Boolean).join(', ')

  return (
    <li className="flex items-center gap-3 py-3">
      <MovementIcon item={item} />
      <div className="min-w-0 flex-1">
        <p className="break-words font-semibold text-slate-900">{item.nombre}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          {kind && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${kind.className}`}>
              {kind.label}
            </span>
          )}
          {showCategory && (
            <span className="inline-flex max-w-full items-center truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {item.categoria}
            </span>
          )}
          <span className="min-w-0 break-words">
            {item.occurred_at ? <time dateTime={item.occurred_at}>{when}</time> : when}
            {item.cuenta ? ` · ${item.cuenta}` : ''}
          </span>
        </div>
      </div>
      <p className={`shrink-0 whitespace-nowrap text-right text-sm font-bold sm:text-base ${amountTone(item.monto)}`}>
        <Amount value={item.monto} signed />
      </p>
    </li>
  )
}

/** Últimos 4 movimientos del período. */
export default function RecentTransactions({ data, period, canRegister, onRegister }) {
  const items = Array.isArray(data.ultimas_transacciones) ? data.ultimas_transacciones : []
  const periodText = monthPhrase(period)

  return (
    <section aria-labelledby="recent-title" className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 id="recent-title" className={CARD_TITLE}>
            Transacciones recientes
          </h2>
          <p className="mt-1 text-sm text-slate-500">Últimos movimientos de {periodText}</p>
        </div>
        <CardLink to={movementsLink(period)}>Ver todas</CardLink>
      </div>

      {items.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {items.map((item) => (
            <MovementRow key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
          <p className="font-semibold text-slate-700">Sin movimientos en {periodText}</p>
          <p className="mt-1">Registra un ingreso o un gasto y aparecerá aquí.</p>
          {canRegister && (
            <button
              type="button"
              onClick={onRegister}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Plus className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Registrar movimiento
            </button>
          )}
        </div>
      )}
    </section>
  )
}
