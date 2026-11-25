import { matchPath } from 'react-router-dom'
import { Bell, FileText, Landmark, Receipt, Settings, Target, Wallet } from 'lucide-react'

// Única fuente de verdad de la navegación del área privada (drawer/sidebar y barra inferior).
// `label` es el mismo nombre que usa cada pantalla; `short` es la etiqueta de la barra inferior móvil (debe caber en 360 px).
// `usesPeriod`: la pantalla cambia según el mes elegido, así que el header muestra el selector de período.
export const NAV_ITEMS = {
  dashboard: { to: '/app', end: true, label: 'Resumen', short: 'Inicio', icon: Wallet, usesPeriod: true },
  transactions: { to: '/app/movimientos', label: 'Movimientos', short: 'Movim.', icon: FileText, usesPeriod: true },
  accounts: { to: '/app/cuentas', label: 'Cuentas', short: 'Cuentas', icon: Landmark },
  budgets: { to: '/app/presupuestos', label: 'Presupuestos', short: 'Presup.', icon: Target, usesPeriod: true },
  taxes: { to: '/app/impuestos', label: 'Impuestos', short: 'Impuestos', icon: Receipt },
  alerts: { to: '/app/alertas', label: 'Alertas', short: 'Alertas', icon: Bell, badge: 'alerts' },
  settings: { to: '/app/configuracion', label: 'Configuración', short: 'Ajustes', icon: Settings },
}

export const DRAWER_NAV = ['dashboard', 'transactions', 'accounts', 'budgets', 'taxes', 'alerts', 'settings'].map((key) => ({ key, ...NAV_ITEMS[key] }))

export const BOTTOM_NAV = ['dashboard', 'transactions', 'budgets', 'accounts', 'alerts'].map((key) => ({ key, ...NAV_ITEMS[key] }))

/**
 * ¿La ruta actual depende del período? (Resumen, Movimientos, Presupuestos).
 * En Cuentas, Alertas, Impuestos y Configuración el selector no cambia nada y se oculta;
 * el `?mes=` se sigue conservando en los enlaces.
 */
export function routeUsesPeriod(pathname) {
  return Object.values(NAV_ITEMS).some(
    (item) => item.usesPeriod && matchPath({ path: item.to, end: item.end ?? false }, pathname),
  )
}

/** Texto accesible del contador de alertas sin leer (campana, sidebar y barra inferior). */
export function unreadAlertsLabel(count) {
  return count > 0 ? `${count} sin leer` : 'ninguna sin leer'
}
