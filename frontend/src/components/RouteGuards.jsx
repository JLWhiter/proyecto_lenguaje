import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BrandMark } from './auth/Brand'

export function FullScreenLoader() {
  return (
    <div className="auth-page flex min-h-screen flex-col items-center justify-center gap-4">
      <BrandMark className="h-12 w-12" />
      <div className="flex items-center gap-2 text-[13px] font-medium text-[#64748B]">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#10B981]/25 border-t-[#10B981]" />
        Verificando tu sesión…
      </div>
    </div>
  )
}

export function ProtectedRoute() {
  const { user, checking } = useAuth()
  const location = useLocation()

  if (checking) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

export function GuestRoute() {
  const { user, checking } = useAuth()

  if (checking) return <FullScreenLoader />
  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
