import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coffee,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  Film,
  Gamepad2,
  HandCoins,
  HeartPulse,
  Home,
  Landmark,
  Menu,
  MoreVertical,
  PiggyBank,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { emptyFinanceData, finovaApi } from '../lib/finovaApi'
import FinanceActionDialog from '../components/finance/FinanceActionDialog'

const navItems = [
  'Dashboard Principal',
  'Reportes Financieros',
  'Mis Cuentas Bancarias',
  'Presupuestos & Metas',
  'Centro de Alertas',
  'Configuración del Sistema',
]

const bottomTabs = ['Dashboard', 'Movimientos', 'Presupuestos', 'Cuentas', 'Alertas']

const formatCurrency = (value) => {
  const formatted = new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  return `S/ ${formatted}`
}

const formatSignedCurrency = (value) => {
  const abs = Math.abs(value)
  const prefix = value >= 0 ? '+' : '-'
  return `${prefix}${formatCurrency(abs)}`
}

const formatExact = (value) => `${value.toFixed(2)}%`

function describeBalancePeriod(dashboard) {
  const months = dashboard.evolucion_saldo.length
  if (!months) return 'Sin movimientos registrados'
  const range = months === 1 ? 'Último mes' : `Últimos ${months} meses`
  return dashboard.evolucion_periodo ? `${range} (${dashboard.evolucion_periodo})` : range
}

async function loadFinovaData(budgetMonth = '2024-05') {
  const [dashboard, transactions, budgets, accounts, alerts] = await Promise.allSettled([
    finovaApi.getDashboard({ mes: budgetMonth }),
    finovaApi.getTransactions({ mes: budgetMonth }),
    finovaApi.getBudgets({ mes: budgetMonth }),
    finovaApi.getAccounts(),
    finovaApi.getAlerts(),
  ])

  return {
    dashboard: dashboard.status === 'fulfilled' ? dashboard.value : emptyFinanceData.dashboard,
    transactions: transactions.status === 'fulfilled' ? transactions.value : emptyFinanceData.transactions,
    budgets: budgets.status === 'fulfilled' ? budgets.value : emptyFinanceData.budgets,
    accounts: accounts.status === 'fulfilled' ? accounts.value : emptyFinanceData.accounts,
    alerts: alerts.status === 'fulfilled' ? alerts.value : emptyFinanceData.alerts,
  }
}

function shiftMonth(month, offset) {
  const [year, value] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, value - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

const getIcon = (name, className = 'h-4 w-4') => {
  const icons = {
    shopping: ShoppingCart,
    income: ArrowUpRight,
    expense: ArrowRightLeft,
    wallet: Wallet,
    car: Car,
    coffee: Coffee,
    briefcase: BriefcaseBusiness,
    home: Home,
    health: HeartPulse,
    gamepad: Gamepad2,
    film: Film,
    bank: Landmark,
    credit: CreditCard,
    piggy: PiggyBank,
    phone: Smartphone,
    cash: HandCoins,
    warning: AlertTriangle,
    bell: Bell,
    shield: ShieldCheck,
    chart: Activity,
    target: Target,
    dashboard: CircleDollarSign,
    search: Search,
    filter: SlidersHorizontal,
    report: FileText,
    transfer: ArrowRightLeft,
    deposit: CircleDollarSign,
  }

  const Icon = icons[name] || Wallet
  return <Icon className={className} />
}

export default function FinovaDashboardPage() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [alertsSubTab, setAlertsSubTab] = useState('Mis Cuentas')
  const [showAmounts, setShowAmounts] = useState(true)
  const [transactionType, setTransactionType] = useState('Todos')
  const [budgetFilter, setBudgetFilter] = useState('Todos 6')
  const [budgetMonth, setBudgetMonth] = useState('2024-05')
  const [alertFilter, setAlertFilter] = useState('Todas (5)')
  const [searchText, setSearchText] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [actionDialog, setActionDialog] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [insightDismissed, setInsightDismissed] = useState(false)
  const [data, setData] = useState({
    dashboard: emptyFinanceData.dashboard,
    transactions: emptyFinanceData.transactions,
    budgets: emptyFinanceData.budgets,
    accounts: emptyFinanceData.accounts,
    alerts: emptyFinanceData.alerts,
  })

  useEffect(() => {
    let cancelled = false
    loadFinovaData(budgetMonth).then((nextData) => {
      if (!cancelled) setData(nextData)
    })

    return () => {
      cancelled = true
    }
  }, [budgetMonth])

  function openAction(kind, record = null, initialValues = {}) {
    setActionError('')
    setNotice('')
    setActionDialog({ kind, record, initialValues })
  }

  async function submitAction(values) {
    setActionBusy(true)
    setActionError('')
    try {
      let result
      if (actionDialog.kind === 'transaction') result = await finovaApi.createTransaction({ ...values, occurred_at: `${budgetMonth}-24T12:00:00Z` })
      if (actionDialog.kind === 'transfer') result = await finovaApi.transfer(values)
      if (actionDialog.kind === 'deposit') result = await finovaApi.deposit(values)
      if (actionDialog.kind === 'account') result = await finovaApi.createAccount(values)
      if (actionDialog.kind === 'budget') result = await finovaApi.createBudget({ ...values, month: budgetMonth })
      if (actionDialog.kind === 'adjust-budget') result = await finovaApi.adjustBudget(actionDialog.record.id, values)
      if (actionDialog.kind === 'account-balance') result = await finovaApi.updateAccountBalance(actionDialog.record.id, values)
      if (actionDialog.kind === 'rebalance') result = await finovaApi.rebalanceBudget({ ...values, month: budgetMonth })
      setActionDialog(null)
      setNotice(result?.message || 'Cambios guardados correctamente.')
      setData(await loadFinovaData(budgetMonth))
    } catch (error) {
      setActionError(error.message || 'No se pudo completar la operación.')
    } finally {
      setActionBusy(false)
    }
  }

  async function performAlertAction(alert, action) {
    setNotice('')
    try {
      await finovaApi.actOnAlert(alert.id, { action })
      setData(await loadFinovaData(budgetMonth))
    } catch (error) {
      setNotice(error.message || 'No se pudo actualizar la alerta.')
    }
  }

  async function silenceAlerts() {
    try {
      const result = await finovaApi.silenceAllAlerts()
      setNotice(result.message)
      setData(await loadFinovaData(budgetMonth))
    } catch (error) {
      setNotice(error.message || 'No se pudieron silenciar las alertas.')
    }
  }

  async function removeTransaction(item) {
    if (!window.confirm(`¿Eliminar el movimiento "${item.nombre}"?`)) return
    try {
      await finovaApi.deleteTransaction(item.id)
      setNotice('Movimiento eliminado.')
      setData(await loadFinovaData(budgetMonth))
    } catch (error) {
      setNotice(error.message || 'No se pudo eliminar el movimiento.')
    }
  }

  async function exportReport() {
    try {
      const blob = await finovaApi.exportTransactions()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'finova-transacciones.csv'
      link.click()
      URL.revokeObjectURL(url)
      setNotice('Reporte descargado.')
    } catch (error) {
      setNotice(error.message || 'No se pudo descargar el reporte.')
    }
  }

  const filteredTransactions = useMemo(() => {
    const rawGroups = data.transactions?.grupos || []
    return rawGroups
      .map((group) => ({
        ...group,
        items: (group.items || []).filter((item) => {
          const matchesText =
            !searchText ||
            item.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
            item.categoria.toLowerCase().includes(searchText.toLowerCase())

          const matchesType =
            transactionType === 'Todos' ||
            (transactionType === 'Solo Ingresos' && item.tipo === 'INGRESO') ||
            (transactionType === 'Solo Gastos' && item.tipo === 'GASTO') ||
            (transactionType === 'Alimentación' && item.categoria === 'Alimentación')

          const matchesAccount =
            !accountFilter || item.subtexto?.toLowerCase().includes(accountFilter.toLowerCase())

          return matchesText && matchesType && matchesAccount
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [data.transactions, searchText, transactionType])

  const filteredAlerts = useMemo(() => {
    const items = data.alerts?.items || []
    if (alertFilter.startsWith('Todas')) return items
    const normalized = alertFilter.split(' (')[0]
    const mapping = {
      Presupuesto: 'Presupuesto',
      'Gastos Inusuales': 'Gastos Inusuales',
      Vencimientos: 'Vencimientos',
      Metas: 'Metas',
    }
    return items.filter((alert) => alert.tipo === mapping[normalized])
  }, [data.alerts, alertFilter])

  const transactionCount = data.transactions.grupos.reduce((total, group) => total + group.items.length, 0)
  const accountCount = data.accounts.accounts.length
  const activeAlertCount = data.alerts.items.length

  const renderedTab = () => {
    if (activeTab === 'Dashboard') {
      return (
        <div className="space-y-5 pb-28 lg:pb-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => openAction('transaction')} disabled={accountCount === 0} title={accountCount === 0 ? 'Agrega primero una cuenta' : undefined} className="inline-flex items-center gap-2 rounded-xl bg-[#10B981] px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-200 hover:bg-[#059669] disabled:cursor-not-allowed disabled:opacity-50">
                <Plus className="h-4 w-4" />
                Nueva Transacción
              </button>
              <button onClick={exportReport} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                <FileText className="h-4 w-4 text-emerald-600" />
                Ver Reporte
              </button>
              <button onClick={() => setActiveTab('Movimientos')} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                <SlidersHorizontal className="h-4 w-4 text-slate-600" />
                Filtros
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-500">
                <span className="text-base font-semibold text-slate-700">Balance Total Disponible</span>
              </div>
              <button
                onClick={() => setShowAmounts((value) => !value)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600"
              >
                {showAmounts ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>

            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
                  {showAmounts ? formatCurrency(data.dashboard.balance_total) : '••••'}
                </p>
                <div className="mt-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                  <ArrowUpRight className="mr-1 h-4 w-4" />
                  {data.dashboard.balance_variacion}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => openAction('transfer')} disabled={accountCount < 2} title={accountCount < 2 ? 'Necesitas dos cuentas para transferir' : undefined} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
                <ArrowRightLeft className="h-4 w-4" />
                Transferir
              </button>
              <button onClick={() => openAction('deposit')} disabled={accountCount === 0} title={accountCount === 0 ? 'Agrega primero una cuenta' : undefined} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                <CircleDollarSign className="h-4 w-4 text-emerald-600" />
                Depositar
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-700">Ingresos Mensuales</span>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 flex items-end justify-between gap-2">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {showAmounts ? formatCurrency(data.dashboard.ingresos_mensuales) : '••••'}
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                  ↑ {data.dashboard.ingresos_variacion}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">vs Abril</p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-700">Gastos Mensuales</span>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-5 flex items-end justify-between gap-2">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {showAmounts ? formatCurrency(data.dashboard.gastos_mensuales) : '••••'}
                </span>
                <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">
                  ↓ {data.dashboard.gastos_variacion}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">vs Abril</p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-slate-700">Presupuesto del período</span>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Activity className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-2xl font-bold text-slate-900">{formatExact(data.dashboard.presupuesto_porcentaje)}</span>
                <span className="text-sm text-slate-500">Límite {formatCurrency(data.dashboard.presupuesto_limite)}</span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-amber-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
                  style={{ width: `${data.dashboard.presupuesto_porcentaje}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Bell className="h-4 w-4" />
                </div>
                <span className="text-xl font-bold text-slate-900">Centro de Alertas Activas</span>
              </div>
              <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {data.dashboard.alertas_activas.length} pendientes
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {data.dashboard.alertas_activas.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-2xl border-l-4 bg-slate-50 p-4 ${
                    alert.tipo === 'warning'
                      ? 'border-l-amber-400 bg-amber-50/60'
                      : alert.tipo === 'danger'
                        ? 'border-l-red-500 bg-red-50/70'
                        : 'border-l-blue-500 bg-sky-50/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full ${
                          alert.tipo === 'warning'
                            ? 'bg-amber-100 text-amber-600'
                            : alert.tipo === 'danger'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-sky-100 text-sky-600'
                        }`}
                      >
                        {alert.tipo === 'warning' ? <AlertTriangle className="h-4 w-4" /> : alert.tipo === 'danger' ? <CheckCircle2 className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-base font-semibold text-slate-900">{alert.titulo}</h4>
                          <span className="text-xs text-slate-500">{alert.tiempo}</span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{alert.descripcion}</p>
                        <div className="mt-3 flex items-center gap-4 text-sm font-medium">
                          {alert.accion && <button onClick={() => setActiveTab(alert.accion.toLowerCase().includes('presupuesto') ? 'Presupuestos' : 'Alertas')} className="text-emerald-700 underline underline-offset-2">{alert.accion}</button>}
                          {alert.tipo !== 'info' && <button onClick={() => performAlertAction(alert, 'snooze')} className="text-slate-500">Postergar</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {data.dashboard.alertas_activas.length === 0 && (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">No tienes alertas activas.</p>
              )}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Evolución de Saldo</h3>
                  <p className="mt-1 text-sm text-slate-500">{describeBalancePeriod(data.dashboard)}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${String(data.dashboard.evolucion_tendencia).startsWith('-') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  Tendencia {data.dashboard.evolucion_tendencia || '0.0%'}
                </span>
              </div>

              {data.dashboard.evolucion_saldo.length > 0 ? <div className="mt-6 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dashboard.evolucion_saldo}>
                    <defs>
                      <linearGradient id="saldoFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis hide domain={['dataMin - 300', 'dataMax + 500']} />
                    <Tooltip
                      formatter={(value) => [`S/ ${Number(value).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Monto']}
                      labelStyle={{ color: '#0f172a' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#0f172a', color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={3} fill="url(#saldoFill)" dot={{ r: 5, fill: '#fff', stroke: '#10B981', strokeWidth: 3 }} activeDot={{ r: 7, fill: '#fff', stroke: '#10B981', strokeWidth: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div> : <p className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">El gráfico aparecerá cuando registres movimientos.</p>}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">Distribución de Gastos</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Total {new Intl.DateTimeFormat('es-PE', { month: 'long', timeZone: 'UTC' }).format(new Date(`${budgetMonth}-01T00:00:00Z`))}: {formatCurrency(data.dashboard.gastos_mensuales)}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {data.dashboard.distribucion_gastos.length} Categorías
                </span>
              </div>

              <div className="mt-5 flex items-center justify-center">
                <div className="relative h-56 w-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.dashboard.distribucion_gastos} dataKey="value" innerRadius={52} outerRadius={75} paddingAngle={2} stroke="white" strokeWidth={4}>
                        {data.dashboard.distribucion_gastos.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-sm font-medium text-slate-500">{new Intl.DateTimeFormat('es-PE', { month: 'long', timeZone: 'UTC' }).format(new Date(`${budgetMonth}-01T00:00:00Z`))}</span>
                    <span className="text-2xl font-bold text-slate-900">{data.dashboard.distribucion_gastos.length ? '100%' : '0%'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.dashboard.distribucion_gastos.map((category) => (
                  <div key={category.name} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: category.color }} />
                    <span className="text-sm text-slate-700">
                      {category.name} ({category.value}%)
                    </span>
                  </div>
                ))}
              </div>
              {data.dashboard.distribucion_gastos.length === 0 && (
                <p className="mt-3 text-center text-sm text-slate-500">Sin gastos registrados en este período.</p>
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Transacciones Recientes</h3>
                <p className="mt-1 text-sm text-slate-500">Últimos movimientos sincronizados</p>
              </div>
              <button onClick={() => setActiveTab('Movimientos')} className="text-sm font-semibold text-emerald-700">Ver todas</button>
            </div>

            <div className="mt-5 space-y-4">
              {data.dashboard.ultimas_transacciones.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${item.monto >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {item.monto >= 0 ? getIcon('income', 'h-5 w-5') : getIcon('shopping', 'h-5 w-5')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="break-words font-semibold text-slate-900">{item.nombre}</p>
                        <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.monto >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                          • {item.categoria}
                        </span>
                      </div>
                      <p className="mt-1 break-words text-sm text-slate-500">{item.fecha} • {item.cuenta}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2 sm:block sm:shrink-0 sm:border-0 sm:pt-0 sm:text-right">
                    <p className={`whitespace-nowrap text-lg font-bold ${item.monto >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {item.monto >= 0 ? '+' : '-'}{formatCurrency(Math.abs(item.monto))}
                    </p>
                    <span className="mt-1 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 uppercase tracking-wide">
                      {item.estado}
                    </span>
                  </div>
                </div>
              ))}
              {data.dashboard.ultimas_transacciones.length === 0 && (
                <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Todavía no tienes movimientos. Crea una cuenta para comenzar.</p>
              )}
            </div>
          </div>
        </div>
      )
    }

    if (activeTab === 'Movimientos') {
      return (
        <div className="space-y-6 pb-28 lg:pb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Transacciones</h1>
              <div className="mt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>PERÍODO ACTUAL</span>
                <span className="rounded-full bg-slate-200 px-2 py-1 text-[10px] font-medium text-slate-700">{transactionCount} movimientos</span>
              </div>
            </div>
            <button onClick={() => openAction('transaction')} disabled={accountCount === 0} title={accountCount === 0 ? 'Agrega primero una cuenta' : undefined} className="inline-flex items-center gap-2 rounded-xl bg-[#10B981] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
              <Plus className="h-4 w-4" />
              Nueva
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Ingresos</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-emerald-600">{formatCurrency(data.transactions.total_ingresos)}</p>
              <p className="mt-1 text-sm text-slate-500">Total Mayo</p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Gastos</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <TrendingDown className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-red-600">{data.transactions.total_gastos > 0 ? `-${formatCurrency(data.transactions.total_gastos)}` : formatCurrency(0)}</p>
              <p className="mt-1 text-sm text-slate-500">Ejecutado</p>
            </div>

            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-700">Neto</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-4 text-2xl font-bold text-emerald-700">{formatCurrency(data.transactions.neto)}</p>
              <p className="mt-1 text-sm text-emerald-700">Disponible</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <label className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="Buscar por comercio o descripción..."
                  className="w-full border-0 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {['Todos', 'Solo Ingresos', 'Solo Gastos', 'Alimentación'].map((option) => (
                  <button
                    key={option}
                    onClick={() => setTransactionType(option)}
                    className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                      transactionType === option
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
                <span>Período</span>
                <select value={budgetMonth} onChange={(event) => setBudgetMonth(event.target.value)} className="max-w-[65%] bg-transparent text-right outline-none" aria-label="Período de transacciones">
                  <option value="2024-05">Mayo 2024</option>
                  <option value="2024-04">Abril 2024</option>
                  <option value="2024-03">Marzo 2024</option>
                </select>
              </label>
              <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-700">
                <span>Cuenta</span>
                <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className="max-w-[65%] bg-transparent text-right outline-none" aria-label="Filtrar por cuenta">
                  <option value="">Todas las cuentas</option>
                  {data.accounts.accounts.map((account) => <option key={account.id} value={account.nombre}>{account.nombre}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-5">
            {filteredTransactions.map((group) => (
              <div key={group.titulo} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{group.titulo}</h3>
                  <span className={`text-sm font-bold ${group.total >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {group.total >= 0 ? '+' : '-'}{formatCurrency(Math.abs(group.total))}
                  </span>
                </div>

                <div className="space-y-3">
                  {group.items.map((item) => (
                    <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${item.tipo === 'GASTO' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {item.icon === 'shopping' && <ShoppingCart className="h-5 w-5" />}
                          {item.icon === 'car' && <Car className="h-5 w-5" />}
                          {item.icon === 'briefcase' && <BriefcaseBusiness className="h-5 w-5" />}
                          {item.icon === 'coffee' && <Coffee className="h-5 w-5" />}
                          {item.icon === 'home' && <Home className="h-5 w-5" />}
                          {item.icon === 'health' && <HeartPulse className="h-5 w-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900">{item.nombre}</p>
                            <span className="text-xs text-slate-500">{item.subtexto}</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${item.tipo === 'GASTO' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                              {item.categoria}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                            <span className={`font-bold ${item.monto >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{item.monto >= 0 ? '+' : '-'}{formatCurrency(Math.abs(item.monto))}</span>
                            <span>•</span>
                            <span>{item.hora}</span>
                          </div>
                        </div>
                      </div>

                      {item.custom && (
                        <button onClick={() => removeTransaction(item)} aria-label={`Eliminar ${item.nombre}`} className="self-end text-xl text-slate-400 sm:self-auto">
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {filteredTransactions.length === 0 && (
            <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No hay movimientos para este período o filtro.</p>
          )}

          <button onClick={exportReport} className="w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600">
            Descargar historial de movimientos
          </button>
        </div>
      )
    }

    if (activeTab === 'Presupuestos') {
      return (
        <div className="space-y-6 pb-28 lg:pb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">GESTIÓN DE FINANZAS</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">Presupuestos Mensuales</h1>
            </div>
            <button onClick={() => openAction('budget')} className="inline-flex items-center gap-2 rounded-xl bg-[#10B981] px-4 py-3 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" />
              Nuevo Presupuesto
            </button>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-center gap-4 text-slate-700">
              <button onClick={() => setBudgetMonth((month) => shiftMonth(month, -1))} aria-label="Mes anterior" className="rounded-full border border-slate-200 p-2"><ChevronLeft className="h-4 w-4" /></button>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <CalendarDays className="h-5 w-5 text-emerald-600" />
                {new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${budgetMonth}-01T00:00:00Z`))}
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Período seleccionado</span>
              <button onClick={() => setBudgetMonth((month) => shiftMonth(month, 1))} aria-label="Mes siguiente" className="rounded-full border border-slate-200 p-2"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Consumo Total del Mes</h2>
                </div>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{data.budgets.summary.porcentaje >= 90 ? '• Crítico' : data.budgets.summary.porcentaje >= 75 ? '• Precaución' : '• En control'} ({formatExact(data.budgets.summary.porcentaje)})</span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Gasto Total Acumulado</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(data.budgets.summary.total_consumido)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 text-right md:text-left">Presupuesto Asignado</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 md:text-right">{formatCurrency(data.budgets.summary.total_asignado)}</p>
              </div>
            </div>

            <div className="mt-5 h-3 overflow-hidden rounded-full bg-amber-100">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${data.budgets.summary.porcentaje}%` }} />
            </div>

            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
              <span>Consumido: {formatExact(data.budgets.summary.porcentaje)}</span>
              <span>Quedan {data.budgets.summary.dias_restantes} días</span>
            </div>

            <div className="mt-5 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-emerald-700">
                <PiggyBank className="h-4 w-4" />
                <span>Dinero Restante Disponible:</span>
              </div>
              <span className="text-lg font-bold text-emerald-700">{formatCurrency(data.budgets.summary.restante)}</span>
            </div>
          </div>

          {data.budgets.categorias.length > 0 && !insightDismissed && <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">Alerta de Ritmo de Gasto</h3>
                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">IA Finova</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{data.budgets.ia_alert.resumen}</p>
                  <div className="mt-3 flex items-center gap-3 text-sm">
                    <button onClick={() => openAction('rebalance')} className="font-semibold text-slate-700 underline underline-offset-2">Rebalancear Presupuesto</button>
                    <span className="text-slate-400">•</span>
                    <button onClick={() => setInsightDismissed(true)} className="font-medium text-slate-500">Descartar</button>
                  </div>
                </div>
              </div>
            </div>
          </div>}

          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              {data.budgets.filtros.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setBudgetFilter(filter)}
                  className={`rounded-full px-3 py-2 text-sm font-medium ${
                    budgetFilter === filter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {filter.startsWith('Todos') ? filter : filter}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            {data.budgets.categorias
              .filter((item) => budgetFilter.startsWith('Todos') || (budgetFilter.startsWith('Normal') && item.color === 'green') || (budgetFilter.startsWith('Precaución') && item.color === 'amber') || (budgetFilter.startsWith('Crítico') && item.color === 'red'))
              .map((item) => (
              <div key={item.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.color === 'red' ? 'bg-red-50 text-red-600' : item.color === 'amber' ? 'bg-amber-50 text-amber-600' : item.color === 'green' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                      {item.icon === 'shopping' && <ShoppingCart className="h-5 w-5" />}
                      {item.icon === 'car' && <Car className="h-5 w-5" />}
                      {item.icon === 'home' && <Home className="h-5 w-5" />}
                      {item.icon === 'gamepad' && <Gamepad2 className="h-5 w-5" />}
                      {item.icon === 'health' && <HeartPulse className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-slate-900">{item.nombre}</h3>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.color === 'red' ? 'bg-red-100 text-red-700' : item.color === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          • {item.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{item.descripcion}</p>
                    </div>
                  </div>
                  <button onClick={() => openAction('adjust-budget', item, { limit_amount: item.presupuesto })} aria-label={`Ajustar presupuesto de ${item.nombre}`} className="text-slate-400"><MoreVertical className="h-5 w-5" /></button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Presupuestado</p>
                    <p className="mt-1 text-base font-semibold text-slate-800">{formatCurrency(item.presupuesto)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Gastado</p>
                    <p className="mt-1 text-base font-semibold text-slate-800">{formatCurrency(item.gastado)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Restante</p>
                    <p className="mt-1 text-base font-semibold text-emerald-700">{formatCurrency(item.restante)}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                    <span>Consumido</span>
                    <span className={item.color === 'red' ? 'text-red-600' : item.color === 'amber' ? 'text-amber-600' : 'text-emerald-600'}>{formatExact(item.porcentaje)}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${item.color === 'red' ? 'bg-red-500' : item.color === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${item.porcentaje}%` }} />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    {item.color === 'green' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : item.color === 'red' ? <TrendingDown className="h-4 w-4 text-red-600" /> : <Activity className="h-4 w-4 text-amber-600" />}
                    <span>{item.detalle}</span>
                  </div>
                  <button onClick={() => openAction('adjust-budget', item, { limit_amount: item.presupuesto })} className="font-semibold text-emerald-700">{item.color === 'green' ? 'Detalles' : 'Ajustar'}</button>
                </div>
              </div>
            ))}
          </div>

          {data.budgets.categorias.length === 0 && (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-6 text-center">
              <h3 className="text-lg font-bold text-slate-900">Todavía no tienes presupuestos</h3>
              <p className="mt-2 text-sm text-slate-500">Crea uno para empezar a planificar tus gastos para este mes.</p>
              <button onClick={() => openAction('budget')} className="mt-4 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">Crear presupuesto</button>
            </div>
          )}

          {data.budgets.categorias.length > 0 && <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Consejos de Optimización Finova</h3>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-700">
              Podrías transferir S/ 150.00 del presupuesto no utilizado en Salud hacia Alimentación para cerrar el mes sin caer en sobregiro patrimonial.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => openAction('rebalance')} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Rebalancear Automático</button>
              <button onClick={exportReport} className="rounded-xl px-2 py-2 text-sm font-semibold text-emerald-700">Ver análisis completo</button>
            </div>
          </div>}
        </div>
      )
    }

    if (activeTab === 'Cuentas') {
      return (
        <div className="space-y-6 pb-28 lg:pb-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Cuentas & Centro de Alertas</h1>
              <p className="mt-2 text-sm text-slate-500">Gestión patrimonial y alertas en tiempo real</p>
            </div>
            <button onClick={() => openAction('account')} className="inline-flex items-center gap-2 rounded-xl bg-[#10B981] px-4 py-3 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" />
              Cuenta
            </button>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap gap-2">
              {['Mis Cuentas', 'Alertas Activas'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAlertsSubTab(tab)}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                    alertsSubTab === tab ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {tab}
                  {tab === 'Mis Cuentas' ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">{accountCount}</span>
                  ) : (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">{activeAlertCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {alertsSubTab === 'Mis Cuentas' ? (
            <div className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">Patrimonio Neto Consolidado</h2>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">• {accountCount} Conectadas</span>
                </div>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-4xl font-extrabold text-slate-900">{formatCurrency(data.accounts.patrimonio)}</p>
                    <span className="mt-2 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{accountCount > 0 ? '↗ +6.4% mes' : '0.0% mes'}</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Liquidez Inmediata</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(data.accounts.liquidez)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Efectivo Físico</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(data.accounts.efectivo)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-xl font-bold text-slate-900">Bancos & Billeteras Conectadas</h3>
                  <span className="text-sm text-slate-500">Actualizado hoy 10:45 AM</span>
                </div>

                <div className="mt-5 space-y-4">
                  {data.accounts.accounts.map((account) => (
                    <div key={account.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                            {account.icon === 'credit' && <CreditCard className="h-5 w-5" />}
                            {account.icon === 'piggy' && <PiggyBank className="h-5 w-5" />}
                            {account.icon === 'phone' && <Smartphone className="h-5 w-5" />}
                            {account.icon === 'cash' && <HandCoins className="h-5 w-5" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-lg font-bold text-slate-900">{account.nombre}</p>
                              {account.estado === 'Activa' && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                              {account.badge && <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${account.badge === 'Activa' ? 'bg-emerald-100 text-emerald-700' : account.badge === 'Instantánea' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>{account.badge}</span>}
                              <span className="break-words">{account.tipo} • {account.descripcion}</span>
                            </div>
                          </div>
                        </div>
                        <button onClick={() => openAction('account-balance', account, { balance: account.saldo })} aria-label={`Actualizar saldo de ${account.nombre}`} className="self-end rounded-full border border-slate-200 bg-white p-2 text-slate-600 sm:self-auto">
                          <ArrowRightLeft className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Saldo Disponible</p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">{formatCurrency(account.saldo)}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 sm:justify-start">
                          <button onClick={() => { setAccountFilter(account.nombre); setActiveTab('Movimientos') }} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Movimientos</button>
                          <button onClick={() => openAction('transfer', null, { source_account_id: String(account.id) })} aria-label={`Transferir desde ${account.nombre}`} className="rounded-xl bg-slate-900 p-2 text-white"><ArrowRightLeft className="h-4 w-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {data.accounts.accounts.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                      <p className="text-sm text-slate-600">Aún no tienes cuentas agregadas.</p>
                      <button onClick={() => openAction('account')} className="mt-3 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">Agregar primera cuenta</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Alertas del Sistema Financiero</h2>
                    <p className="mt-1 text-sm text-slate-500">Monitoreo continuo de desvíos y vencimientos</p>
                  </div>
                  <button onClick={silenceAlerts} className="text-sm font-semibold text-emerald-700">Silenciar todo</button>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {data.alerts.filters.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setAlertFilter(filter)}
                      className={`rounded-full px-3 py-2 text-sm font-medium ${
                        alertFilter === filter ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} className={`rounded-[24px] border-l-4 bg-white p-5 shadow-sm ${alert.nivel === 'rojo' ? 'border-l-red-500' : alert.nivel === 'amber' ? 'border-l-amber-500' : alert.nivel === 'indigo' ? 'border-l-indigo-500' : 'border-l-emerald-500'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 flex h-10 w-10 items-center justify-center rounded-full ${alert.nivel === 'rojo' ? 'bg-red-100 text-red-600' : alert.nivel === 'amber' ? 'bg-amber-100 text-amber-600' : alert.nivel === 'indigo' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          {alert.nivel === 'rojo' ? <AlertTriangle className="h-5 w-5" /> : alert.nivel === 'amber' ? <Bell className="h-5 w-5" /> : alert.nivel === 'indigo' ? <CalendarDays className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                        </div>
                        <div className="w-full">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${alert.nivel === 'rojo' ? 'bg-red-100 text-red-700' : alert.nivel === 'amber' ? 'bg-amber-100 text-amber-700' : alert.nivel === 'indigo' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {alert.badge}
                            </span>
                            <span className="text-xs text-slate-500">{alert.tiempo}</span>
                          </div>
                          <h3 className="mt-3 text-xl font-bold text-slate-900">{alert.titulo}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{alert.descripcion}</p>
                          {alert.porcentaje && (
                            <div className="mt-4">
                              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full rounded-full ${alert.nivel === 'rojo' ? 'bg-red-500' : alert.nivel === 'amber' ? 'bg-amber-500' : alert.nivel === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${alert.porcentaje}%` }} />
                              </div>
                            </div>
                          )}
                          <div className="mt-4 flex flex-wrap gap-3">
                            {alert.nivel === 'rojo' && <button onClick={() => openAction('rebalance')} className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Reasignar fondo</button>}
                            {alert.nivel === 'amber' && <button onClick={() => performAlertAction(alert, 'confirm')} className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Confirmar gasto</button>}
                            {alert.nivel === 'indigo' && <button onClick={() => openAction('transaction', null, { name: 'Pago tarjeta Interbank', category: 'Pago de tarjeta', amount: '480.00', type: 'GASTO' })} className="rounded-xl bg-[#10B981] px-3 py-2 text-sm font-semibold text-white">Pagar ahora S/ 480.00</button>}
                            {alert.nivel === 'green' && <button onClick={exportReport} className="rounded-xl text-sm font-semibold text-emerald-700">Ver reporte detallado</button>}
                            <button onClick={() => alert.nivel === 'amber' ? performAlertAction(alert, 'confirm_fraud') : alert.nivel === 'rojo' ? performAlertAction(alert, 'read') : alert.nivel === 'indigo' ? performAlertAction(alert, 'snooze') : exportReport()} className="text-sm font-medium text-slate-500 underline underline-offset-2">{alert.nivel === 'amber' ? 'Reportar fraude' : alert.nivel === 'rojo' ? 'Marcar como leída' : alert.nivel === 'indigo' ? 'Posponer 24h' : 'Ver reporte detallado'}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (activeTab === 'Configuración') {
      return (
        <div className="space-y-6 pb-28 lg:pb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">PREFERENCIAS</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Configuración del Sistema</h1>
          </div>
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Privacidad y reportes</h2>
            <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
              <span>
                <span className="block font-semibold text-slate-800">Mostrar saldos</span>
                <span className="mt-1 block text-sm text-slate-500">Oculta los importes de las tarjetas del dashboard.</span>
              </span>
              <input type="checkbox" checked={showAmounts} onChange={(event) => setShowAmounts(event.target.checked)} className="h-5 w-5 accent-emerald-600" />
            </label>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={exportReport} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white">Descargar mis transacciones</button>
              <button onClick={() => setActiveTab('Cuentas')} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Administrar cuentas</button>
            </div>
          </section>
        </div>
      )
    }

    if (activeTab === 'Alertas') {
      return (
        <div className="space-y-6 pb-28 lg:pb-8">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Alertas Activas</h1>
                <p className="mt-2 text-sm text-slate-500">Monitoreo continuo de desvíos y vencimientos</p>
              </div>
              <button onClick={silenceAlerts} className="text-sm font-semibold text-emerald-700">Silenciar todo</button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {data.alerts.filters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setAlertFilter(filter)}
                  className={`rounded-full px-3 py-2 text-sm font-medium ${
                    alertFilter === filter ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredAlerts.map((alert) => (
              <div key={alert.id} className={`rounded-[24px] border-l-4 bg-white p-5 shadow-sm ${alert.nivel === 'rojo' ? 'border-l-red-500' : alert.nivel === 'amber' ? 'border-l-amber-500' : alert.nivel === 'indigo' ? 'border-l-indigo-500' : 'border-l-emerald-500'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 flex h-10 w-10 items-center justify-center rounded-full ${alert.nivel === 'rojo' ? 'bg-red-100 text-red-600' : alert.nivel === 'amber' ? 'bg-amber-100 text-amber-600' : alert.nivel === 'indigo' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {alert.nivel === 'rojo' ? <AlertTriangle className="h-5 w-5" /> : alert.nivel === 'amber' ? <Bell className="h-5 w-5" /> : alert.nivel === 'indigo' ? <CalendarDays className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    </div>
                    <div className="w-full">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${alert.nivel === 'rojo' ? 'bg-red-100 text-red-700' : alert.nivel === 'amber' ? 'bg-amber-100 text-amber-700' : alert.nivel === 'indigo' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {alert.badge}
                        </span>
                        <span className="text-xs text-slate-500">{alert.tiempo}</span>
                      </div>
                      <h3 className="mt-3 text-xl font-bold text-slate-900">{alert.titulo}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{alert.descripcion}</p>
                      {alert.porcentaje && (
                        <div className="mt-4">
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${alert.nivel === 'rojo' ? 'bg-red-500' : alert.nivel === 'amber' ? 'bg-amber-500' : alert.nivel === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${alert.porcentaje}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button onClick={() => performAlertAction(alert, 'read')} className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Ver detalle</button>
                        <button onClick={() => performAlertAction(alert, 'dismiss')} className="text-sm font-medium text-slate-500 underline underline-offset-2">Marcar como leída</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    return null
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 lg:pl-[340px]">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawerOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F172A] text-[10px] font-bold text-emerald-400 shadow-inner shadow-emerald-500/20">
                F
              </div>
              <div className="text-xl font-black text-slate-900">
                Finova<span className="text-emerald-500">*</span>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button onClick={() => setActiveTab('Presupuestos')} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              <CalendarDays className="h-4 w-4 text-emerald-600" />
              {new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${budgetMonth}-01T00:00:00Z`))}
              <ChevronDown className="h-4 w-4" />
            </button>
            <button onClick={() => setActiveTab('Alertas')} aria-label="Abrir alertas" className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
              <Bell className="h-4 w-4" />
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">3</span>
            </button>
            <button onClick={() => setActiveTab('Configuración')} aria-label="Abrir configuración" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#10B981] text-sm font-bold text-white">CM</button>
          </div>
        </div>
      </header>

      <aside className={`fixed inset-y-0 left-0 z-40 w-[min(85vw,340px)] transform border-r border-slate-200 bg-white px-4 py-5 shadow-2xl transition-transform duration-300 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'} lg:w-[340px] lg:translate-x-0`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">CM</div>
            <div>
              <p className="text-lg font-bold text-slate-900">Carlos Mendoza</p>
              <p className="text-xs text-slate-500">carlos.mendoza@finova.pe</p>
            </div>
          </div>
          <button onClick={() => setDrawerOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          <span>Plan Personal Pro • S/</span>
        </div>

        <nav className="mt-8 space-y-2">
          {navItems.map((item, index) => (
            <button
              key={item}
              onClick={() => {
                if (item === 'Dashboard Principal') setActiveTab('Dashboard')
                if (item === 'Mis Cuentas Bancarias') setActiveTab('Cuentas')
                if (item === 'Presupuestos & Metas') setActiveTab('Presupuestos')
                if (item === 'Centro de Alertas') setActiveTab('Alertas')
                if (item === 'Reportes Financieros') setActiveTab('Movimientos')
                if (item === 'Configuración del Sistema') setActiveTab('Configuración')
                setDrawerOpen(false)
              }}
              className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-medium ${
                item === 'Dashboard Principal'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-3">
                {index === 0 && <Wallet className="h-4 w-4" />}
                {index === 1 && <FileText className="h-4 w-4" />}
                {index === 2 && <Landmark className="h-4 w-4" />}
                {index === 3 && <Target className="h-4 w-4" />}
                {index === 4 && <Bell className="h-4 w-4" />}
                {index === 5 && <ShieldCheck className="h-4 w-4" />}
                {item}
              </span>
              {item === 'Centro de Alertas' && activeAlertCount > 0 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">{activeAlertCount}</span>}
            </button>
          ))}
        </nav>

        <div className="mt-auto rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Finova Security Core</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Conexiones cifradas 256-bit con BCP, BBVA e Interbank.</p>
            </div>
          </div>
        </div>
      </aside>

      {drawerOpen && <button aria-label="Cerrar menú" onClick={() => setDrawerOpen(false)} className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden" />}

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-8">
        {renderedTab()}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-5 gap-1 px-2 py-2">
          {bottomTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex flex-col items-center justify-center rounded-2xl px-2 py-2 text-[10px] font-semibold ${activeTab === tab ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}`}
            >
              <span className="relative inline-flex h-5 w-5 items-center justify-center">
                {tab === 'Dashboard' && <Wallet className="h-4 w-4" />}
                {tab === 'Movimientos' && <FileText className="h-4 w-4" />}
                {tab === 'Presupuestos' && <Target className="h-4 w-4" />}
                {tab === 'Cuentas' && <Landmark className="h-4 w-4" />}
                {tab === 'Alertas' && <Bell className="h-4 w-4" />}
                {tab === 'Alertas' && activeAlertCount > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500" />}
              </span>
              {tab}
            </button>
          ))}
        </div>
      </nav>

      {notice && (
        <div role="status" className="fixed bottom-24 left-4 right-4 z-50 mx-auto flex max-w-lg items-center justify-between gap-4 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl lg:bottom-5">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Cerrar aviso" className="text-white/70 hover:text-white">×</button>
        </div>
      )}

      {actionDialog && (
        <FinanceActionDialog
          key={`${actionDialog.kind}-${actionDialog.record?.id ?? 'new'}`}
          kind={actionDialog.kind}
          accounts={data.accounts.accounts}
          budgets={data.budgets.categorias}
          initialValues={actionDialog.initialValues}
          error={actionError}
          busy={actionBusy}
          onClose={() => setActionDialog(null)}
          onSubmit={submitAction}
        />
      )}
    </div>
  )
}
