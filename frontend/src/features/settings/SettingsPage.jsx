import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, LogOut, ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { usePeriod } from '../../context/PeriodContext'
import { usePreferences } from '../../context/PreferencesContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { formatDate, initialsOf } from '../../lib/format'
import { useExportTransactions } from '../transactions/useExportTransactions'

export default function SettingsPage() {
  useDocumentTitle('Configuración')
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { search } = usePeriod()
  const { showAmounts, setShowAmounts } = usePreferences()
  const { exportCsv, exporting } = useExportTransactions()
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">PREFERENCIAS</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Configuración del Sistema</h1>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="profile-title">
        <h2 id="profile-title" className="text-lg font-bold text-slate-900">
          Mi cuenta
        </h2>
        <div className="mt-4 flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700"
          >
            {initialsOf(user?.full_name, user?.email)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{user?.full_name}</p>
            <p className="truncate text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-[0.15em] text-slate-400">Correo</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              {user?.email_verified ? (
                <>
                  <BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" /> Verificado
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden="true" /> Verificación pendiente
                </>
              )}
            </dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-[0.15em] text-slate-400">Moneda principal</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{user?.currency_display || user?.currency}</dd>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <dt className="text-xs uppercase tracking-[0.15em] text-slate-400">Miembro desde</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{formatDate(user?.created_at) || '—'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="privacy-title">
        <h2 id="privacy-title" className="text-lg font-bold text-slate-900">
          Privacidad y reportes
        </h2>
        <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4">
          <span>
            <span className="block font-semibold text-slate-800">Mostrar saldos</span>
            <span className="mt-1 block text-sm text-slate-500">Oculta los importes de las tarjetas del dashboard.</span>
          </span>
          <input
            type="checkbox"
            checked={showAmounts}
            onChange={(event) => setShowAmounts(event.target.checked)}
            className="h-5 w-5 shrink-0 accent-emerald-600"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Descargar mis transacciones
          </button>
          <Link
            to={{ pathname: '/app/cuentas', search }}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Administrar cuentas
          </Link>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="session-title">
        <h2 id="session-title" className="text-lg font-bold text-slate-900">
          Sesión
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
          <Link to="/terminos" className="py-2 font-semibold text-emerald-700 hover:underline">
            Términos de Servicio
          </Link>
          <Link to="/privacidad" className="py-2 font-semibold text-emerald-700 hover:underline">
            Política de Privacidad
          </Link>
        </div>
      </section>
    </div>
  )
}
