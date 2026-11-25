import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { EmptyState, ErrorState, Skeleton, SkeletonCard, useConfirm, useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { usePeriod } from '../../context/PeriodContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { transactionsApi } from '../../lib/api/transactions'
import { toNumber } from '../../lib/format'
import { monthPhrase } from '../../lib/period'
import { useAccounts } from '../accounts/useAccounts'
import { DepositDialog, TransactionDialog, TransferDialog } from './TransactionDialogs'
import TransactionFilters from './TransactionFilters'
import { Amount } from './Money'
import TransactionList, { TransactionDetailSheet } from './TransactionList'
import { useMovementFocus } from './useMovementFocus'
import { useExportTransactions } from './useExportTransactions'
import { useTransactionFilters } from './useTransactionFilters'
import { MONEY_MOVEMENT_TAGS, PAGE_SIZE, useCategories, useTransactionFeed } from './useTransactions'
import { useVisibleMoney } from './useVisibleMoney'

const PRIMARY_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#10B981] px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'
const SECONDARY_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

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

/** Textos del diálogo de eliminar. `money` respeta "Ocultar montos" ('••••'). */
function deleteRequest(item, money) {
  const amount = money(Math.abs(toNumber(item.monto)))
  if (item.kind === 'TRANSFER') {
    return {
      title: 'Eliminar transferencia',
      message: `«${item.nombre}» tiene dos movimientos: la salida de una cuenta y la entrada en la otra. Al eliminarla se borran ambos y se restauran los saldos de las dos cuentas (${amount}). Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar ambos movimientos',
    }
  }
  if (item.kind === 'DEPOSIT') {
    return {
      title: 'Eliminar depósito',
      message: `Se eliminará «${item.nombre}» y se descontarán ${amount} del saldo de ${item.cuenta || 'la cuenta'}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar depósito',
    }
  }
  const effect = item.tipo === 'INGRESO' ? `se descontarán ${amount} del saldo` : `se devolverán ${amount} al saldo`
  return {
    title: 'Eliminar movimiento',
    message: `Se eliminará «${item.nombre}» y ${effect} de ${item.cuenta || 'la cuenta'}. Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
  }
}

function Stat({ label, value, caption, icon: Icon, tone }) {
  const tones = {
    emerald: { icon: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-600' },
    red: { icon: 'bg-red-50 text-red-600', value: 'text-red-600' },
    slate: { icon: 'bg-slate-100 text-slate-600', value: 'text-slate-900' },
  }
  const style = tones[tone] ?? tones.slate
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

export default function TransactionsPage() {
  useDocumentTitle('Movimientos')
  const { period, label: periodLabel } = usePeriod()
  const periodPhrase = monthPhrase(period)
  const { text: money } = useVisibleMoney()
  const filters = useTransactionFilters()
  const feed = useTransactionFeed(filters.apiFilters)
  // ?movimiento=<id> (enlace de una alerta): se resalta esa fila y se quita el parámetro de la URL.
  const [searchParams] = useSearchParams()
  const focus = useMovementFocus(searchParams.get('movimiento'), feed, filters.setFilter)
  const accounts = useAccounts()
  const categories = useCategories()
  const invalidate = useInvalidate()
  const toast = useToast()
  const confirm = useConfirm()
  const { exportCsv, exporting } = useExportTransactions()
  const [dialog, setDialog] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const accountList = useMemo(() => (accounts.data?.accounts ?? []).filter((account) => !account.archivada), [accounts.data])
  const accountsReady = accounts.status === 'ready'
  const accountCount = accountList.length
  const noAccounts = accountsReady && accountCount === 0
  const canTransfer = accountsReady && accountCount >= 2

  // Enlaces antiguos con ?cuenta=<nombre>: se cambian por el id en cuanto cargan las cuentas.
  const { cuentaName, resolveAccountName } = filters
  useEffect(() => {
    if (cuentaName && accountsReady) resolveAccountName(accounts.data?.accounts ?? [])
  }, [cuentaName, accountsReady, accounts.data, resolveAccountName])

  const summary = feed.summary
  const count = summary?.count ?? 0
  const ingresos = toNumber(summary?.total_ingresos)
  const gastos = toNumber(summary?.total_gastos)
  const neto = toNumber(summary?.neto)
  const accountFilterError = feed.status === 'error' ? feed.error?.fieldErrors?.cuenta_id : null

  const closeDialog = () => setDialog(null)

  async function removeMovement(item) {
    setDialog(null)
    const ok = await confirm({ ...deleteRequest(item, money), tone: 'danger' })
    if (!ok) return
    setBusyId(item.id)
    try {
      await transactionsApi.remove(item.id)
      invalidate(MONEY_MOVEMENT_TAGS)
      toast.success(item.kind === 'TRANSFER' ? 'Transferencia eliminada: se borraron sus dos movimientos.' : 'Movimiento eliminado.')
    } catch (error) {
      // 404: ya se había eliminado (otra pestaña): se actualiza la lista igual.
      if (error?.status === 404) invalidate(MONEY_MOVEMENT_TAGS)
      toast.error(error?.message || 'No se pudo eliminar el movimiento.')
    } finally {
      setBusyId(null)
    }
  }

  const statusText =
    feed.status === 'loading' || feed.stale
      ? 'Buscando movimientos…'
      : feed.status === 'error'
        ? 'No se pudieron cargar los movimientos.'
        : count === 0
          ? filters.hasFilters
            ? 'Ningún movimiento coincide con los filtros.'
            : `Sin movimientos en ${periodPhrase}.`
          : `${plural(count, 'movimiento', 'movimientos')}${filters.hasFilters ? ' con estos filtros' : ''}${
              feed.loaded < count ? ` · mostrando ${feed.loaded}` : ''
            }`

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Encabezado + acciones. En columna hasta xl: con el sidebar (1024 px) no caben en una fila y "Depositar" quedaba solo. */}
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
          <button
            type="button"
            onClick={() => setDialog({ type: 'transaction' })}
            disabled={!accountsReady || noAccounts}
            className={`${PRIMARY_BUTTON} col-span-2`}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva transacción
          </button>
          <button
            type="button"
            onClick={() => setDialog({ type: 'transfer' })}
            disabled={!canTransfer}
            aria-describedby={accountsReady && !canTransfer ? 'transfer-requirement' : undefined}
            className={SECONDARY_BUTTON}
          >
            <ArrowRightLeft className="h-4 w-4 text-sky-600" aria-hidden="true" />
            Transferir
          </button>
          <button
            type="button"
            onClick={() => setDialog({ type: 'deposit' })}
            disabled={!accountsReady || noAccounts}
            className={SECONDARY_BUTTON}
          >
            <Wallet className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Depositar
          </button>
        </div>
      </div>

      {/* Enlace de una alerta (?movimiento=<id>) cuyo movimiento no está en la lista: aviso visible arriba. */}
      {focus.missing && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-amber-200 bg-amber-50 py-1 pl-4 pr-1 text-sm text-amber-900">
          <FileSearch className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 basis-56 py-2">
            {feed.hasMore
              ? 'El movimiento de la alerta no está entre los que se muestran. Puede estar más abajo.'
              : `No encontramos el movimiento de la alerta en ${periodPhrase}${filters.hasFilters ? ' con estos filtros' : ''}: puede que se haya editado o eliminado.`}
          </span>
          <span className="flex items-center gap-1">
            {feed.hasMore ? (
              <button type="button" onClick={feed.loadMore} className="inline-flex min-h-10 items-center rounded-lg px-2 font-semibold text-amber-900 underline">
                Cargar más
              </button>
            ) : (
              filters.hasFilters && (
                <button type="button" onClick={filters.clearFilters} className="inline-flex min-h-10 items-center rounded-lg px-2 font-semibold text-amber-900 underline">
                  Quitar filtros
                </button>
              )
            )}
            <button
              type="button"
              onClick={focus.dismiss}
              aria-label="Cerrar aviso"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-amber-900 hover:bg-amber-100"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        </div>
      )}

      {/* Requisitos de cuentas, con texto visible (un title no se ve en pantallas táctiles). */}
      {noAccounts ? (
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
      ) : (
        accountsReady &&
        !canTransfer && (
          <p id="transfer-requirement" className="-mt-2 flex flex-wrap items-center gap-x-1 text-sm text-slate-500">
            <span>Para transferir necesitas al menos dos cuentas activas (tienes una).</span>
            <Link to="/app/cuentas" className="inline-flex min-h-10 items-center font-semibold text-emerald-700 hover:underline">
              Agregar otra cuenta
            </Link>
          </p>
        )
      )}

      {/* Resumen del período (respeta los filtros) */}
      {feed.status === 'loading' ? (
        <SummarySkeleton />
      ) : feed.status === 'ready' ? (
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
            <Stat
              label="Neto"
              value={<Amount value={neto} signed />}
              caption="Ingresos − gastos"
              icon={Wallet}
              tone={neto > 0 ? 'emerald' : neto < 0 ? 'red' : 'slate'}
            />
          </div>
          <p className="mt-2 px-1 text-xs text-slate-500">
            {filters.hasFilters ? 'Totales con los filtros aplicados. ' : ''}
            Las transferencias entre tus cuentas y los ajustes de saldo no se cuentan como ingreso ni gasto.
          </p>
        </section>
      ) : null}

      <TransactionFilters
        filters={filters}
        categories={categories.data?.categorias}
        accounts={accountList}
        accountsLoading={accounts.status === 'loading'}
      />

      {/* Barra de resultados: conteo (región viva) + descarga con los filtros actuales */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-slate-600">
          {(feed.stale || feed.refreshing || filters.searchPending) && (
            <LoaderCircle className="h-4 w-4 animate-spin text-emerald-600" aria-hidden="true" />
          )}
          <span>{statusText}</span>
        </p>
        <button
          type="button"
          onClick={() => exportCsv(filters.apiFilters)}
          disabled={exporting || feed.status !== 'ready' || count === 0}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
        >
          {exporting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4" aria-hidden="true" />
          )}
          {exporting ? 'Preparando…' : `Descargar CSV de ${periodPhrase}`}
          {filters.hasFilters && <span className="sr-only"> (con los filtros aplicados)</span>}
        </button>
      </div>

      {feed.status === 'ready' && feed.error && !feed.refreshing && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>No pudimos actualizar la lista; puede estar desactualizada. {feed.error.message}</span>
          <button type="button" onClick={feed.reload} className="inline-flex min-h-10 items-center rounded-lg px-2 font-semibold text-amber-900 underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Lista */}
      {feed.status === 'loading' && (
        <div className="space-y-4" role="status" aria-label="Cargando movimientos">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      )}

      {feed.status === 'error' &&
        (accountFilterError ? (
          <EmptyState
            icon={FileSearch}
            title="No encontramos esa cuenta"
            description={`${accountFilterError} Quita el filtro de cuenta para ver todos tus movimientos.`}
            action={
              <button type="button" onClick={() => filters.setFilter('cuenta', '')} className={SECONDARY_BUTTON}>
                Ver todas las cuentas
              </button>
            }
          />
        ) : (
          <ErrorState title="No pudimos cargar tus movimientos" error={feed.error} onRetry={feed.reload} />
        ))}

      {feed.status === 'ready' && (
        <div className={`transition-opacity ${feed.stale ? 'pointer-events-none opacity-60' : ''}`} aria-busy={feed.stale || undefined}>
          {count === 0 ? (
            filters.hasFilters ? (
              <EmptyState
                icon={FileSearch}
                title="Sin resultados"
                description={`Ningún movimiento de ${periodPhrase} coincide con los filtros elegidos.`}
                action={
                  <button type="button" onClick={filters.clearFilters} className={SECONDARY_BUTTON}>
                    Limpiar filtros
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={ReceiptText}
                title={`No hay movimientos en ${periodPhrase}`}
                description={
                  noAccounts
                    ? 'Crea tu primera cuenta y luego registra tus ingresos y gastos.'
                    : 'Registra un ingreso o un gasto, o elige otro período en el selector de arriba.'
                }
                action={
                  noAccounts ? (
                    <Link to="/app/cuentas" className={PRIMARY_BUTTON}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Crear una cuenta
                    </Link>
                  ) : (
                    <button type="button" onClick={() => setDialog({ type: 'transaction' })} disabled={!accountsReady} className={PRIMARY_BUTTON}>
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Nueva transacción
                    </button>
                  )
                }
              />
            )
          ) : (
            <>
              <TransactionList
                groups={feed.groups}
                busyId={busyId}
                highlightId={focus.highlightId}
                onOpen={(item) => setDialog({ type: 'detail', item })}
                onEdit={(item) => setDialog({ type: 'edit', item })}
                onDelete={removeMovement}
              />

              {(feed.hasMore || feed.moreError) && (
                <div className="mt-4 flex flex-col items-center gap-2">
                  {feed.moreError && (
                    <p role="alert" className="text-center text-sm text-red-600">
                      No se pudieron cargar más movimientos. {feed.moreError.message}
                    </p>
                  )}
                  <button type="button" onClick={feed.loadMore} disabled={feed.loadingMore || feed.refreshing} className={`${SECONDARY_BUTTON} w-full sm:w-auto`}>
                    {feed.loadingMore && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {feed.loadingMore ? 'Cargando…' : feed.moreError ? 'Reintentar' : `Cargar más (${Math.min(PAGE_SIZE, count - feed.loaded)})`}
                  </button>
                  <p className="text-xs text-slate-500">
                    Mostrando {feed.loaded} de {count}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {dialog?.type === 'detail' && (
        <TransactionDetailSheet
          item={dialog.item}
          onClose={closeDialog}
          onEdit={(item) => setDialog({ type: 'edit', item })}
          onDelete={removeMovement}
        />
      )}
      {dialog?.type === 'transaction' && <TransactionDialog onClose={closeDialog} />}
      {dialog?.type === 'edit' && <TransactionDialog transaction={dialog.item} onClose={closeDialog} />}
      {dialog?.type === 'transfer' && <TransferDialog onClose={closeDialog} />}
      {dialog?.type === 'deposit' && <DepositDialog onClose={closeDialog} />}
    </div>
  )
}
