import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { GuestRoute, ProtectedRoute, PublicRoute } from './components/RouteGuards'
import FinanceLayout from './layouts/FinanceLayout'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LegalPage from './pages/LegalPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'

// Una pantalla por ruta, cargada bajo demanda (recharts solo se descarga en el resumen).
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'))
const TransactionsPage = lazy(() => import('./features/transactions/TransactionsPage'))
const BudgetsPage = lazy(() => import('./features/budgets/BudgetsPage'))
const AccountsPage = lazy(() => import('./features/accounts/AccountsPage'))
const AlertsPage = lazy(() => import('./features/alerts/AlertsPage'))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'))

export default function App() {
  return (
    <Routes>
      {/* Solo sin sesión: con sesión redirigen a /app */}
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/recuperar-contrasena" element={<ForgotPasswordPage />} />
        <Route path="/restablecer-contrasena" element={<ResetPasswordPage />} />
      </Route>

      {/* Con o sin sesión */}
      <Route element={<PublicRoute />}>
        <Route path="/verificar-email" element={<VerifyEmailPage />} />
        <Route path="/terminos" element={<LegalPage kind="terminos" />} />
        <Route path="/privacidad" element={<LegalPage kind="privacidad" />} />
      </Route>

      {/* Área privada */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<FinanceLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="movimientos" element={<TransactionsPage />} />
          <Route path="presupuestos" element={<BudgetsPage />} />
          <Route path="cuentas" element={<AccountsPage />} />
          <Route path="alertas" element={<AlertsPage />} />
          <Route path="configuracion" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Rutas antiguas */}
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      <Route path="/cuenta" element={<Navigate to="/app/configuracion" replace />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
