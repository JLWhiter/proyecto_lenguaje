// Helpers puros del Resumen (sin React).
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { formatNumber, formatTime } from '../../lib/format'
import { APP_TIME_ZONE, isValidMonth, monthPhrase, shiftMonth } from '../../lib/period'
import { alertActionTarget } from '../alerts/alertModel'

export { HIDDEN_AMOUNT, maskAmountsInText } from '../../lib/format'

const TONE_CLASSES = {
  good: 'bg-emerald-50 text-emerald-700',
  bad: 'bg-red-50 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  // '+1,292.6%' (texto del backend, con separador de miles) → 1292.6
  const number = Number.parseFloat(String(value).replace('%', '').replaceAll(',', '').trim())
  return Number.isFinite(number) ? number : null
}

/**
 * Variación porcentual → flecha, color y textos ('+1,292.6%', con separador de miles).
 * `increaseIsGood`: true para ingresos/saldo (subir es bueno), false para gastos (subir es malo).
 * `null` (mes anterior en 0) → "—" neutro.
 */
export function variationInfo(pct, { increaseIsGood = true } = {}) {
  const value = toFiniteNumber(pct)
  if (value === null) {
    return { tone: 'neutral', className: TONE_CLASSES.neutral, Icon: null, text: '—', srText: 'sin datos del mes anterior para comparar' }
  }
  if (value === 0) {
    return { tone: 'neutral', className: TONE_CLASSES.neutral, Icon: Minus, text: '0.0%', srText: 'sin cambios' }
  }
  const up = value > 0
  const tone = up === increaseIsGood ? 'good' : 'bad'
  const magnitude = formatNumber(Math.abs(value), { digits: 1 })
  return {
    tone,
    className: TONE_CLASSES[tone],
    Icon: up ? ArrowUpRight : ArrowDownRight,
    text: `${up ? '+' : '-'}${magnitude}%`,
    srText: `${up ? 'subió' : 'bajó'} ${magnitude} %`,
  }
}

/** '+233.8%' → 233.8 (tendencia del gráfico de saldo). */
export function parsePercentText(text) {
  return toFiniteNumber(text)
}

/** Mes anterior dentro de una frase ("vs. octubre"): 'octubre' (mismo año) o 'diciembre 2025' (cambia el año). */
export function previousMonthText(period) {
  if (!isValidMonth(period)) return 'el mes anterior'
  const previous = shiftMonth(period, -1)
  return monthPhrase(previous, { year: previous.slice(0, 4) !== period.slice(0, 4) })
}

/** Semáforo del presupuesto: verde < 75 %, ámbar < 90 %, rojo ≥ 90 %. */
export function budgetTone(percentage) {
  const value = toFiniteNumber(percentage) ?? 0
  if (value >= 100) return { bar: 'bg-red-500', track: 'bg-red-100', chip: 'bg-red-50 text-red-700', text: 'text-red-600', label: 'Excedido' }
  if (value >= 90) return { bar: 'bg-red-500', track: 'bg-red-100', chip: 'bg-red-50 text-red-700', text: 'text-red-600', label: 'Al límite' }
  if (value >= 75) {
    return { bar: 'bg-amber-400', track: 'bg-amber-100', chip: 'bg-amber-50 text-amber-800', text: 'text-amber-700', label: 'Cerca del límite' }
  }
  return { bar: 'bg-emerald-500', track: 'bg-emerald-100', chip: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700', label: 'En control' }
}

/** `?mes=…&tipo=…&categoria=…` para abrir Movimientos ya filtrado. */
export function movementsLink(period, filters = {}) {
  const params = new URLSearchParams()
  if (isValidMonth(period)) params.set('mes', period)
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return { pathname: '/app/movimientos', search: query ? `?${query}` : '' }
}

/**
 * Destino de la acción principal de una alerta según `accion_detalle` (mismo constructor de enlaces
 * que el Centro de Alertas). `null` → el llamador usa /app/alertas.
 */
export function alertTarget(alert, fallbackPeriod) {
  return alertActionTarget(alert?.accion_detalle, alert?.periodo, fallbackPeriod)
}

/** Metas de ahorro; con `id` resalta esa meta (`?meta=<id>`), el mismo destino que las alertas de metas. */
export function goalsLink(id) {
  return alertActionTarget({ type: 'goal', id })
}

const limaDay = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const limaShortDay = new Intl.DateTimeFormat('es-PE', { timeZone: APP_TIME_ZONE, day: 'numeric', month: 'short' })

/** 'Hoy', 'Ayer' o '24 nov.' para el día `day` (AAAA-MM-DD en Lima) de `date`. */
function relativeDayText(day, now, date) {
  if (day === limaDay.format(now)) return 'Hoy'
  if (day === limaDay.format(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return 'Ayer'
  return limaShortDay.format(date)
}

/** Fecha de un movimiento en hora de Lima (24 horas): 'Hoy, 18:30', 'Ayer, …' o '24 nov., 11:00'. */
export function movementWhen(occurredAt, now = new Date()) {
  const date = occurredAt ? new Date(occurredAt) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return `${relativeDayText(limaDay.format(date), now, date)}, ${formatTime(date)}`
}
