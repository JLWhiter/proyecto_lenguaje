import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePeriod } from '../../context/PeriodContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { monthPhrase } from '../../lib/period'
import { useAccounts } from '../accounts/useAccounts'
import TransactionFilters from './TransactionFilters'
import {
  AccountRequirement,
  FeedContent,
  MissingMovementNotice,
  MovementDialogs,
  PageHeader,
  PeriodTotals,
  RefreshError,
  ResultsBar,
} from './TransactionsPageParts'
import { feedStatusText } from './movementText'
import { useMovementFocus } from './useMovementFocus'
import { useExportTransactions } from './useExportTransactions'
import { useRemoveMovement } from './useRemoveMovement'
import { useTransactionFilters } from './useTransactionFilters'
import { useCategories, useTransactionFeed } from './useTransactions'
import { useVisibleMoney } from './useVisibleMoney'

/** Estado de las cuentas activas para habilitar acciones: `{ ready, none, canTransfer }`. */
function accountAvailability(status, count) {
  const ready = status === 'ready'
  return { ready, none: ready && count === 0, canTransfer: ready && count >= 2 }
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
  const { exportExcel, exporting } = useExportTransactions()
  const [dialog, setDialog] = useState(null)
  const closeDialog = () => setDialog(null)
  const { busyId, removeMovement } = useRemoveMovement(money, closeDialog)

  const accountList = useMemo(() => (accounts.data?.accounts ?? []).filter((account) => !account.archivada), [accounts.data])
  const availability = accountAvailability(accounts.status, accountList.length)

  // Enlaces antiguos con ?cuenta=<nombre>: se cambian por el id en cuanto cargan las cuentas.
  const { cuentaName, resolveAccountName } = filters
  const accountsReady = availability.ready
  useEffect(() => {
    if (cuentaName && accountsReady) resolveAccountName(accounts.data?.accounts ?? [])
  }, [cuentaName, accountsReady, accounts.data, resolveAccountName])

  const count = feed.summary?.count ?? 0
  const openDialog = (type, item) => setDialog({ type, item })
  const statusText = feedStatusText({
    status: feed.status,
    stale: feed.stale,
    count,
    loaded: feed.loaded,
    hasFilters: filters.hasFilters,
    periodPhrase,
  })

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader periodLabel={periodLabel} accounts={availability} onOpen={openDialog} />

      {focus.missing && (
        <MissingMovementNotice
          hasMore={feed.hasMore}
          hasFilters={filters.hasFilters}
          periodPhrase={periodPhrase}
          onLoadMore={feed.loadMore}
          onClearFilters={filters.clearFilters}
          onDismiss={focus.dismiss}
        />
      )}

      <AccountRequirement accounts={availability} />

      <PeriodTotals feed={feed} hasFilters={filters.hasFilters} period={period} />

      <TransactionFilters
        filters={filters}
        categories={categories.data?.categorias}
        accounts={accountList}
        accountsLoading={accounts.status === 'loading'}
      />

      <ResultsBar
        statusText={statusText}
        working={feed.stale || feed.refreshing || filters.searchPending}
        hasFilters={filters.hasFilters}
        periodPhrase={periodPhrase}
        exporting={exporting}
        exportDisabled={exporting || feed.status !== 'ready' || count === 0}
        onExport={() => exportExcel(filters.apiFilters)}
      />

      <RefreshError feed={feed} />

      <FeedContent
        feed={feed}
        count={count}
        hasFilters={filters.hasFilters}
        periodPhrase={periodPhrase}
        accounts={availability}
        busyId={busyId}
        highlightId={focus.highlightId}
        actions={{
          open: openDialog,
          remove: removeMovement,
          clearFilters: filters.clearFilters,
          showAllAccounts: () => filters.setFilter('cuenta', ''),
        }}
      />

      <MovementDialogs
        dialog={dialog}
        onClose={closeDialog}
        onEdit={(item) => openDialog('edit', item)}
        onDelete={removeMovement}
      />
    </div>
  )
}
