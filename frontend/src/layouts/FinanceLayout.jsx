import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { PageSkeleton } from '../components/ui'
import { FinanceDataProvider } from '../context/FinanceDataContext'
import { PeriodProvider } from '../context/PeriodContext'
import { PreferencesProvider } from '../context/PreferencesContext'
import { useAlerts } from '../features/alerts/useAlerts'
import AppHeader from './AppHeader'
import BottomNav from './BottomNav'
import SideDrawer from './SideDrawer'

/** Layout del área privada (/app/*): proveedores de datos + header + navegación + <Outlet />. */
export default function FinanceLayout() {
  return (
    <FinanceDataProvider>
      <PeriodProvider>
        <PreferencesProvider>
          <FinanceShell />
        </PreferencesProvider>
      </PeriodProvider>
    </FinanceDataProvider>
  )
}

function FinanceShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const { pathname } = useLocation()
  // Se recarga con invalidate('alerts'): campana (sin leer), drawer y barra inferior (activas).
  const alerts = useAlerts()
  const activeAlertCount = alerts.data?.counts?.activas ?? alerts.data?.items?.length ?? 0
  const unreadAlertCount = alerts.data?.counts?.no_leidas ?? 0

  // Al cambiar de pantalla: cerrar el drawer y volver arriba.
  useEffect(() => {
    setDrawerOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 lg:pl-[340px]">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      <AppHeader
        ref={menuButtonRef}
        drawerOpen={drawerOpen}
        onOpenMenu={() => setDrawerOpen(true)}
        unreadAlertCount={unreadAlertCount}
      />

      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} alertCount={activeAlertCount} />

      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto max-w-7xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-6 outline-none sm:px-6 lg:px-8 lg:pb-10"
      >
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>

      <BottomNav alertCount={activeAlertCount} />
    </div>
  )
}
