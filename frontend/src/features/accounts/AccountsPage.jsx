import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft, Landmark, PencilLine, Plus, Wallet } from 'lucide-react'
import CategoryIcon from '../../components/finance/CategoryIcon'
import { EmptyState, ErrorState, FilterChips, IconButton, PageSkeleton } from '../../components/ui'
import { usePeriod } from '../../context/PeriodContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useMoney } from '../../hooks/useMoney'
import AlertCard, { ALL_ALERTS, alertFilterOptions, filterAlerts } from '../alerts/AlertCard'
import { useAlertActions, useAlerts } from '../alerts/useAlerts'
import { RebalanceDialog } from '../budgets/BudgetDialogs'
import { TransactionDialog, TransferDialog } from '../transactions/TransactionDialogs'
import { useExportTransactions } from '../transactions/useExportTransactions'
import { AccountBalanceDialog, AccountDialog } from './AccountDialogs'
import { useAccounts } from './useAccounts'

const BADGE_STYLES = {
  Activa: 'bg-emerald-100 text-emerald-700',
  Instantánea: 'bg-indigo-100 text-indigo-700',
}

export default function AccountsPage() {
  useDocumentTitle('Cuentas')
  const navigate = useNavigate()
  const { search } = usePeriod()
  const { money } = useMoney()
  const accounts = useAccounts()
  const alerts = useAlerts()
  const { act } = useAlertActions()
  const { exportCsv } = useExportTransactions()
  const [view, setView] = useState('accounts')
  const [alertFilter, setAlertFilter] = useState(ALL_ALERTS)
  const [dialog, setDialog] = useState(null)
  const closeDialog = () => setDialog(null)

  const accountList = accounts.data?.accounts ?? []
  const alertItems = alerts.data?.items ?? []
  const filteredAlerts = useMemo(() => filterAlerts(alertItems, alertFilter), [alertItems, alertFilter])

  const tabs = [
    {
      key: 'accounts',
      label: (
        <>
          Mis Cuentas
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">{accountList.length}</span>
        </>
      ),
    },
    {
      key: 'alerts',
      label: (
        <>
          Alertas Activas
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">{alertItems.length}</span>
        </>
      ),
    },
  ]

  function goToTransactions(account) {
    const params = new URLSearchParams(search)
    params.set('cuenta', account.nombre)
    navigate({ pathname: '/app/movimientos', search: `?${params}` })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Cuentas & Centro de Alertas</h1>
          <p className="mt-2 text-sm text-slate-500">Gestión patrimonial y alertas en tiempo real</p>
        </div>
        <button
          type="button"
          onClick={() => setDialog({ type: 'account' })}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-[#10B981] px-4 py-3 text-sm font-semibold text-white hover:bg-[#059669] sm:self-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Cuenta
        </button>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
        <FilterChips label="Vista" options={tabs} value={view} onChange={setView} chipClassName="px-4 font-semibold" />
      </div>

      {view === 'accounts' ? (
        <>
          {accounts.status === 'loading' && <PageSkeleton title={false} stats={2} blocks={2} label="Cargando cuentas" />}
          {accounts.status === 'error' && (
            <ErrorState title="No pudimos cargar tus cuentas" error={accounts.error} onRetry={accounts.reload} />
          )}
          {accounts.status === 'ready' && (
            <div className="space-y-6">
              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="net-worth-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <Landmark className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h2 id="net-worth-title" className="text-lg font-semibold text-slate-900">
                      Patrimonio Neto Consolidado
                    </h2>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">• {accountList.length} Conectadas</span>
                </div>
                <div className="mt-5">
                  <p className="break-words text-4xl font-extrabold text-slate-900">{money(accounts.data.patrimonio)}</p>
                  <span className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {accountList.length > 0 ? '↗ +6.4% mes' : '0.0% mes'}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Liquidez Inmediata</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{money(accounts.data.liquidez)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Efectivo Físico</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{money(accounts.data.efectivo)}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="accounts-list-title">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 id="accounts-list-title" className="text-xl font-bold text-slate-900">
                    Bancos & Billeteras Conectadas
                  </h2>
                  <span className="text-sm text-slate-500">Actualizado hoy 10:45 AM</span>
                </div>

                <ul className="mt-5 space-y-4">
                  {accountList.map((account) => (
                    <li key={account.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                            <CategoryIcon name={account.icon} className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="break-words text-lg font-bold text-slate-900">{account.nombre}</p>
                              {account.estado === 'Activa' && (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Cuenta activa" role="img" />
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                              {account.badge && (
                                <span
                                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${BADGE_STYLES[account.badge] ?? 'bg-amber-100 text-amber-700'}`}
                                >
                                  {account.badge}
                                </span>
                              )}
                              <span className="break-words">
                                {account.tipo}
                                {account.descripcion ? ` • ${account.descripcion}` : ''}
                              </span>
                            </div>
                          </div>
                        </div>
                        <IconButton label={`Actualizar saldo de ${account.nombre}`} onClick={() => setDialog({ type: 'balance', account })}>
                          <PencilLine className="h-4 w-4" />
                        </IconButton>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Saldo Disponible</p>
                          <p className="mt-1 break-words text-2xl font-bold text-slate-900">{money(account.saldo)}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 sm:justify-start">
                          <button
                            type="button"
                            onClick={() => goToTransactions(account)}
                            className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Movimientos
                          </button>
                          <IconButton
                            label={`Transferir desde ${account.nombre}`}
                            variant="dark"
                            shape="square"
                            disabled={accountList.length < 2}
                            onClick={() => setDialog({ type: 'transfer', initialValues: { source_account_id: String(account.id) } })}
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {accountList.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                    <Wallet className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
                    <p className="mt-2 text-sm text-slate-600">Aún no tienes cuentas agregadas.</p>
                    <button
                      type="button"
                      onClick={() => setDialog({ type: 'account' })}
                      className="mt-3 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Agregar primera cuenta
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="account-alerts-title">
            <div>
              <h2 id="account-alerts-title" className="text-2xl font-bold text-slate-900">
                Alertas del Sistema Financiero
              </h2>
              <p className="mt-1 text-sm text-slate-500">Monitoreo continuo de desvíos y vencimientos</p>
            </div>
            {alerts.status === 'ready' && (
              <FilterChips
                className="mt-5"
                tone="emerald"
                label="Filtrar alertas"
                options={alertFilterOptions(alerts.data.filters)}
                value={alertFilter}
                onChange={setAlertFilter}
              />
            )}
          </section>

          {alerts.status === 'loading' && <PageSkeleton title={false} stats={0} blocks={2} label="Cargando alertas" />}
          {alerts.status === 'error' && <ErrorState title="No pudimos cargar tus alertas" error={alerts.error} onRetry={alerts.reload} />}
          {alerts.status === 'ready' && (
            <div className="space-y-4">
              {filteredAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert}>
                  {alert.nivel === 'rojo' && (
                    <button
                      type="button"
                      onClick={() => setDialog({ type: 'rebalance' })}
                      className="min-h-10 rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                    >
                      Reasignar fondo
                    </button>
                  )}
                  {alert.nivel === 'amber' && (
                    <button
                      type="button"
                      onClick={() => act(alert, 'confirm')}
                      className="min-h-10 rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
                    >
                      Confirmar gasto
                    </button>
                  )}
                  {alert.nivel === 'indigo' && (
                    <button
                      type="button"
                      onClick={() =>
                        setDialog({
                          type: 'transaction',
                          initialValues: { name: 'Pago tarjeta Interbank', category: 'Pago de tarjeta', amount: '480.00', type: 'GASTO' },
                        })
                      }
                      className="min-h-10 rounded-xl bg-[#10B981] px-3 py-2 text-sm font-semibold text-white hover:bg-[#059669]"
                    >
                      Pagar ahora S/ 480.00
                    </button>
                  )}
                  {alert.nivel === 'green' && (
                    <button type="button" onClick={exportCsv} className="min-h-10 rounded-xl text-sm font-semibold text-emerald-700 hover:underline">
                      Ver reporte detallado
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      alert.nivel === 'amber'
                        ? act(alert, 'confirm_fraud')
                        : alert.nivel === 'rojo'
                          ? act(alert, 'read')
                          : alert.nivel === 'indigo'
                            ? act(alert, 'snooze')
                            : exportCsv()
                    }
                    className="min-h-10 text-sm font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700"
                  >
                    {alert.nivel === 'amber'
                      ? 'Reportar fraude'
                      : alert.nivel === 'rojo'
                        ? 'Marcar como leída'
                        : alert.nivel === 'indigo'
                          ? 'Posponer 24h'
                          : 'Ver reporte detallado'}
                  </button>
                </AlertCard>
              ))}
              {filteredAlerts.length === 0 && <EmptyState variant="inline" className="bg-white" description="No hay alertas activas para este filtro." />}
            </div>
          )}
        </div>
      )}

      {dialog?.type === 'account' && <AccountDialog onClose={closeDialog} />}
      {dialog?.type === 'balance' && <AccountBalanceDialog account={dialog.account} onClose={closeDialog} />}
      {dialog?.type === 'transfer' && <TransferDialog initialValues={dialog.initialValues} onClose={closeDialog} />}
      {dialog?.type === 'transaction' && <TransactionDialog initialValues={dialog.initialValues} onClose={closeDialog} />}
      {dialog?.type === 'rebalance' && <RebalanceDialog onClose={closeDialog} />}
    </div>
  )
}
