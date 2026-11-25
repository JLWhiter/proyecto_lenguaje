import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownToLine, ArrowRightLeft, Info, Pencil, ReceiptText, Scale, Trash2 } from 'lucide-react'
import CategoryIcon from '../../components/finance/CategoryIcon'
import { toNumber } from '../../lib/format'
import AccountActionsMenu from './AccountActionsMenu'
import Amount from './Amount'
import { iconTileStyle } from './accountTypes'

// Móvil: fichas con ícono arriba (3 por fila). Desde `sm`: botones en línea con ícono + texto.
// (sin clase de display: cada botón pone la suya, para no mezclar `hidden` con `inline-flex`).
const ACTION_BASE =
  'min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 text-center text-xs font-semibold leading-tight transition disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-10 sm:flex-row sm:gap-2 sm:px-3.5 sm:text-sm'
const OUTLINE = 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:hover:bg-white'
const ACTION_OUTLINE = `${ACTION_BASE} inline-flex ${OUTLINE}`
const ACTION_DARK = `${ACTION_BASE} inline-flex bg-slate-900 text-white hover:bg-slate-800 disabled:hover:bg-slate-900`

function formatShare(share) {
  if (share === null) return null
  if (share > 0 && share < 1) return '<1%'
  return `${Math.round(share)}%`
}

/**
 * Tarjeta de una cuenta con sus acciones.
 * `onAction(type, account)` con type: transfer | deposit | balance | edit | delete | create.
 */
export default function AccountCard({ account, movementsTo, share, canTransfer, busy = false, onAction }) {
  const titleId = useId()
  const transferHintId = useId()
  const balance = toNumber(account.saldo)
  const shareLabel = formatShare(share)

  const menuItems = [
    {
      key: 'balance',
      label: 'Actualizar saldo',
      description: 'Corrige el saldo; la diferencia queda como «Ajuste de saldo».',
      Icon: Scale,
      mobileOnly: true,
      onSelect: () => onAction('balance', account),
    },
    {
      key: 'edit',
      label: 'Editar cuenta',
      description: 'Nombre, tipo y descripción.',
      Icon: Pencil,
      onSelect: () => onAction('edit', account),
    },
    {
      key: 'delete',
      label: 'Eliminar cuenta',
      description: 'Requiere saldo 0. Si tiene movimientos, se archiva.',
      Icon: Trash2,
      tone: 'danger',
      onSelect: () => onAction('delete', account),
    },
  ]

  return (
    <article
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      className={`rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition sm:p-5 ${busy ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconTileStyle(account.icon)}`}>
          <CategoryIcon name={account.icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 id={titleId} className="break-words text-lg font-bold leading-snug text-slate-900">
            {account.nombre}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{account.tipo}</span>
            {account.descripcion ? (
              <span className="min-w-0 break-words text-sm text-slate-500">{account.descripcion}</span>
            ) : null}
          </div>
        </div>
        <AccountActionsMenu accountName={account.nombre} items={menuItems} disabled={busy} />
      </div>

      <div className="mt-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Saldo</p>
          <p className={`mt-1 break-words text-2xl font-bold tracking-tight ${balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
            <Amount value={balance} />
          </p>
          {shareLabel && <p className="mt-0.5 text-xs text-slate-500">{shareLabel} de tu patrimonio</p>}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap xl:justify-end">
          <Link to={movementsTo} aria-label={`Movimientos de ${account.nombre}`} className={ACTION_OUTLINE}>
            <ReceiptText className="h-4 w-4 shrink-0" aria-hidden="true" />
            Movimientos
          </Link>
          <button
            type="button"
            onClick={() => onAction('transfer', account)}
            disabled={!canTransfer || busy}
            aria-label={`Transferir desde ${account.nombre}`}
            aria-describedby={canTransfer ? undefined : transferHintId}
            className={ACTION_DARK}
          >
            <ArrowRightLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            Transferir
          </button>
          <button
            type="button"
            onClick={() => onAction('deposit', account)}
            disabled={busy}
            aria-label={`Depositar en ${account.nombre}`}
            className={ACTION_OUTLINE}
          >
            <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden="true" />
            Depositar
          </button>
          <button
            type="button"
            onClick={() => onAction('balance', account)}
            disabled={busy}
            aria-label={`Actualizar saldo de ${account.nombre}`}
            className={`${ACTION_BASE} hidden sm:inline-flex ${OUTLINE}`}
          >
            <Scale className="h-4 w-4 shrink-0" aria-hidden="true" />
            Actualizar saldo
          </button>
        </div>
      </div>

      {!canTransfer && (
        <p id={transferHintId} className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            Para transferir necesitas al menos dos cuentas.{' '}
            <button
              type="button"
              onClick={() => onAction('create')}
              className="-my-2 inline-flex min-h-10 items-center font-semibold text-emerald-700 underline-offset-2 hover:underline"
            >
              Crear otra cuenta
            </button>
          </span>
        </p>
      )}
    </article>
  )
}
