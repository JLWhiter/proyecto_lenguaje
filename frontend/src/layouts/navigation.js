import { Bell, FileText, Landmark, Settings, Target, Wallet } from 'lucide-react'

// Única fuente de verdad de la navegación del área privada (drawer/sidebar y barra inferior).
// `short` es la etiqueta de la barra inferior móvil (debe caber en 360 px).
export const NAV_ITEMS = {
  dashboard: { to: '/app', end: true, label: 'Dashboard Principal', short: 'Inicio', icon: Wallet },
  transactions: { to: '/app/movimientos', label: 'Movimientos', short: 'Movim.', icon: FileText },
  accounts: { to: '/app/cuentas', label: 'Mis Cuentas Bancarias', short: 'Cuentas', icon: Landmark },
  budgets: { to: '/app/presupuestos', label: 'Presupuestos & Metas', short: 'Presup.', icon: Target },
  alerts: { to: '/app/alertas', label: 'Centro de Alertas', short: 'Alertas', icon: Bell, badge: 'alerts' },
  settings: { to: '/app/configuracion', label: 'Configuración del Sistema', short: 'Ajustes', icon: Settings },
}

export const DRAWER_NAV = ['dashboard', 'transactions', 'accounts', 'budgets', 'alerts', 'settings'].map((key) => ({ key, ...NAV_ITEMS[key] }))

export const BOTTOM_NAV = ['dashboard', 'transactions', 'budgets', 'accounts', 'alerts'].map((key) => ({ key, ...NAV_ITEMS[key] }))
