import { forwardRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Bell, Menu } from 'lucide-react'
import IconButton from '../components/ui/IconButton'
import { useAuth } from '../context/AuthContext'
import { usePeriod } from '../context/PeriodContext'
import { initialsOf } from '../lib/format'
import PeriodPicker from './PeriodPicker'

/** Header fijo: menú (solo < lg), marca, selector de período, campana de alertas y avatar. */
const AppHeader = forwardRef(function AppHeader({ drawerOpen, onOpenMenu, alertCount }, menuButtonRef) {
  const { user } = useAuth()
  const { search } = usePeriod()
  const name = user?.full_name || user?.email || 'Mi cuenta'
  const initials = initialsOf(user?.full_name, user?.email)
  const alertsLabel =
    alertCount > 0 ? `Alertas: ${alertCount} ${alertCount === 1 ? 'activa' : 'activas'}` : 'Alertas: sin alertas activas'

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <IconButton
            ref={menuButtonRef}
            label="Abrir menú"
            shape="square"
            onClick={onOpenMenu}
            aria-expanded={drawerOpen}
            aria-controls="app-drawer"
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </IconButton>
          <Link to={{ pathname: '/app', search }} className="flex items-center gap-2 rounded-xl" aria-label="Finova, ir al inicio">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0F172A] text-[10px] font-bold text-emerald-400 shadow-inner shadow-emerald-500/20">
              F
            </span>
            <span className="hidden text-xl font-black text-slate-900 sm:block">
              Finova<span className="text-emerald-500">*</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <PeriodPicker />
          <NavLink
            to={{ pathname: '/app/alertas', search }}
            aria-label={alertsLabel}
            className={({ isActive }) =>
              `relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-slate-700 transition hover:bg-slate-50 ${
                isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white'
              }`
            }
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {alertCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
              >
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </NavLink>
          <NavLink
            to={{ pathname: '/app/configuracion', search }}
            aria-label={`Configuración y cuenta de ${name}`}
            title={name}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#10B981] text-sm font-bold text-white transition hover:bg-[#059669]"
          >
            <span aria-hidden="true">{initials}</span>
          </NavLink>
        </div>
      </div>
    </header>
  )
})

export default AppHeader
