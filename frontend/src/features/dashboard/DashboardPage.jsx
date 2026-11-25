import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, Download, ListOrdered, Plus, X } from 'lucide-react'
import Alert from '../../components/auth/Alert'
import { ErrorState } from '../../components/ui'
import { usePeriod } from '../../context/PeriodContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { toNumber } from '../../lib/format'
import { monthPhrase } from '../../lib/period'
import { useAccounts } from '../accounts/useAccounts'
import { DepositDialog, TransactionDialog, TransferDialog } from '../transactions/TransactionDialogs'
import { useExportTransactions } from '../transactions/useExportTransactions'
import AlertsCard from './AlertsCard'
import BalanceCard from './BalanceCard'
import BalanceChart from './BalanceChart'
import DashboardSkeleton from './DashboardSkeleton'
import ExpenseDonut from './ExpenseDonut'
import OnboardingCard from './OnboardingCard'
import RecentTransactions from './RecentTransactions'
import { BudgetCard, FlowCard } from './SummaryCards'
import TaxPromoCard from './TaxPromoCard'
import { movementsLink } from './dashboardUtils'
import { useDashboard } from './useDashboard'

const SECONDARY_BUTTON =
  'inline-flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 sm:flex-none'

/** Aviso "cuenta creada" que RegisterPage envía en `location.state` (se muestra una sola vez). */
function useWelcomeNotice() {
  const location = useLocation()
  const navigate = useNavigate()
  const [notice, setNotice] = useState(() =>
    location.state?.justRegistered ? { emailDeliveryConfigured: location.state.emailDeliveryConfigured } : null,
  )

  useEffect(() => {
    if (location.state?.justRegistered) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
    }
  }, [location, navigate])

  return [notice, () => setNotice(null)]
}

function periodStatus(period, defaultPeriod) {
  if (period === defaultPeriod) return 'Mes en curso'
  return period > defaultPeriod ? 'Mes siguiente' : 'Mes cerrado'
}

export default function DashboardPage() {
  useDocumentTitle('Resumen')
  const { period, search, defaultPeriod, label } = usePeriod()
  const dashboard = useDashboard(period)
  const accounts = useAccounts()
  const { exportCsv, exporting } = useExportTransactions()
  const [dialog, setDialog] = useState(null)
  const [welcome, dismissWelcome] = useWelcomeNotice()

  const data = dashboard.data
  const accountsLoading = accounts.status === 'loading'
  // null = aún no se sabe (cargando o error): los diálogos se encargan de explicar si falta una cuenta.
  const accountCount =
    accounts.status === 'ready' ? (accounts.data?.accounts ?? []).filter((account) => !account.archivada).length : null
  const hasHistory = Boolean(data) && ((data.evolucion_saldo?.length ?? 0) > 0 || (data.ultimas_transacciones?.length ?? 0) > 0)
  const onboarding = Boolean(data) && accountCount === 0 && !hasHistory
  // Sin historial no sabemos si es un usuario nuevo hasta tener las cuentas: evitamos mostrar ceros un instante.
  const waiting = dashboard.status === 'loading' || (Boolean(data) && accountsLoading && !hasHistory)
  const canRegister = accountCount !== 0

  const closeDialog = () => setDialog(null)
  const openTransaction = (initialValues) => setDialog({ type: 'transaction', initialValues })

  const header = (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Panel principal</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Resumen financiero</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-500">
          <CalendarDays className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <span>
            {label} · {periodStatus(period, defaultPeriod)}
          </span>
        </p>
      </div>

      {!onboarding && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openTransaction()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-200 transition hover:bg-[#059669] sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva transacción
          </button>
          <Link to={movementsLink(period)} className={SECONDARY_BUTTON}>
            <ListOrdered className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Ver movimientos
          </Link>
          <button type="button" onClick={() => exportCsv({ mes: period })} disabled={exporting} className={SECONDARY_BUTTON}>
            <Download className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            {exporting ? 'Exportando…' : 'Exportar CSV'}
            <span className="sr-only"> de {monthPhrase(period)}</span>
          </button>
        </div>
      )}
    </div>
  )

  const welcomeNotice = welcome && (
    <div className="space-y-3">
      <Alert tone="success">
        <div className="flex items-start justify-between gap-3">
          <span>Tu cuenta se creó correctamente y tu sesión ya está activa.</span>
          <button
            type="button"
            onClick={dismissWelcome}
            aria-label="Cerrar aviso"
            className="-m-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </Alert>
      {welcome.emailDeliveryConfigured === false && (
        <Alert tone="info">La verificación por correo está pendiente: el envío de correos aún no está configurado en este entorno.</Alert>
      )}
    </div>
  )

  let content
  if (waiting) {
    content = <DashboardSkeleton />
  } else if (dashboard.status === 'error') {
    content = <ErrorState title="No pudimos cargar tu resumen" error={dashboard.error} onRetry={dashboard.reload} />
  } else if (onboarding) {
    content = (
      <>
        <OnboardingCard hasBudget={toNumber(data.presupuesto_limite) > 0} search={search} />
        <TaxPromoCard search={search} />
      </>
    )
  } else {
    content = (
      <>
        <BalanceCard
          data={data}
          period={period}
          defaultPeriod={defaultPeriod}
          accountCount={accountCount}
          accountsLoading={accountsLoading}
          hasHistory={hasHistory}
          search={search}
          onTransfer={() => setDialog({ type: 'transfer' })}
          onDeposit={() => setDialog({ type: 'deposit' })}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <FlowCard kind="income" data={data} period={period} />
          <FlowCard kind="expense" data={data} period={period} />
          <BudgetCard data={data} period={period} search={search} className="sm:col-span-2 xl:col-span-1" />
        </div>

        <AlertsCard data={data} period={period} search={search} />

        <div className="grid gap-5 md:grid-cols-2">
          <BalanceChart data={data} />
          <ExpenseDonut
            data={data}
            period={period}
            canRegister={canRegister}
            onRegisterExpense={() => openTransaction({ type: 'GASTO' })}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <RecentTransactions data={data} period={period} canRegister={canRegister} onRegister={() => openTransaction()} />
          </div>
          <TaxPromoCard search={search} aside />
        </div>
      </>
    )
  }

  return (
    <div className="space-y-5">
      {header}
      {welcomeNotice}
      {content}

      {dialog?.type === 'transaction' && <TransactionDialog initialValues={dialog.initialValues} onClose={closeDialog} />}
      {dialog?.type === 'transfer' && <TransferDialog onClose={closeDialog} />}
      {dialog?.type === 'deposit' && <DepositDialog onClose={closeDialog} />}
    </div>
  )
}
