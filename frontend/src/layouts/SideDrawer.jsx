import { useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import IconButton from '../components/ui/IconButton'
import { useAuth } from '../context/AuthContext'
import { usePeriod } from '../context/PeriodContext'
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery'
import { useBodyScrollLock, useFocusTrap } from '../hooks/useFocusTrap'
import { useMoney } from '../hooks/useMoney'
import { initialsOf } from '../lib/format'
import { DRAWER_NAV, unreadAlertsLabel } from './navigation'

/**
 * Navegación lateral.
 * - < lg: drawer modal (overlay, foco atrapado, Escape, inerte cuando está cerrado).
 * - ≥ lg: sidebar persistente.
 * `alertCount`: alertas sin leer (el mismo número que la campana del header).
 */
export default function SideDrawer({ open, onClose, alertCount }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const modal = open && !isDesktop
  const panelRef = useRef(null)
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { search } = usePeriod()
  const { currency, symbol } = useMoney()
  const [loggingOut, setLoggingOut] = useState(false)

  useFocusTrap(panelRef, { active: modal, onEscape: onClose })
  useBodyScrollLock(modal)

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  const name = user?.full_name || 'Mi cuenta'
  // ≥ lg: barra lateral fija (<aside>). < lg: drawer modal (<dialog>, `open` solo mientras está abierto).
  // Es siempre el mismo elemento para que la transición de entrada/salida funcione: la clase `flex` mantiene
  // visible el <dialog> cerrado (fuera de pantalla e inerte) y `h-auto text-inherit` anulan el alto
  // "fit-content" y el color que el navegador da a <dialog>.
  const Panel = isDesktop ? 'aside' : 'dialog'

  return (
    <>
      {modal && <div aria-hidden="true" onClick={onClose} className="fixed inset-0 z-30 bg-slate-900/20 lg:hidden" />}

      <Panel
        ref={panelRef}
        id="app-drawer"
        aria-label="Menú principal"
        open={isDesktop ? undefined : modal}
        aria-modal={modal ? 'true' : undefined}
        inert={!open && !isDesktop}
        tabIndex={-1}
        className={`fixed inset-y-0 left-0 z-40 flex h-auto w-[min(85vw,340px)] transform flex-col overflow-y-auto overscroll-contain border-r border-slate-200 bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-inherit shadow-2xl outline-none transition-transform duration-300 lg:w-[340px] lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700"
            >
              {initialsOf(user?.full_name, user?.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-slate-900">{name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          <IconButton label="Cerrar menú" variant="soft" onClick={onClose} className="lg:hidden">
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          <span>Moneda principal</span>
          <span>
            {currency} · {symbol}
          </span>
        </div>

        <nav aria-label="Secciones" className="mt-8 space-y-2">
          {DRAWER_NAV.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.key}
                to={{ pathname: item.to, search }}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex min-h-11 w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-medium transition ${
                    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-50'
                  }`
                }
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </span>
                {item.badge === 'alerts' && alertCount > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold tabular-nums text-white">
                    <span aria-hidden="true">{alertCount > 99 ? '99+' : alertCount}</span>
                    <span className="sr-only"> ({unreadAlertsLabel(alertCount)})</span>
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="mt-auto pt-8">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {loggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      </Panel>
    </>
  )
}
