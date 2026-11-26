// Bloques de la pantalla de Movimientos (TransactionsPage). Solo presentación: el estado vive en la página.
import { Link } from 'react-router-dom'
import {
  ArrowRightLeft,
  CalendarDays,
  Download,
  FileSearch,
  Landmark,
  LoaderCircle,
  Plus,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import { EmptyState, ErrorState, Skeleton, SkeletonCard } from '../../components/ui'
import { toNumber } from '../../lib/format'
import { monthPhrase } from '../../lib/period'
import { DepositDialog, TransactionDialog, TransferDialog } from './TransactionDialogs'
import { Amount } from './Money'
import TransactionList, { TransactionDetailSheet } from './TransactionList'
import { loadMoreLabel, signTone } from './movementText'

export const PRIMARY_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#10B981] px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'
export const SECONDARY_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

const NOTICE_LINK_BUTTON = 'inline-flex min-h-10 items-center rounded-lg px-2 font-semibold text-amber-900 underline'

/** Enfoca y abre el selector de período del header (el mismo control para toda la app). */
function openPeriodPicker() {
  const select = document.querySelector('header select[aria-label="Período"]')
  if (!select) return
  select.focus()
  try {
    select.showPicker?.()
  } catch {
    // showPicker no está disponible o requiere otro gesto: queda enfocado.
  }
}

/**
 * Encabezado + acciones. En columna hasta xl: con el sidebar (1024 px) no caben en una fila y "Depositar" quedaba solo.
 * `accounts`: `{ ready, none, canTransfer }`. `onOpen(type)` abre 'transaction' | 'transfer' | 'deposit'.
 */
export function PageHeader({ periodLabel, accounts, onOpen }) {
  const cannotRegister = !accounts.ready || accounts.none
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Movimientos</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
          <CalendarDays className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <span>
            Período: <strong className="font-semibold text-slate-700">{periodLabel}</strong>
          </span>
          <button
            type="button"
            onClick={openPeriodPicker}
            className="-my-2 inline-flex min-h-10 items-center rounded-lg px-1 font-semibold text-emerald-700 hover:underline"
          >
            Cambiar
          </button>
        </div>
      </div>

      {/* Móvil: "Nueva transacción" a todo el ancho y debajo Transferir | Depositar. Desde sm: una sola fila. */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center xl:shrink-0 xl:justify-end">
        <button type="button" onClick={() => onOpen('transaction')} disabled={cannotRegister} className={`${PRIMARY_BUTTON} col-span-2`}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva transacción
        </button>
        <button
          type="button"
          onClick={() => onOpen('transfer')}
          disabled={!accounts.canTransfer}
          aria-describedby={accounts.ready && !accounts.canTransfer ? 'transfer-requirement' : undefined}
          className={SECONDARY_BUTTON}
        >
          <ArrowRightLeft className="h-4 w-4 text-sky-600" aria-hidden="true" />
          Transferir
        </button>
        <button type="button" onClick={() => onOpen('deposit')} disabled={cannotRegister} className={SECONDARY_BUTTON}>
          <Wallet className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          Depositar
        </button>
      </div>
    </div>
  )
}

/** Enlace de una alerta (?movimiento=<id>) cuyo movimiento no está en la lista: aviso visible arriba. */
export function MissingMovementNotice({ hasMore, hasFilters, periodPhrase, onLoadMore, onClearFilters, onDismiss }) {
  const filtersNote = hasFilters ? ' con estos filtros' : ''
  return (
    <output className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-amber-200 bg-amber-50 py-1 pl-4 pr-1 text-sm text-amber-900">
      <FileSearch className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 basis-56 py-2">
        {hasMore
          ? 'El movimiento de la alerta no está entre los que se muestran. Puede estar más abajo.'
          : `No encontramos el movimiento de la alerta en ${periodPhrase}${filtersNote}: puede que se haya editado o eliminado.`}
      </span>
      <span className="flex items-center gap-1">
        {hasMore && (
          <button type="button" onClick={onLoadMore} className={NOTICE_LINK_BUTTON}>
            Cargar más
          </button>
        )}
        {!hasMore && hasFilters && (
          <button type="button" onClick={onClearFilters} className={NOTICE_LINK_BUTTON}>
            Quitar filtros
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-amber-900 hover:bg-amber-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </span>
    </output>
  )
}

/** Requisitos de cuentas, con texto visible (un title no se ve en pantallas táctiles). */
export function AccountRequirement({ accounts }) {
  if (accounts.none) {
    return (
      <div className="flex flex-col gap-3 rounded-[24px] border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-amber-700">
            <Landmark className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-amber-900">Aún no tienes cuentas</p>
            <p id="transfer-requirement" className="text-sm text-amber-800">
              Crea una cuenta (efectivo, banco o billetera) para registrar ingresos, gastos y depósitos. Para transferir necesitas dos.
            </p>
          </div>
        </div>
        <Link
          to="/app/cuentas"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Crear una cuenta
        </Link>
      </div>
    )
  }
  if (!accounts.ready || accounts.canTransfer) return null
  return (
    <p id="transfer-requirement" className="-mt-2 flex flex-wrap items-center gap-x-1 text-sm text-slate-500">
      <span>Para transferir necesitas al menos dos cuentas activas (tienes una).</span>
      <Link to="/app/cuentas" className="inline-flex min-h-10 items-center font-semibold text-emerald-700 hover:underline">
        Agregar otra cuenta
      </Link>
    </p>
  )
}

const STAT_TONES = {
  emerald: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-600' },
  red: { icon: 'bg-red-50 text-red-600', value: 'text-red-600' },
  slate: { icon: 'bg-slate-100 text-slate-600', value: 'text-slate-900' },
}

function Stat({ label, value, caption, icon, tone }) {
  const Icon = icon
  const style = STAT_TONES[tone] ?? STAT_TONES.slate
  return (
    <div className="flex items-center justify-between gap-3 p-4 sm:block">
      <div className="flex items-center gap-3 sm:justify-between">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:order-2 ${style.icon}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="sm:order-1">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          {caption && <p className="hidden text-xs text-slate-400 sm:block">{caption}</p>}
        </div>
      </div>
      <p className={`min-w-0 break-words text-right text-xl font-bold tabular-nums sm:mt-3 sm:text-left sm:text-2xl ${style.value}`}>{value}</p>
    </div>
  )
}

function SummarySkeleton() {
  return (
    <div className="grid divide-y divide-slate-100 rounded-[24px] border border-slate-200 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-center justify-between gap-3 p-4 sm:block">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-28 sm:mt-4 sm:w-36" />
        </div>
      ))}
    </div>
  )
}

/** Resumen del período (respeta los filtros): ingresos, gastos y neto. */
export function PeriodTotals({ feed, hasFilters, period }) {
  if (feed.status === 'loading') return <SummarySkeleton />
  if (feed.status !== 'ready') return null

  const ingresos = toNumber(feed.summary?.total_ingresos)
  const gastos = toNumber(feed.summary?.total_gastos)
  const neto = toNumber(feed.summary?.neto)
  return (
    <section aria-label="Totales del período" className={`transition-opacity ${feed.stale ? 'opacity-60' : ''}`}>
      <div className="grid divide-y divide-slate-100 rounded-[24px] border border-slate-200 bg-white shadow-sm sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat
          label="Ingresos"
          value={<Amount value={ingresos} />}
          caption={`Total de ${monthPhrase(period, { year: false })}`}
          icon={TrendingUp}
          tone={ingresos > 0 ? 'emerald' : 'slate'}
        />
        <Stat label="Gastos" value={<Amount value={gastos > 0 ? -gastos : 0} />} caption="Ejecutado" icon={TrendingDown} tone={gastos > 0 ? 'red' : 'slate'} />
        <Stat label="Neto" value={<Amount value={neto} signed />} caption="Ingresos − gastos" icon={Wallet} tone={signTone(neto)} />
      </div>
      <p className="mt-2 px-1 text-xs text-slate-500">
        {hasFilters ? 'Totales con los filtros aplicados. ' : ''}
        Las transferencias entre tus cuentas y los ajustes de saldo no se cuentan como ingreso ni gasto.
      </p>
    </section>
  )
}

/** Barra de resultados: conteo (región viva) + descarga con los filtros actuales. */
export function ResultsBar({ statusText, working, hasFilters, periodPhrase, exporting, exportDisabled, onExport }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <output aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-slate-600">
        {working && <LoaderCircle className="h-4 w-4 animate-spin text-emerald-600" aria-hidden="true" />}
        <span>{statusText}</span>
      </output>
      <button
        type="button"
        onClick={onExport}
        disabled={exportDisabled}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
      >
        {exporting ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-4 w-4" aria-hidden="true" />
        )}
        {exporting ? 'Preparando Excel…' : `Descargar Excel de ${periodPhrase}`}
        {hasFilters && <span className="sr-only"> (con los filtros aplicados)</span>}
      </button>
    </div>
  )
}

/** La lista ya cargada no se pudo actualizar (se sigue mostrando la anterior). */
export function RefreshError({ feed }) {
  if (feed.status !== 'ready' || !feed.error || feed.refreshing) return null
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <span>No pudimos actualizar la lista; puede estar desactualizada. {feed.error.message}</span>
      <button type="button" onClick={feed.reload} className={NOTICE_LINK_BUTTON}>
        Reintentar
      </button>
    </div>
  )
}

function FeedError({ feed, onShowAllAccounts }) {
  const accountFilterError = feed.error?.fieldErrors?.cuenta_id
  if (!accountFilterError) {
    return <ErrorState title="No pudimos cargar tus movimientos" error={feed.error} onRetry={feed.reload} />
  }
  return (
    <EmptyState
      icon={FileSearch}
      title="No encontramos esa cuenta"
      description={`${accountFilterError} Quita el filtro de cuenta para ver todos tus movimientos.`}
      action={
        <button type="button" onClick={onShowAllAccounts} className={SECONDARY_BUTTON}>
          Ver todas las cuentas
        </button>
      }
    />
  )
}

function EmptyResults({ hasFilters, periodPhrase, accounts, onClearFilters, onNewTransaction }) {
  if (hasFilters) {
    return (
      <EmptyState
        icon={FileSearch}
        title="Sin resultados"
        description={`Ningún movimiento de ${periodPhrase} coincide con los filtros elegidos.`}
        action={
          <button type="button" onClick={onClearFilters} className={SECONDARY_BUTTON}>
            Limpiar filtros
          </button>
        }
      />
    )
  }
  return (
    <EmptyState
      icon={ReceiptText}
      title={`No hay movimientos en ${periodPhrase}`}
      description={
        accounts.none
          ? 'Crea tu primera cuenta y luego registra tus ingresos y gastos.'
          : 'Registra un ingreso o un gasto, o elige otro período en el selector de arriba.'
      }
      action={
        accounts.none ? (
          <Link to="/app/cuentas" className={PRIMARY_BUTTON}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Crear una cuenta
          </Link>
        ) : (
          <button type="button" onClick={onNewTransaction} disabled={!accounts.ready} className={PRIMARY_BUTTON}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva transacción
          </button>
        )
      }
    />
  )
}

function LoadMore({ feed, count }) {
  if (!feed.hasMore && !feed.moreError) return null
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      {feed.moreError && (
        <p role="alert" className="text-center text-sm text-red-600">
          No se pudieron cargar más movimientos. {feed.moreError.message}
        </p>
      )}
      <button type="button" onClick={feed.loadMore} disabled={feed.loadingMore || feed.refreshing} className={`${SECONDARY_BUTTON} w-full sm:w-auto`}>
        {feed.loadingMore && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {loadMoreLabel({ loadingMore: feed.loadingMore, moreError: feed.moreError, count, loaded: feed.loaded })}
      </button>
      <p className="text-xs text-slate-500">
        Mostrando {feed.loaded} de {count}
      </p>
    </div>
  )
}

/**
 * Lista según el estado del listado: esqueleto, error (o cuenta filtrada inexistente), vacío o grupos por día.
 * `actions`: `{ open(type, item), remove(item), clearFilters(), showAllAccounts() }`.
 */
export function FeedContent({ feed, count, hasFilters, periodPhrase, accounts, busyId, highlightId, actions }) {
  if (feed.status === 'loading') {
    return (
      <output className="block space-y-4" aria-label="Cargando movimientos">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </output>
    )
  }
  if (feed.status === 'error') return <FeedError feed={feed} onShowAllAccounts={actions.showAllAccounts} />
  if (feed.status !== 'ready') return null

  return (
    <div className={`transition-opacity ${feed.stale ? 'pointer-events-none opacity-60' : ''}`} aria-busy={feed.stale || undefined}>
      {count === 0 ? (
        <EmptyResults
          hasFilters={hasFilters}
          periodPhrase={periodPhrase}
          accounts={accounts}
          onClearFilters={actions.clearFilters}
          onNewTransaction={() => actions.open('transaction')}
        />
      ) : (
        <>
          <TransactionList
            groups={feed.groups}
            busyId={busyId}
            highlightId={highlightId}
            onOpen={(item) => actions.open('detail', item)}
            onEdit={(item) => actions.open('edit', item)}
            onDelete={actions.remove}
          />
          <LoadMore feed={feed} count={count} />
        </>
      )}
    </div>
  )
}

/** Diálogo abierto: detalle, nueva/editar transacción, transferencia o depósito. */
export function MovementDialogs({ dialog, onClose, onEdit, onDelete }) {
  switch (dialog?.type) {
    case 'detail':
      return <TransactionDetailSheet item={dialog.item} onClose={onClose} onEdit={onEdit} onDelete={onDelete} />
    case 'transaction':
      return <TransactionDialog key="new" onClose={onClose} />
    case 'edit':
      return <TransactionDialog key="edit" transaction={dialog.item} onClose={onClose} />
    case 'transfer':
      return <TransferDialog onClose={onClose} />
    case 'deposit':
      return <DepositDialog onClose={onClose} />
    default:
      return null
  }
}
