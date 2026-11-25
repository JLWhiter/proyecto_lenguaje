// Utilidades de períodos mensuales (formato AAAA-MM), siempre en hora de Lima.

export const APP_TIME_ZONE = 'America/Lima'

// Nombres como se usan en Perú y como los envía el backend: 'Setiembre' / 'Set' (no 'Septiembre' / 'Sep').
export const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

export function isValidMonth(value) {
  return typeof value === 'string' && MONTH_PATTERN.test(value)
}

/** Mes actual en America/Lima, p. ej. '2026-11'. */
export function currentMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year').value
  const month = parts.find((part) => part.type === 'month').value
  return `${year}-${month}`
}

/** shiftMonth('2026-01', -1) → '2025-12' */
export function shiftMonth(month, offset) {
  const [year, value] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, value - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/** monthName('2026-11') → 'Noviembre' */
export function monthName(month) {
  if (!isValidMonth(month)) return ''
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1]
}

/** monthLabel('2026-11') → 'Noviembre 2026'; con { short: true } → 'Nov 2026' */
export function monthLabel(month, { short = false } = {}) {
  if (!isValidMonth(month)) return ''
  const name = monthName(month)
  return `${short ? name.slice(0, 3) : name} ${month.slice(0, 4)}`
}

/**
 * Mes dentro de una frase, en minúscula como se escribe en español:
 * monthPhrase('2026-11') → 'noviembre 2026'; con { year: false } → 'noviembre'.
 */
export function monthPhrase(month, { year = true } = {}) {
  if (!isValidMonth(month)) return ''
  const name = monthName(month).toLocaleLowerCase('es')
  return year ? `${name} ${month.slice(0, 4)}` : name
}

/** Últimos `count` meses terminando en `until` (incluido), del más reciente al más antiguo. */
export function recentMonths(count = 24, until = currentMonth()) {
  return Array.from({ length: count }, (_, index) => shiftMonth(until, -index))
}

/** Último día (número) del mes AAAA-MM. */
export function daysInMonth(month) {
  const [year, value] = month.split('-').map(Number)
  return new Date(Date.UTC(year, value, 0)).getUTCDate()
}

/**
 * Fecha ISO para registrar un movimiento "en" el período seleccionado:
 * mes actual → ahora; otro mes → día 24 a mediodía de Lima (comportamiento previo).
 */
export function occurredAtForPeriod(period, now = new Date()) {
  if (!isValidMonth(period) || period === currentMonth(now)) return now.toISOString()
  return `${period}-24T12:00:00-05:00`
}
