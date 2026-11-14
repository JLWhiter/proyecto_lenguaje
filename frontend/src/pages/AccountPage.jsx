import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { BrandMark } from '../components/auth/Brand'
import AuthCard from '../components/auth/AuthCard'
import Alert from '../components/auth/Alert'
import {
  BadgeCheckIcon,
  CheckCircleIcon,
  LogOutIcon,
  MailIcon,
  ShieldCheckIcon,
  WalletIcon,
} from '../components/icons'
import { useAuth } from '../context/AuthContext'

const CURRENCY_LABELS = {
  PEN: 'Sol Peruano (PEN - S/)',
  USD: 'Dólar estadounidense (USD - $)',
  EUR: 'Euro (EUR - €)',
}

export default function AccountPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [loggingOut, setLoggingOut] = useState(false)

  const justRegistered = Boolean(location.state?.justRegistered)
  const emailDeliveryConfigured = location.state?.emailDeliveryConfigured

  const firstName = (user?.full_name || '').trim().split(/\s+/)[0] || 'bienvenido'
  const createdAt = user?.created_at
    ? new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }).format(
        new Date(user.created_at),
      )
    : '—'

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="auth-page relative min-h-screen overflow-x-clip">
      <header className="relative mx-auto flex w-full max-w-[700px] items-center justify-between px-4 py-5">
        <Link to="/cuenta" className="flex items-center gap-2.5" aria-label="Finova, mi cuenta">
          <BrandMark className="h-9 w-9" iconClassName="h-5 w-5" />
          <span className="text-[18px] font-extrabold tracking-[0.13em] text-[#111827]">FINOVA</span>
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFE8D9] bg-white/70 px-2.5 py-1 text-[10px] font-bold text-[#047857] backdrop-blur">
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          Sesión activa
        </span>
      </header>

      <main className="relative mx-auto w-full max-w-[700px] px-4 pb-12 pt-2">
        {justRegistered && (
          <Alert tone="success" className="mb-5 animate-rise">
            Tu cuenta se creó correctamente y tu sesión ya está activa.
          </Alert>
        )}

        {justRegistered && emailDeliveryConfigured === false && (
          <Alert tone="info" className="mb-5 animate-rise">
            La verificación por correo está pendiente: el envío de correos aún no está configurado en este
            entorno. No mostramos tu correo como verificado.
          </Alert>
        )}

        <AuthCard className="animate-rise">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
                Centro de autenticación
              </p>
              <h1 className="mt-1.5 text-[27px] font-extrabold tracking-[-0.02em] text-[#111827]">
                Hola, {firstName}
              </h1>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#64748B]">
                Tu cuenta está protegida y lista para la siguiente etapa de Finova.
              </p>
            </div>
            <BrandMark className="h-14 w-14" iconClassName="h-7 w-7" />
          </div>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-xl border border-[#E8EFEB] bg-[#FBFDFC] p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D1FAE5] text-[#047857]">
                <MailIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Correo</p>
                <p className="mt-0.5 truncate text-[12.5px] font-semibold text-[#1F2937]">{user?.email}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-medium text-[#64748B]">
                  {user?.email_verified ? (
                    <>
                      <BadgeCheckIcon className="h-3.5 w-3.5 text-[#059669]" />
                      Verificado
                    </>
                  ) : (
                    <>
                      <ShieldCheckIcon className="h-3.5 w-3.5 text-[#B45309]" />
                      Verificación pendiente
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-[#E8EFEB] bg-[#FBFDFC] p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D1FAE5] text-[#047857]">
                <WalletIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">Moneda principal</p>
                <p className="mt-0.5 text-[12.5px] font-semibold text-[#1F2937]">
                  {CURRENCY_LABELS[user?.currency] || user?.currency}
                </p>
                <p className="mt-1 text-[10.5px] font-medium text-[#64748B]">Cuenta creada el {createdAt}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[#E8EFEB] bg-[#F0F7F5] p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#047857]">
              Protecciones de esta sesión
            </p>
            <ul className="mt-2.5 space-y-2 text-[11.5px] leading-relaxed text-[#475569]">
              {[
                'Sesión almacenada en cookie HttpOnly, no accesible desde JavaScript.',
                'Peticiones autenticadas protegidas con token CSRF.',
                'Contraseña almacenada con hash PBKDF2 de Django, nunca en texto plano.',
                'Rutas privadas protegidas en el backend y en el frontend.',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#10B981]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-relaxed text-[#8A9A94]">
              El dashboard financiero, transacciones y presupuestos se desarrollarán en la siguiente etapa.
            </p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[12px] font-bold text-[#475569] transition hover:border-[#FCA5A5] hover:text-[#B91C1C] disabled:cursor-wait disabled:opacity-60"
            >
              <LogOutIcon className="h-4 w-4" />
              {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
          </div>
        </AuthCard>

        <p className="mt-6 text-center text-[10px] tracking-wide text-[#8A9A94]">
          © 2026 Finova Technologies S.A.C.
        </p>
      </main>
    </div>
  )
}
