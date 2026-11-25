import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, Trash2, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import CategoryIcon from '../../components/finance/CategoryIcon'
import { EmptyState, ErrorState, FilterChips, IconButton, PageSkeleton, useConfirm, useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { usePeriod } from '../../context/PeriodContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useMoney } from '../../hooks/useMoney'
import { transactionsApi } from '../../lib/api/transactions'
import { toNumber } from '../../lib/format'
import { monthName } from '../../lib/period'
import { useAccounts } from '../accounts/useAccounts'
import { TransactionDialog } from './TransactionDialogs'
import { useExportTransactions } from './useExportTransactions'
import { MONEY_MOVEMENT_TAGS, useTransactions } from './useTransactions'

const TYPE_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'income', label: 'Solo Ingresos' },
  { key: 'expense', label: 'Solo Gastos' },
  { key: 'food', label: 'Alimentación' },
]

function matchesType(item, type) {
  if (type === 'income') return item.tipo === 'INGRESO'
  if (type === 'expense') return item.tipo === 'GASTO'
  if (type === 'food') return item.categoria === 'Alimentación'
  return true
}

export default function TransactionsPage() {
  useDocumentTitle('Movimientos')
  const { period, setPeriod, options: periodOptions, label: periodLabel } = usePeriod()
  const { money, signedMoney } = useMoney()
  const transactions = useTransactions(period)
  const accounts = useAccounts()
  const invalidate = useInvalidate()
  const toast = useToast()
  const confirm = useConfirm()
  const { exportCsv, exporting } = useExportTransactions()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchText, setSearchText] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dialog, setDialog] = useState(null)

  // ?cuenta=<nombre> permite llegar filtrado desde "Mis cuentas".
  const accountFilter = searchParams.get('cuenta') || ''
  function setAccountFilter(value) {
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        if (value) next.set('cuenta', value)
        else next.delete('cuenta')
        return next
      },
      { replace: true },
    )
  }

  const accountList = accounts.data?.accounts ?? []
  const accountsReady = accounts.status === 'ready'
  const accountCount = accountList.length

  const groups = useMemo(() => {
    const text = searchText.trim().toLowerCase()
    return (transactions.data?.grupos ?? [])
      .map((group) => ({
        ...group,
        items: (group.items ?? []).filter((item) => {
          const matchesText =
            !text || item.nombre.toLowerCase().includes(text) || item.categoria.toLowerCase().includes(text)
          const matchesAccount = !accountFilter || item.subtexto?.toLowerCase().includes(accountFilter.toLowerCase())
          return matchesText && matchesType(item, typeFilter) && matchesAccount
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [transactions.data, searchText, typeFilter, accountFilter])

  const transactionCount = (transactions.data?.grupos ?? []).reduce((total, group) => total + (group.items?.length ?? 0), 0)

  async function removeTransaction(item) {
    const ok = await confirm({
      title: 'Eliminar movimiento',
      message: `¿Eliminar el movimiento "${item.nombre}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    })
    if (!ok) return
    try {
      await transactionsApi.remove(item.id)
      invalidate(MONEY_MOVEMENT_TAGS)
      toast.success('Movimiento eliminado.')
    } catch (error) {
      toast.error(error.message || 'No se pudo eliminar el movimiento.')
    }
  }

  const data = transactions.data
  const totalGastos = toNumber(data?.total_gastos)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Transacciones</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span>{periodLabel}</span>
            {data && (
              <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-medium normal-case tracking-normal text-slate-700">
                {transactionCount} movimientos
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ type: 'transaction' })}
          disabled={!accountsReady || accountCount === 0}
          title={accountsReady && accountCount === 0 ? 'Agrega primero una cuenta' : undefined}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#10B981] px-4 py-3 text-sm font-semibold text-white hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva
        </button>
      </div>

      {transactions.status === 'loading' && <PageSkeleton title={false} stats={3} blocks={2} label="Cargando movimientos" />}

      {transactions.status === 'error' && (
        <ErrorState title="No pudimos cargar tus movimientos" error={transactions.error} onRetry={transactions.reload} />
      )}

      {transactions.status === 'ready' && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Ingresos</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-emerald-600">{money(data.total_ingresos)}</p>
              <p className="mt-1 text-sm text-slate-500">Total {monthName(period)}</p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Gastos</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <TrendingDown className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-red-600">{money(totalGastos > 0 ? -totalGastos : 0)}</p>
              <p className="mt-1 text-sm text-slate-500">Ejecutado</p>
            </div>

            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-700">Neto</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-emerald-700">{money(data.neto)}</p>
              <p className="mt-1 text-sm text-emerald-700">Disponible</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <label className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="sr-only">Buscar movimientos</span>
                <input
                  type="search"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Buscar por comercio o descripción..."
                  className="w-full min-w-0 border-0 bg-transparent text-base text-slate-700 outline-none placeholder:text-slate-400 sm:text-sm"
                />
              </label>

              <FilterChips label="Tipo de movimiento" options={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                <span>Período</span>
                <select
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  className="min-w-0 max-w-[65%] bg-transparent text-right text-base outline-none sm:text-sm"
                >
                  {periodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                <span>Cuenta</span>
                <select
                  value={accountFilter}
                  onChange={(event) => setAccountFilter(event.target.value)}
                  className="min-w-0 max-w-[65%] bg-transparent text-right text-base outline-none sm:text-sm"
                >
                  <option value="">Todas las cuentas</option>
                  {accountFilter && !accountList.some((account) => account.nombre === accountFilter) && (
                    <option value={accountFilter}>{accountFilter}</option>
                  )}
                  {accountList.map((account) => (
                    <option key={account.id} value={account.nombre}>
                      {account.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.titulo} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm" aria-label={group.titulo}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{group.titulo}</h2>
                  <span className={`text-sm font-bold ${toNumber(group.total) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {signedMoney(group.total)}
                  </span>
                </div>

                <ul className="space-y-3">
                  {group.items.map((item) => {
                    const positive = toNumber(item.monto) >= 0
                    return (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:items-center"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                              item.tipo === 'GASTO' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            <CategoryIcon name={item.icon} className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-words font-semibold text-slate-900">{item.nombre}</p>
                              <span className="text-xs text-slate-500">{item.subtexto}</span>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${
                                  item.tipo === 'GASTO' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {item.categoria}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                              <span className={`font-bold ${positive ? 'text-emerald-600' : 'text-red-600'}`}>{signedMoney(item.monto)}</span>
                              <span aria-hidden="true">•</span>
                              <span>{item.hora}</span>
                            </div>
                          </div>
                        </div>

                        {item.custom && (
                          <IconButton label={`Eliminar ${item.nombre}`} variant="ghost" onClick={() => removeTransaction(item)}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>

          {groups.length === 0 && (
            <EmptyState
              variant="inline"
              className="border border-slate-200 bg-white p-5"
              description="No hay movimientos para este período o filtro."
            />
          )}

          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting ? 'Preparando descarga…' : 'Descargar historial de movimientos'}
          </button>
        </>
      )}

      {dialog?.type === 'transaction' && <TransactionDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
