import { useId, useRef } from 'react'
import { Link } from 'react-router-dom'
import { AlarmClock, Bell, ChevronRight, CircleCheck, X } from 'lucide-react'
import { levelOf } from '../alerts/alertModel'
import { MaskedText } from '../transactions/Money'
import { CARD, CARD_TITLE, CardLink } from './DashboardBits'
import { alertTarget } from './dashboardUtils'
import { useAlertQuickActions } from './useAlertQuickActions'

// Etiqueta e ícono del nivel salen del Centro de Alertas (`ALERT_LEVELS`): "Urgente", "Advertencia",
// "Información", "Logro". Aquí solo cambian los colores de la tarjeta compacta del Resumen.
const LEVEL_STYLES = {
  danger: {
    card: 'border-red-100 border-l-red-500 bg-red-50/60',
    icon: 'bg-red-100 text-red-600',
    badge: 'bg-red-100 text-red-700',
  },
  warning: {
    card: 'border-amber-100 border-l-amber-400 bg-amber-50/60',
    icon: 'bg-amber-100 text-amber-700',
    badge: 'bg-amber-100 text-amber-800',
  },
  info: {
    card: 'border-sky-100 border-l-sky-500 bg-sky-50/60',
    icon: 'bg-sky-100 text-sky-600',
    badge: 'bg-sky-100 text-sky-700',
  },
  success: {
    card: 'border-emerald-100 border-l-emerald-500 bg-emerald-50/60',
    icon: 'bg-emerald-100 text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-800',
  },
}

/** `nivel` (danger|warning|info|success) como en Alertas; `tipo` es el nivel simplificado del resumen. */
function dashboardLevel(alert) {
  const key = [alert.nivel, alert.tipo].find((value) => LEVEL_STYLES[value]) ?? 'info'
  const { label, Icon } = levelOf(key)
  return { ...LEVEL_STYLES[key], label, Icon }
}

const QUIET_BUTTON =
  'inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-slate-600 sm:px-3 transition hover:bg-white hover:text-slate-900 disabled:cursor-wait disabled:opacity-60'

function AlertItem({ alert, period, search, busy, onSnooze, onDismiss }) {
  const titleId = useId()
  const level = dashboardLevel(alert)
  const Icon = level.Icon
  const target = alertTarget(alert, period) ?? { pathname: '/app/alertas', search }
  const actionLabel = alert.accion_detalle?.label || alert.accion
  const working = busy?.id === alert.id

  return (
    <li className={`rounded-2xl border border-l-4 p-3.5 sm:p-4 ${level.card}`}>
      {/* En móvil el ícono va en la fila de etiquetas y el texto usa todo el ancho; desde sm, columna a la izquierda. */}
      <div className="sm:flex sm:items-start sm:gap-3">
        <span className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-full sm:flex ${level.icon}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:hidden ${level.icon}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className={`rounded-full px-2 py-0.5 font-bold uppercase tracking-wide ${level.badge}`}>{level.label}</span>
            {alert.categoria && <span className="font-medium text-slate-600">{alert.categoria}</span>}
            {alert.tiempo && <span className="whitespace-nowrap text-slate-500">· {alert.tiempo}</span>}
          </div>
          <h3 id={titleId} className="mt-2 break-words text-base font-semibold text-slate-900 sm:mt-1.5">
            <MaskedText>{alert.titulo}</MaskedText>
          </h3>
          {alert.descripcion && (
            <p className="mt-1 break-words text-sm leading-6 text-slate-600"><MaskedText>{alert.descripcion}</MaskedText></p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
            {actionLabel && (
              <Link
                to={target}
                aria-describedby={titleId}
                className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-white px-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-50"
              >
                {actionLabel}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
            <button type="button" onClick={() => onSnooze(alert)} disabled={working} aria-describedby={titleId} className={QUIET_BUTTON}>
              <AlarmClock className="h-4 w-4" aria-hidden="true" />
              {working && busy.action === 'snooze' ? 'Posponiendo…' : 'Posponer 24 h'}
            </button>
            <button type="button" onClick={() => onDismiss(alert)} disabled={working} aria-describedby={titleId} className={QUIET_BUTTON}>
              <X className="h-4 w-4" aria-hidden="true" />
              {working && busy.action === 'dismiss' ? 'Descartando…' : 'Descartar'}
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

/** Las 3 alertas activas más importantes, con acciones rápidas. */
export default function AlertsCard({ data, period, search }) {
  const headingRef = useRef(null)
  const actions = useAlertQuickActions(data)
  const alerts = (data.alertas_activas ?? []).filter((alert) => !actions.isHandled(alert.id))
  const pending = Math.max(0, (Number(data.alertas_pendientes) || 0) - actions.handledCount, alerts.length)

  // Al quitar una alerta de la lista, el foco vuelve al título de la tarjeta (no se pierde en <body>).
  const after = (action) => async (alert) => {
    if (await action(alert)) headingRef.current?.focus()
  }

  return (
    <section aria-labelledby="dashboard-alerts-title" className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Bell className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 id="dashboard-alerts-title" ref={headingRef} tabIndex={-1} className={`${CARD_TITLE} outline-none`}>
            Centro de Alertas Activas
          </h2>
          {pending > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              {/* Mismo término que el Centro de Alertas ("6 activas · 4 sin leer"); la campana cuenta las sin leer. */}
              {pending} {pending === 1 ? 'activa' : 'activas'}
            </span>
          )}
        </div>
        <CardLink to={{ pathname: '/app/alertas', search }}>{pending > 0 ? `Ver todas (${pending})` : 'Ir a alertas'}</CardLink>
      </div>

      {alerts.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {alerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              period={period}
              search={search}
              busy={actions.busy}
              onSnooze={after(actions.snooze)}
              onDismiss={after(actions.dismiss)}
            />
          ))}
        </ul>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50/70 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CircleCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">Todo en orden</p>
            <p className="text-sm text-slate-600">No tienes alertas activas. Te avisaremos si un presupuesto se acerca a su límite.</p>
          </div>
        </div>
      )}
    </section>
  )
}
