// Fechas de movimientos en hora de Lima (UTC−5 todo el año, sin horario de verano).
import { APP_TIME_ZONE, currentMonth, daysInMonth, isValidMonth } from '../../lib/period'

const LIMA_OFFSET = '-05:00'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function limaParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

export function isValidDate(value) {
  return typeof value === 'string' && DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

/** Hoy en Lima: '2026-11-25'. */
export function todayInLima(now = new Date()) {
  const { year, month, day } = limaParts(now)
  return `${year}-${month}-${day}`
}

/** Hora actual en Lima: '14:05:09'. */
function limaTime(now = new Date()) {
  const { hour, minute, second } = limaParts(now)
  return `${hour}:${minute}:${second}`
}

/** Día local de un `occurred_at` del backend ('2026-11-25T09:30:00-05:00' → '2026-11-25'). */
export function dateOfMovement(occurredAt) {
  if (!occurredAt) return ''
  const date = new Date(occurredAt)
  if (Number.isNaN(date.getTime())) return String(occurredAt).slice(0, 10)
  return todayInLima(date)
}

/** Hora local de un `occurred_at` ('…T09:30:00-05:00' → '09:30:00'). */
function timeOfMovement(occurredAt) {
  const date = new Date(occurredAt)
  return Number.isNaN(date.getTime()) ? '12:00:00' : limaTime(date)
}

/**
 * Fecha propuesta para un movimiento nuevo: hoy si estás viendo el mes actual;
 * si estás revisando un mes pasado, su último día (así el movimiento aparece en la lista que ves).
 */
export function defaultMovementDate(period, now = new Date()) {
  const today = todayInLima(now)
  if (!isValidMonth(period) || period >= currentMonth(now)) return today
  return `${period}-${String(daysInMonth(period)).padStart(2, '0')}`
}

/**
 * `occurred_at` para el backend a partir del día elegido en el formulario.
 * - Movimiento nuevo: ese día con la hora actual de Lima (si es hoy, "ahora").
 * - Edición: conserva la hora original del movimiento (`keepTimeOf`).
 */
export function occurredAtFromDate(date, { keepTimeOf } = {}) {
  const time = keepTimeOf ? timeOfMovement(keepTimeOf) : limaTime()
  return `${date}T${time}${LIMA_OFFSET}`
}

/** '2026-11-25' → '25 nov. 2026' (para textos de ayuda). */
export function formatDay(date) {
  if (!isValidDate(date)) return ''
  return new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  )
}

/** '2026-11-25T09:30:00-05:00' → 'miércoles, 25 de noviembre de 2026' */
export function formatLongDay(occurredAt) {
  const date = new Date(occurredAt)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: APP_TIME_ZONE,
  }).format(date)
}
