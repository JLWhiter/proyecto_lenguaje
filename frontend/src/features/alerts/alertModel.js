import { Activity, AlertTriangle, Bell, CheckCircle2, Gauge, Info, OctagonAlert, Scale, Target } from 'lucide-react'
import { parseCountLabel } from '../../components/ui'
import { formatDate, formatTime } from '../../lib/format'
import { APP_TIME_ZONE, currentMonth, isValidMonth, monthLabel, shiftMonth } from '../../lib/period'

// Modelo de las alertas del backend (`core/alerts.py`): niveles, reglas, filtros, navegación y agrupación.

export const ACTIVE_ALERTS = 'activas'
export const ALL_STATES = 'todas'

/** Estilos por `nivel`. El nivel siempre se muestra con ícono + texto (nunca solo color). */
export const ALERT_LEVELS = {
  danger: {
    label: 'Urgente',
    Icon: OctagonAlert,
    border: 'border-l-red-500',
    icon: 'bg-red-50 text-red-600',
    chip: 'bg-red-50 text-red-700',
    bar: 'bg-red-500',
  },
  warning: {
    label: 'Advertencia',
    Icon: AlertTriangle,
    border: 'border-l-amber-500',
    icon: 'bg-amber-50 text-amber-600',
    chip: 'bg-amber-50 text-amber-800',
    bar: 'bg-amber-500',
  },
  info: {
    label: 'Información',
    Icon: Info,
    border: 'border-l-sky-500',
    icon: 'bg-sky-50 text-sky-600',
    chip: 'bg-sky-50 text-sky-800',
    bar: 'bg-sky-500',
  },
  success: {
    label: 'Logro',
    Icon: CheckCircle2,
    border: 'border-l-emerald-500',
    icon: 'bg-emerald-50 text-emerald-600',
    chip: 'bg-emerald-50 text-emerald-800',
    bar: 'bg-emerald-500',
  },
}

export function levelOf(nivel) {
  return ALERT_LEVELS[nivel] ?? ALERT_LEVELS.info
}

/** Reglas del motor (`regla`) con la etiqueta que usa el backend en `tipo` y en `filters`. */
export const ALERT_RULES = {
  budget_threshold: { label: 'Presupuesto', Icon: Target },
  budget_projection: { label: 'Ritmo de gasto', Icon: Gauge },
  atypical_expense: { label: 'Gasto inusual', Icon: Activity },
  negative_month: { label: 'Balance mensual', Icon: Scale },
  other: { label: 'General', Icon: Bell },
}

export function ruleOf(alert) {
  return ALERT_RULES[alert?.regla] ?? { label: alert?.tipo || 'General', Icon: Bell }
}

export const SNOOZE_OPTIONS = [
  { hours: 1, label: '1 hora', short: '1 h' },
  { hours: 24, label: '24 horas', short: '24 h' },
  { hours: 24 * 7, label: '7 días', short: '7 días' },
]

export const SILENCE_HOURS = 24

// --- Filtros -------------------------------------------------------------------

export const ALL_ALERTS = 'all'
const ALL_TYPES = 'Todos los tipos'

function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

const RULE_BY_LABEL = Object.fromEntries(Object.entries(ALERT_RULES).map(([code, rule]) => [normalize(rule.label), code]))

/**
 * Opciones de filtro a partir de `filters` del backend ("Todas (6)", "Presupuesto (2)", …).
 * La `key` es el código de la regla (estable), el `label` es el texto con el contador (cambia).
 */
export function alertFilterOptions(filters) {
  const options = (filters ?? []).map((text) => {
    const { key: label, count } = parseCountLabel(text)
    const normalized = normalize(label)
    if (normalized === 'todas' || normalized === 'todos') {
      // "Todas" ya es el nombre de la vista (Activas / Todas): aquí se habla de tipos.
      return { key: ALL_ALERTS, label: count === null ? ALL_TYPES : `${ALL_TYPES} (${count})`, name: ALL_TYPES, count }
    }
    const key = RULE_BY_LABEL[normalized] ?? `tipo:${label}`
    return { key, label: text, name: label, count }
  })
  return options.some((option) => option.key === ALL_ALERTS) ? options : [{ key: ALL_ALERTS, label: ALL_TYPES, name: ALL_TYPES, count: null }, ...options]
}

export function matchesFilter(alert, key) {
  if (!key || key === ALL_ALERTS) return true
  if (key.startsWith('tipo:')) return alert.tipo === key.slice(5)
  return alert.regla === key
}

// --- Navegación ------------------------------------------------------------------

// Etiqueta de la acción que abre directamente el diálogo de edición del presupuesto.
const EDIT_BUDGET_LABEL = normalize('Ajustar presupuesto')

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

function toTarget(pathname, params) {
  const search = params.toString()
  return { pathname, search: search ? `?${search}` : '' }
}

/**
 * Destino de la acción de una alerta. Única fuente para el Centro de Alertas (`accion`) y el Resumen
 * (`accion_detalle`). El mes es el de la acción o, si falta, el primero válido de `months`.
 * - budget → /app/presupuestos?mes=<mes>&presupuesto=<id> (+ `&accion=editar` si es «Ajustar presupuesto»)
 * - transaction (con id) → /app/movimientos?mes=<mes>&categoria=<categoria>&tipo=GASTO&movimiento=<id>
 *   (Movimientos resalta ese movimiento; sin `categoria` se omite ese filtro)
 * - transactions → /app/movimientos?mes=<mes>
 * Devuelve `null` si la acción no es navegable.
 */
export function alertActionTarget(action, ...months) {
  if (!action || typeof action !== 'object') return null
  const month = [action.mes, ...months].find(isValidMonth)
  const params = new URLSearchParams()
  if (month) params.set('mes', month)

  if (action.type === 'budget') {
    if (hasValue(action.id)) {
      params.set('presupuesto', String(action.id))
      if (normalize(action.label) === EDIT_BUDGET_LABEL) params.set('accion', 'editar')
    }
    return toTarget('/app/presupuestos', params)
  }
  if (action.type === 'transaction' && hasValue(action.id)) {
    if (hasValue(action.categoria)) params.set('categoria', String(action.categoria).trim())
    params.set('tipo', 'GASTO')
    params.set('movimiento', String(action.id))
    return toTarget('/app/movimientos', params)
  }
  if (action.type === 'transaction' || action.type === 'transactions') {
    return toTarget('/app/movimientos', params)
  }
  return null
}

/** Destino de la acción principal de una alerta del Centro de Alertas, o `null` (p. ej. alertas antiguas). */
export function alertTarget(alert) {
  if (!alert?.accion?.label) return null
  return alertActionTarget(alert.accion, alert.periodo)
}

// --- Fechas y períodos -------------------------------------------------------------

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

/** "hoy, 14:30" · "mañana, 09:00" · "mié, 2 dic., 10:00" (hora de Lima, 24 horas). */
export function untilText(value, now = new Date()) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return ''
  const key = dayKeyFormatter.format(date)
  const time = formatTime(date)
  if (key === dayKeyFormatter.format(now)) return `hoy, ${time}`
  if (key === dayKeyFormatter.format(new Date(now.getTime() + 86_400_000))) return `mañana, ${time}`
  return `${formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`
}

/** Estado de una alerta que no está activa (vista "Todas"): `{ kind, label }` o `null`. */
export function inactiveState(alert) {
  if (alert?.descartada) return { kind: 'dismissed', label: 'Descartada' }
  if (alert?.pospuesta_hasta) return { kind: 'snoozed', label: `Pospuesta hasta ${untilText(alert.pospuesta_hasta)}` }
  return null
}

/**
 * Agrupa por período conservando el orden de la API dentro de cada grupo.
 * Mes en curso primero; las alertas de meses anteriores ("Octubre 2026") van en su propio grupo.
 */
export function groupByPeriod(items, current = currentMonth()) {
  const groups = new Map()
  for (const alert of items) {
    const key = isValidMonth(alert.periodo) && alert.periodo < current ? alert.periodo : current
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(alert)
  }
  const previous = shiftMonth(current, -1)
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, list]) => ({
      key,
      label: monthLabel(key),
      note: key === current ? 'Mes en curso' : key === previous ? 'Mes anterior' : 'Mes cerrado',
      current: key === current,
      items: list,
    }))
}

export function plural(count, singular, pluralText) {
  return `${count} ${count === 1 ? singular : pluralText}`
}
