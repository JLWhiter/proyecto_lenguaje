import { NavLink } from 'react-router-dom'
import { usePeriod } from '../context/PeriodContext'
import { BOTTOM_NAV } from './navigation'

/** Barra inferior (solo < lg). Etiquetas cortas para que quepa en 360 px; respeta el área segura del iPhone. */
export default function BottomNav({ alertCount }) {
  const { search } = usePeriod()

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid max-w-5xl grid-cols-5 gap-1 px-2 py-1.5">
        {BOTTOM_NAV.map((item) => {
          const Icon = item.icon
          const showBadge = item.badge === 'alerts' && alertCount > 0
          return (
            <li key={item.key} className="min-w-0">
              <NavLink
                to={{ pathname: item.to, search }}
                end={item.end}
                aria-label={showBadge ? `${item.label}: ${alertCount} activas` : item.label}
                className={({ isActive }) =>
                  `flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[11px] font-semibold leading-tight transition ${
                    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-700'
                  }`
                }
              >
                <span className="relative inline-flex h-5 w-5 items-center justify-center">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  {showBadge && (
                    <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
                  )}
                </span>
                <span aria-hidden="true" className="block max-w-full truncate">
                  {item.short}
                </span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
