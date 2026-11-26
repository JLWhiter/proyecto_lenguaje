// Reglas, textos y estilos de Metas de ahorro (sin React). Estados y cálculos: backend/goals/planning.py.
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  CalendarX2,
  Gift,
  GraduationCap,
  Heart,
  Home,
  Laptop,
  PiggyBank,
  Plane,
  TrendingUp,
} from 'lucide-react'
import { toNumber } from '../../lib/format'
import { monthLabel } from '../../lib/period'
import { amountError, looseCategoryKey, normalizeAmount } from '../budgets/budgetModel'
import { isValidDate } from '../transactions/dates'

/** Recursos a recargar después de crear, editar, archivar o eliminar una meta, o registrar un movimiento. */
export const GOAL_MUTATION_TAGS = ['goals', 'alerts', 'dashboard']

/** `?meta=<id>`: Alertas y el Resumen enlazan así a una meta concreta (se resalta su tarjeta). */
export const HIGHLIGHT_PARAM = 'meta'

export const ACTIVE = 'activas'
export const ARCHIVED = 'archivadas'
export const DEPOSIT = 'APORTE'
export const WITHDRAWAL = 'RETIRO'

export const NAME_MAX = 120
export const DESCRIPTION_MAX = 180
export const NOTE_MAX = 160

/** Aclaración que acompaña a la pantalla y a los formularios de aportes. */
export const NO_LEDGER_NOTE = 'Registra lo que vas separando para esta meta; no mueve dinero entre tus cuentas.'
export const WITHDRAWAL_NOTE = 'Registra lo que usaste de lo ahorrado para esta meta; no mueve dinero entre tus cuentas.'

export const STATUS = {
  IN_PROGRESS: 'En curso',
  BEHIND: 'Atrasada',
  REACHED: 'Alcanzada',
  OVERDUE: 'Vencida',
}

/** Estilos por estado. El estado siempre se muestra con ícono + texto (nunca solo color). */
const STATUS_STYLES = {
  [STATUS.IN_PROGRESS]: {
    Icon: TrendingUp,
    badge: 'bg-sky-50 text-sky-800',
    tile: 'bg-sky-50 text-sky-600',
    bar: 'bg-sky-500',
    track: 'bg-sky-100',
    text: 'text-sky-700',
  },
  [STATUS.BEHIND]: {
    Icon: AlertTriangle,
    badge: 'bg-amber-100 text-amber-800',
    tile: 'bg-amber-50 text-amber-600',
    bar: 'bg-amber-500',
    track: 'bg-amber-100',
    text: 'text-amber-700',
  },
  [STATUS.REACHED]: {
    Icon: CheckCircle2,
    badge: 'bg-emerald-100 text-emerald-800',
    tile: 'bg-emerald-50 text-emerald-600',
    bar: 'bg-emerald-500',
    track: 'bg-emerald-100',
    text: 'text-emerald-700',
  },
  [STATUS.OVERDUE]: {
    Icon: CalendarX2,
    badge: 'bg-red-100 text-red-700',
    tile: 'bg-red-50 text-red-600',
    bar: 'bg-red-500',
    track: 'bg-red-100',
    text: 'text-red-600',
  },
}

export function statusStyles(status) {
  return STATUS_STYLES[status] ?? STATUS_STYLES[STATUS.IN_PROGRESS]
}

/** Íconos que acepta el backend para una meta (`GoalIcon`). */
export const GOAL_ICONS = [
  { value: 'piggy', label: 'Ahorro', Icon: PiggyBank },
  { value: 'laptop', label: 'Tecnología', Icon: Laptop },
  { value: 'plane', label: 'Viaje', Icon: Plane },
  { value: 'home', label: 'Casa', Icon: Home },
  { value: 'car', label: 'Auto', Icon: Car },
  { value: 'graduation', label: 'Estudios', Icon: GraduationCap },
  { value: 'gift', label: 'Regalo', Icon: Gift },
  { value: 'heart', label: 'Bienestar', Icon: Heart },
]

export const DEFAULT_ICON = GOAL_ICONS[0].value

export function goalIcon(name) {
  return (GOAL_ICONS.find((icon) => icon.value === name) ?? GOAL_ICONS[0]).Icon
}

// --- Progreso -------------------------------------------------------------------------

function clampPercent(value) {
  return Math.min(100, Math.max(0, toNumber(value)))
}

/** Ancho de la barra (0–100). */
export function barPercent(goal) {
  return clampPercent(goal?.porcentaje)
}

/** Posición de la marca "deberías llevar" (0–100), o `null` si no aplica (meta alcanzada, vencida o archivada). */
export function expectedMarker(goal) {
  const tracking = goal?.estado === STATUS.IN_PROGRESS || goal?.estado === STATUS.BEHIND
  if (!tracking || goal?.archivada) return null
  return clampPercent(goal.porcentaje_esperado)
}

/** 72 → '72%' · 83.25 → '83.3%' */
export function percentText(value) {
  return `${toNumber(value).toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`
}

const STATUS_PRIORITY = { [STATUS.BEHIND]: 0, [STATUS.OVERDUE]: 1, [STATUS.IN_PROGRESS]: 2, [STATUS.REACHED]: 3 }

/** Las `limit` metas activas que más atención piden (atrasadas, vencidas, en curso, alcanzadas), sin alterar su orden dentro de cada estado. */
export function topGoals(goals, limit = 2) {
  return (goals ?? [])
    .filter((goal) => !goal.archivada)
    .map((goal, index) => ({ goal, index, rank: STATUS_PRIORITY[goal.estado] ?? STATUS_PRIORITY[STATUS.IN_PROGRESS] }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.goal)
}

// --- Fechas y textos ----------------------------------------------------------------------

const shortDateFormatter = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** '2027-03-31' → '31 mar. 2027' (fecha sin hora: no se corre un día por la zona horaria). */
export function formatGoalDate(iso) {
  if (!isValidDate(iso)) return ''
  const [year, month, day] = iso.split('-').map(Number)
  return shortDateFormatter.format(new Date(Date.UTC(year, month - 1, day)))
}

/** addDays('2026-11-30', 1) → '2026-12-01' (fechas AAAA-MM-DD, sin zona horaria). */
export function addDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function monthsText(months) {
  const value = toNumber(months)
  return value === 1 ? '1 mes' : `${value} meses`
}

/**
 * Frase sobre la fecha estimada (ritmo de los últimos 6 meses), o `null` si la meta ya se alcanzó.
 * `late`: la estimación cae después de la fecha objetivo.
 */
export function estimateInfo(goal) {
  if (!goal || goal.estado === STATUS.REACHED) return null
  if (!goal.fecha_estimada) {
    return { late: false, text: 'Aún no hay un ritmo de ahorro para estimar cuándo llegarás.' }
  }
  const late = goal.fecha_estimada > goal.fecha_objetivo
  const when = formatGoalDate(goal.fecha_estimada)
  return {
    late,
    text: late ? `A tu ritmo actual llegarías el ${when}, después de tu fecha objetivo.` : `A tu ritmo actual llegarías el ${when}.`,
  }
}

/** Serie mensual del backend → puntos del gráfico (`label` corto: 'Nov'). */
export function chartPoints(series) {
  return (series ?? []).map((point) => ({
    mes: point.mes,
    label: monthLabel(point.mes, { short: true }).slice(0, 3),
    name: monthLabel(point.mes),
    value: toNumber(point.aportado),
  }))
}

// --- Formularios -------------------------------------------------------------------------

/** Clave para comparar nombres de metas como el backend: sin mayúsculas, espacios repetidos ni tildes. */
export function goalNameKey(name) {
  return looseCategoryKey(name)
}

function textError(value, { max, required, requiredMessage }) {
  const text = String(value ?? '').trim()
  if (required && !text) return requiredMessage
  if (text.length > max) return `Usa como máximo ${max} caracteres.`
  return ''
}

/**
 * Errores del formulario de meta ({ campo: mensaje }).
 * `takenNames`: claves (`goalNameKey`) de las otras metas activas. `goal`: la meta que se edita (o null).
 */
export function goalFormErrors(values, { today, takenNames = new Set(), goal = null } = {}) {
  const errors = {
    name: textError(values.name, { max: NAME_MAX, required: true, requiredMessage: 'Escribe un nombre para tu meta.' }),
    target_amount: amountError(values.target_amount, { label: 'cuánto quieres juntar' }),
    target_date: targetDateError(values.target_date, today, goal),
    description: textError(values.description, { max: DESCRIPTION_MAX }),
    initial_amount: goal ? '' : initialAmountError(values.initial_amount),
  }
  if (!errors.name && takenNames.has(goalNameKey(values.name))) errors.name = 'Ya tienes una meta activa con ese nombre.'
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message))
}

function targetDateError(value, today, goal) {
  if (!value) return 'Elige la fecha en la que quieres lograrlo.'
  if (!isValidDate(value)) return 'Ingresa una fecha válida.'
  if (goal && value === goal.fecha_objetivo) return ''
  return value > today ? '' : 'La fecha objetivo debe ser posterior a hoy.'
}

function initialAmountError(value) {
  if (!String(value ?? '').trim()) return ''
  const number = Number(normalizeAmount(value))
  if (number === 0) return ''
  return number < 0 ? 'El monto no puede ser negativo.' : amountError(value, { label: 'el monto inicial' })
}

/** Cuerpo del POST (crear) o, al editar, solo los campos que cambiaron (`{}` si nada cambió). */
export function goalPayload(values, goal = null) {
  const payload = {
    name: values.name.trim().replace(/\s+/g, ' '),
    target_amount: normalizeAmount(values.target_amount),
    target_date: values.target_date,
    icon: values.icon,
    description: values.description.trim(),
  }
  if (!goal) {
    const initial = normalizeAmount(values.initial_amount)
    return Number(initial) > 0 ? { ...payload, initial_amount: initial } : payload
  }
  const current = {
    name: goal.nombre,
    target_amount: toNumber(goal.objetivo),
    target_date: goal.fecha_objetivo,
    icon: goal.icono,
    description: goal.descripcion ?? '',
  }
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => (key === 'target_amount' ? Number(value) !== current[key] : value !== current[key])),
  )
}

/**
 * Errores del formulario de aporte o retiro. `saved`: lo ahorrado (tope del retiro);
 * `created`: día en que se creó la meta (AAAA-MM-DD); `formatMoney`: formateador de montos (o null si están ocultos).
 */
export function movementErrors(values, { kind, saved, created, today, formatMoney = null }) {
  const errors = {}
  const amount = amountError(values.amount, { label: kind === WITHDRAWAL ? 'cuánto retiras' : 'cuánto separas' })
  if (amount) errors.amount = amount
  else if (kind === WITHDRAWAL && Number(normalizeAmount(values.amount)) > toNumber(saved)) {
    errors.amount = formatMoney
      ? `No puedes retirar más de lo ahorrado (${formatMoney(saved)}).`
      : 'No puedes retirar más de lo que llevas ahorrado.'
  }
  const date = movementDateError(values.occurred_at, created, today)
  if (date) errors.occurred_at = date
  if (String(values.note ?? '').trim().length > NOTE_MAX) errors.note = `Usa como máximo ${NOTE_MAX} caracteres.`
  return errors
}

function movementDateError(value, created, today) {
  if (!value) return 'Elige la fecha.'
  if (!isValidDate(value)) return 'Ingresa una fecha válida.'
  if (value > today) return 'La fecha no puede ser posterior a hoy.'
  if (created && value < created) return 'La fecha no puede ser anterior al día en que creaste la meta.'
  return ''
}
