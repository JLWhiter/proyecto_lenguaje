import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  EyeOff,
  FileText,
  Plus,
  SlidersHorizontal,
  TrendingDown,
  X,
} from 'lucide-react'
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Alert from '../../components/auth/Alert'
import CategoryIcon from '../../components/finance/CategoryIcon'
import { EmptyState, ErrorState, IconButton, PageSkeleton, ProgressBar } from '../../components/ui'
import { usePeriod } from '../../context/PeriodContext'
import { usePreferences } from '../../context/PreferencesContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useMoney } from '../../hooks/useMoney'
import { formatPercent, toNumber } from '../../lib/format'
import { monthName, shiftMonth } from '../../lib/period'
import { useAccounts } from '../accounts/useAccounts'
import { useAlertActions } from '../alerts/useAlerts'
import { DepositDialog, TransactionDialog, TransferDialog } from '../transactions/TransactionDialogs'
import { useExportTransactions } from '../transactions/useExportTransactions'
import { useDashboard } from './useDashboard'

const DASHBOARD_ALERT_STYLES = {
  warning: { card: 'border-l-amber-400 bg-amber-50/60', icon: 'bg-amber-100 text-amber-600', Icon: AlertTriangle },
  danger: { card: 'border-l-red-500 bg-red-50/70', icon: 'bg-red-100 text-red-600', Icon: CheckCircle2 },
  info: { card: 'border-l-blue-500 bg-sky-50/70', icon: 'bg-sky-100 text-sky-600', Icon: Activity },
}

function describeBalancePeriod(dashboard) {
  const months = dashboard.evolucion_saldo?.length ?? 0
  if (!months) return 'Sin movimientos registrados'
  const range = months === 1 ? 'Último mes' : `Últimos ${months} meses`
  return dashboard.evolucion_periodo ? `${range} (${dashboard.evolucion_periodo})` : range
}

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

export default function DashboardPage() {
  useDocumentTitle('Resumen')
  const navigate = useNavigate()
  const { period, search } = usePeriod()
  const { money, signedMoney } = useMoney()
  const { showAmounts, setShowAmounts } = usePreferences()
  const dashboard = useDashboard(period)
  const accounts = useAccounts()
  const { act } = useAlertActions()
  const { exportCsv, exporting } = useExportTransactions()
  const [dialog, setDialog] = useState(null)
  const [welcome, dismissWelcome] = useWelcomeNotice()

  const accountsReady = accounts.status === 'ready'
  const accountCount = accounts.data?.accounts?.length ?? 0
  const closeDialog = () => setDialog(null)
  const hidden = '••••'

  const header = (
    <>
      <h1 className="sr-only">Resumen financiero</h1>
      {welcome && (
        <div className="space-y-3">
          <Alert tone="success">
            <div className="flex items-start justify-between gap-3">
              <span>Tu cuenta se creó correctamente y tu sesión ya está activa.</span>
              <button type="button" onClick={dismissWelcome} aria-label="Cerrar aviso" className="-m-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>
          </Alert>
          {welcome.emailDeliveryConfigured === false && (
            <Alert tone="info">
              La verificación por correo está pendiente: el envío de correos aún no está configurado en este entorno.
            </Alert>
          )}
        </div>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setDialog({ type: 'transaction' })}
            disabled={!accountsReady || accountCount === 0}
            title={accountsReady && accountCount === 0 ? 'Agrega primero una cuenta' : undefined}
            className="inline-flex items-center gap-2 rounded-xl bg-[#10B981] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-200 hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva Transacción
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <FileText className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Ver Reporte
          </button>
          <Link
            to={{ pathname: '/app/movimientos', search }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <SlidersHorizontal className="h-4 w-4 text-slate-600" aria-hidden="true" />
            Filtros
          </Link>
        </div>
      </div>
    </>
  )

  const dialogs = (
    <>
      {dialog?.type === 'transaction' && <TransactionDialog onClose={closeDialog} />}
      {dialog?.type === 'transfer' && <TransferDialog onClose={closeDialog} />}
      {dialog?.type === 'deposit' && <DepositDialog onClose={closeDialog} />}
    </>
  )

  if (dashboard.status === 'loading') {
    return (
      <div className="space-y-5">
        {header}
        <PageSkeleton title={false} stats={3} blocks={3} label="Cargando resumen" />
        {dialogs}
      </div>
    )
  }

  if (dashboard.status === 'error') {
    return (
      <div className="space-y-5">
        {header}
        <ErrorState title="No pudimos cargar tu resumen" error={dashboard.error} onRetry={dashboard.reload} />
        {dialogs}
      </div>
    )
  }

  const data = dashboard.data
  const previousMonth = monthName(shiftMonth(period, -1))
  const currentMonthName = monthName(period).toLowerCase()
  const alerts = data.alertas_activas ?? []
  const recent = data.ultimas_transacciones ?? []
  const distribution = data.distribucion_gastos ?? []
  const evolution = data.evolucion_saldo ?? []
  const trendNegative = String(data.evolucion_tendencia).startsWith('-')

  return (
    <div className="space-y-5">
      {header}

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="balance-title">
        <div className="flex items-center justify-between">
          <h2 id="balance-title" className="text-base font-semibold text-slate-700">
            Balance Total Disponible
          </h2>
          <IconButton
            label={showAmounts ? 'Ocultar saldos' : 'Mostrar saldos'}
            aria-pressed={!showAmounts}
            variant="outline"
            onClick={() => setShowAmounts((value) => !value)}
            className="bg-slate-50 text-slate-600"
          >
            {showAmounts ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </IconButton>
        </div>

        <div className="mt-4">
          <p className="break-words text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
            {showAmounts ? money(data.balance_total) : hidden}
          </p>
          <div className="mt-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
            <ArrowUpRight className="mr-1 h-4 w-4" aria-hidden="true" />
            {data.balance_variacion}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setDialog({ type: 'transfer' })}
            disabled={!accountsReady || accountCount < 2}
            title={accountsReady && accountCount < 2 ? 'Necesitas dos cuentas para transferir' : undefined}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
            Transferir
          </button>
          <button
            type="button"
            onClick={() => setDialog({ type: 'deposit' })}
            disabled={!accountsReady || accountCount === 0}
            title={accountsReady && accountCount === 0 ? 'Agrega primero una cuenta' : undefined}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CircleDollarSign className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Depositar
          </button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-slate-700">Ingresos Mensuales</span>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900">{showAmounts ? money(data.ingresos_mensuales) : hidden}</span>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
              ↑ {data.ingresos_variacion}
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-500">vs {previousMonth}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-slate-700">Gastos Mensuales</span>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
              <TrendingDown className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900">{showAmounts ? money(data.gastos_mensuales) : hidden}</span>
            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">
              ↓ {data.gastos_variacion}
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-500">vs {previousMonth}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-slate-700">Presupuesto del período</span>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-2xl font-bold text-slate-900">{formatPercent(data.presupuesto_porcentaje)}</span>
            <span className="text-sm text-slate-500">Límite {money(data.presupuesto_limite)}</span>
          </div>
          <ProgressBar
            value={data.presupuesto_porcentaje}
            label="Presupuesto consumido"
            className="mt-4 h-3 bg-amber-100"
            barClassName="bg-gradient-to-r from-amber-400 to-orange-500"
          />
        </div>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="dashboard-alerts-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Bell className="h-4 w-4" aria-hidden="true" />
            </div>
            <h2 id="dashboard-alerts-title" className="text-xl font-bold text-slate-900">
              Centro de Alertas Activas
            </h2>
          </div>
          <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{alerts.length} pendientes</div>
        </div>

        <div className="mt-5 space-y-4">
          {alerts.map((alert) => {
            const style = DASHBOARD_ALERT_STYLES[alert.tipo] ?? DASHBOARD_ALERT_STYLES.info
            const Icon = style.Icon
            const actionTarget = String(alert.accion || '').toLowerCase().includes('presupuesto') ? '/app/presupuestos' : '/app/alertas'
            return (
              <div key={alert.id} className={`rounded-2xl border-l-4 p-4 ${style.card}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.icon}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{alert.titulo}</h3>
                      <span className="text-xs text-slate-500">{alert.tiempo}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{alert.descripcion}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-medium">
                      {alert.accion && (
                        <button
                          type="button"
                          onClick={() => navigate({ pathname: actionTarget, search })}
                          className="min-h-10 text-emerald-700 underline underline-offset-2"
                        >
                          {alert.accion}
                        </button>
                      )}
                      {alert.tipo !== 'info' && (
                        <button type="button" onClick={() => act(alert, 'snooze')} className="min-h-10 text-slate-500 hover:text-slate-700">
                          Postergar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          {alerts.length === 0 && <EmptyState variant="inline" description="No tienes alertas activas." />}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="evolution-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="evolution-title" className="text-2xl font-bold text-slate-900">
                Evolución de Saldo
              </h2>
              <p className="mt-1 text-sm text-slate-500">{describeBalancePeriod(data)}</p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                trendNegative ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              Tendencia {data.evolucion_tendencia || '0.0%'}
            </span>
          </div>

          {evolution.length > 0 ? (
            <div className="mt-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolution}>
                  <defs>
                    <linearGradient id="saldoFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis hide domain={['dataMin - 300', 'dataMax + 500']} />
                  <Tooltip
                    formatter={(value) => [money(value), 'Monto']}
                    labelStyle={{ color: '#0f172a' }}
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#0f172a', color: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#10B981"
                    strokeWidth={3}
                    fill="url(#saldoFill)"
                    dot={{ r: 5, fill: '#fff', stroke: '#10B981', strokeWidth: 3 }}
                    activeDot={{ r: 7, fill: '#fff', stroke: '#10B981', strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState variant="inline" className="mt-6" description="El gráfico aparecerá cuando registres movimientos." />
          )}
        </section>

        <section className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="distribution-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="distribution-title" className="text-2xl font-bold text-slate-900">
                Distribución de Gastos
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Total {currentMonthName}: {money(data.gastos_mensuales)}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {distribution.length} Categorías
            </span>
          </div>

          <div className="mt-5 flex items-center justify-center">
            <div className="relative h-56 w-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribution} dataKey="value" innerRadius={52} outerRadius={75} paddingAngle={2} stroke="white" strokeWidth={4}>
                    {distribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-medium text-slate-500">{currentMonthName}</span>
                <span className="text-2xl font-bold text-slate-900">{distribution.length ? '100%' : '0%'}</span>
              </div>
            </div>
          </div>

          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {distribution.map((category) => (
              <li key={category.name} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: category.color }} aria-hidden="true" />
                <span className="text-sm text-slate-700">
                  {category.name} ({category.value}%)
                </span>
              </li>
            ))}
          </ul>
          {distribution.length === 0 && <p className="mt-3 text-center text-sm text-slate-500">Sin gastos registrados en este período.</p>}
        </section>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="recent-title">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="recent-title" className="text-2xl font-bold text-slate-900">
              Transacciones Recientes
            </h2>
            <p className="mt-1 text-sm text-slate-500">Últimos movimientos sincronizados</p>
          </div>
          <Link to={{ pathname: '/app/movimientos', search }} className="shrink-0 py-2 text-sm font-semibold text-emerald-700 hover:underline">
            Ver todas
          </Link>
        </div>

        <ul className="mt-5 space-y-4">
          {recent.map((item) => {
            const positive = toNumber(item.monto) >= 0
            return (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                      positive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}
                  >
                    <CategoryIcon name={positive ? 'income' : 'shopping'} className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="break-words font-semibold text-slate-900">{item.nombre}</p>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                        }`}
                      >
                        • {item.categoria}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-sm text-slate-500">
                      {item.fecha} • {item.cuenta}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2 sm:block sm:shrink-0 sm:border-0 sm:pt-0 sm:text-right">
                  <p className={`whitespace-nowrap text-lg font-bold ${positive ? 'text-emerald-600' : 'text-red-600'}`}>{signedMoney(item.monto)}</p>
                  <span className="mt-1 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {item.estado}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
        {recent.length === 0 && (
          <EmptyState variant="inline" description="Todavía no tienes movimientos. Crea una cuenta para comenzar." />
        )}
      </section>

      {dialogs}
    </div>
  )
}
