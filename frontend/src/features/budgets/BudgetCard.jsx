import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightLeft, CalendarClock, CheckCircle2, Pencil, ReceiptText, Trash2, TrendingUp } from 'lucide-react'
import CategoryIcon from '../../components/finance/CategoryIcon'
import { ProgressBar } from '../../components/ui'
import { usePreferences } from '../../context/PreferencesContext'
import { useMoney } from '../../hooks/useMoney'
import { toNumber } from '../../lib/format'
import { formatPct, freeMargin, stateOf, stylesFor } from './budgetModel'
import BudgetActionsMenu from './BudgetActionsMenu'
import Money from './Money'

const ACTION =
  'inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

/**
 * Tarjeta de un presupuesto: estado del backend, consumo, proyección y acciones.
 * Acciones visibles: "Ver movimientos" y "Editar". En el menú ⋮: mover saldo (si aplica) y eliminar.
 */
export default function BudgetCard({ budget, phase, movementsTo, highlighted = false, busy = false, canMove, onEdit, onMove, onDelete }) {
  const titleId = useId()
  const state = stateOf(budget)
  const styles = stylesFor(state)
  const remaining = toNumber(budget.restante)
  const over = remaining < 0
  const margin = freeMargin(budget)
  const projection = useProjectionText(budget, phase)

  // "Ver movimientos" y "Editar" quedan visibles en la tarjeta; el menú guarda las acciones secundarias.
  const menuItems = [
    ...(canMove
      ? [
          {
            key: 'move',
            label: margin > 0 ? 'Mover saldo a otro' : 'Traer saldo de otro',
            description:
              margin > 0 ? 'Pasa parte de su margen libre a otro presupuesto.' : 'Cubre este presupuesto con el margen libre de otro.',
            Icon: ArrowRightLeft,
            onSelect: () => onMove(budget),
          },
        ]
      : []),
    {
      key: 'delete',
      label: 'Eliminar presupuesto',
      description: 'Quita el límite de este mes. Tus movimientos no se borran.',
      Icon: Trash2,
      tone: 'danger',
      onSelect: () => onDelete(budget),
    },
  ]

  return (
    <article
      id={`presupuesto-${budget.id}`}
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      data-highlighted={highlighted || undefined}
      className={`h-full scroll-mt-24 rounded-[24px] border bg-white p-4 shadow-sm outline-none transition duration-500 sm:p-5 ${
        highlighted ? 'border-emerald-400 ring-4 ring-emerald-200' : 'border-slate-200'
      } ${busy ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${styles.tile}`}>
          <CategoryIcon name={budget.icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 id={titleId} className="break-words text-lg font-bold leading-snug text-slate-900">
            {budget.nombre}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
              {budget.badge || state}
            </span>
            {budget.descripcion ? <span className="min-w-0 break-words text-sm text-slate-500">{budget.descripcion}</span> : null}
          </div>
        </div>
        <BudgetActionsMenu budgetName={budget.nombre} items={menuItems} disabled={busy} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Límite</dt>
          <dd className="mt-1 break-words text-sm font-semibold text-slate-800 sm:text-base">
            <Money value={budget.presupuesto} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Gastado</dt>
          <dd className="mt-1 break-words text-sm font-semibold text-slate-800 sm:text-base">
            <Money value={budget.gastado} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{over ? 'Excedido' : 'Restante'}</dt>
          <dd className={`mt-1 break-words text-sm font-semibold sm:text-base ${over ? 'text-red-600' : 'text-emerald-700'}`}>
            <Money value={remaining} absolute />
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
          <span className="text-slate-600">Consumido</span>
          <span className={`font-semibold tabular-nums ${styles.text}`}>{formatPct(budget.porcentaje)}</span>
        </div>
        <ProgressBar
          value={budget.porcentaje}
          label={`Consumo de ${budget.nombre}: ${formatPct(budget.porcentaje)}`}
          className={`h-2.5 ${styles.track}`}
          barClassName={styles.bar}
        />
      </div>

      <p className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm leading-6 ${projection.className}`}>
        <projection.Icon className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0">{projection.text}</span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <Link to={movementsTo} aria-label={`Ver movimientos de ${budget.nombre}`} className={ACTION}>
          <ReceiptText className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            <span className="sm:hidden">Movimientos</span>
            <span className="hidden sm:inline">Ver movimientos</span>
          </span>
        </Link>
        <button type="button" onClick={() => onEdit(budget)} disabled={busy} aria-label={`Editar presupuesto de ${budget.nombre}`} className={ACTION}>
          <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
          Editar
        </button>
      </div>
    </article>
  )
}

/** Frase de proyección construida en el cliente (moneda del usuario y montos ocultos respetados). */
function useProjectionText(budget, phase) {
  const { money } = useMoney()
  const { showAmounts } = usePreferences()

  if (phase === 'future') {
    return {
      Icon: CalendarClock,
      className: 'bg-slate-50 text-slate-600',
      text: 'El mes aún no empieza: aquí se sumarán los gastos de esta categoría desde el día 1.',
    }
  }
  if (phase === 'past') return closedMonthProjection(toNumber(budget.restante), showAmounts, money)
  return currentMonthProjection(budget, showAmounts, money)
}

/** Mes cerrado: cuánto quedó sin usar o cuánto se excedió. */
function closedMonthProjection(remaining, showAmounts, money) {
  if (remaining >= 0) {
    return {
      Icon: CheckCircle2,
      className: 'bg-slate-50 text-slate-600',
      text: showAmounts ? `Mes cerrado con ${money(remaining)} sin usar.` : 'Mes cerrado dentro del límite.',
    }
  }
  return {
    Icon: TrendingUp,
    className: 'bg-red-50 text-red-700',
    text: showAmounts ? `Mes cerrado con ${money(-remaining)} de exceso.` : 'Mes cerrado por encima del límite.',
  }
}

/** Mes en curso: cómo cerraría el mes al ritmo actual frente al límite. */
function currentMonthProjection(budget, showAmounts, money) {
  const limit = toNumber(budget.presupuesto)
  const spent = toNumber(budget.gastado)
  const projected = toNumber(budget.proyeccion)

  if (spent <= 0) {
    return {
      Icon: CheckCircle2,
      className: 'bg-slate-50 text-slate-600',
      text: 'Aún no registras gastos en esta categoría este mes.',
    }
  }

  if (projected > limit) {
    return {
      Icon: TrendingUp,
      className: spent > limit ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800',
      text: showAmounts
        ? `Al ritmo actual cerrará el mes en ${money(projected)}, ${money(projected - limit)} por encima del límite.`
        : 'Al ritmo actual cerrará el mes por encima del límite.',
    }
  }

  return {
    Icon: CheckCircle2,
    className: 'bg-slate-50 text-slate-600',
    text: showAmounts
      ? `Al ritmo actual cerrará el mes en ${money(projected)}, dentro del límite.`
      : 'Al ritmo actual cerrará el mes dentro del límite.',
  }
}
