import { AlertTriangle, Bell, CalendarDays, CheckCircle2 } from 'lucide-react'
import { parseCountLabel, ProgressBar } from '../../components/ui'

// Estilos por `nivel` de alerta que envía el backend.
export const ALERT_LEVELS = {
  rojo: { border: 'border-l-red-500', icon: 'bg-red-100 text-red-600', badge: 'bg-red-100 text-red-700', bar: 'bg-red-500', Icon: AlertTriangle },
  amber: { border: 'border-l-amber-500', icon: 'bg-amber-100 text-amber-600', badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500', Icon: Bell },
  indigo: { border: 'border-l-indigo-500', icon: 'bg-indigo-100 text-indigo-600', badge: 'bg-indigo-100 text-indigo-700', bar: 'bg-indigo-500', Icon: CalendarDays },
  green: { border: 'border-l-emerald-500', icon: 'bg-emerald-100 text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500', Icon: CheckCircle2 },
}

/** Tarjeta de alerta. Las acciones (botones) se pasan como `children`. */
export default function AlertCard({ alert, children }) {
  const level = ALERT_LEVELS[alert.nivel] ?? ALERT_LEVELS.green
  const Icon = level.Icon

  return (
    <article className={`rounded-[24px] border-l-4 bg-white p-5 shadow-sm ${level.border}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${level.icon}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${level.badge}`}>{alert.badge}</span>
            <span className="text-xs text-slate-500">{alert.tiempo}</span>
          </div>
          <h3 className="mt-3 break-words text-xl font-bold text-slate-900">{alert.titulo}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{alert.descripcion}</p>
          {alert.porcentaje ? (
            <ProgressBar value={alert.porcentaje} label={alert.titulo} className="mt-4 h-2.5 bg-slate-100" barClassName={level.bar} />
          ) : null}
          {children && <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div>}
        </div>
      </div>
    </article>
  )
}

export const ALL_ALERTS = 'Todas'

/** Opciones de filtro a partir de `filters` del backend ("Todas (5)", "Metas (1)", …). */
export function alertFilterOptions(filters) {
  const options = (filters ?? []).map((text) => ({ key: parseCountLabel(text).key, label: text }))
  return options.length ? options : [{ key: ALL_ALERTS, label: 'Todas (0)' }]
}

/** Filtra por categoría (`alert.tipo`); la clave 'Todas' devuelve todas. */
export function filterAlerts(items, key) {
  if (!key || key === ALL_ALERTS) return items ?? []
  return (items ?? []).filter((alert) => alert.tipo === key)
}
