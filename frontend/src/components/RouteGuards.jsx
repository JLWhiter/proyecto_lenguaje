import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BrandMark } from './auth/Brand'

export function FullScreenLoader() {
  return (
    // <output> = región de estado nativa (role="status").
    <output className="auth-page flex min-h-screen flex-col items-center justify-center gap-4">
      <BrandMark className="h-12 w-12" />
      <div className="flex items-center gap-2 text-[13px] font-medium text-[#64748B]">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#10B981]/25 border-t-[#10B981]" aria-hidden="true" />
        <span>Verificando tu sesión…</span>
      </div>
    </output>
  )
}

/** Requiere sesión. Sin sesión → /login (con `from` para volver y aviso si la sesión expiró). */
export function ProtectedRoute() {
  const { user, checking, sessionExpired } = useAuth()
  const location = useLocation()

  if (checking) return <FullScreenLoader />
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}`, reason: sessionExpired ? 'expired' : undefined }}
      />
    )
  }
  return <Outlet />
}

/** Solo sin sesión (login, registro, recuperación). Con sesión → /app. */
export function GuestRoute() {
  const { user, checking } = useAuth()

  if (checking) return <FullScreenLoader />
  if (user) return <Navigate to="/app" replace />
  return <Outlet />
}

/** Accesible con o sin sesión; espera a conocer la sesión para que la página pueda adaptarse. */
export function PublicRoute() {
  const { checking } = useAuth()

  if (checking) return <FullScreenLoader />
  return <Outlet />
}
