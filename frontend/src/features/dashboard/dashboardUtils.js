// Helpers puros del Resumen (sin React).
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { APP_TIME_ZONE, isValidMonth, monthLabel, monthName, shiftMonth } from '../../lib/period'

export const HIDDEN_AMOUNT = '••••'

const TONE_CLASSES = {
  good: 'bg-emerald-50 text-emerald-700',
  bad: 'bg-red-50 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value).replace('%', '').replace(',', '.'))
  return Number.isFinite(number) ? number : null
}

/**
 * Variación porcentual → flecha, color y textos.
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
  const magnitude = Math.abs(value).toFixed(1)
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

/** Mes anterior para "vs …": 'Octubre' (mismo año) o 'Diciembre 2025' (cambia el año). */
export function previousMonthText(period) {
  if (!isValidMonth(period)) return 'el mes anterior'
  const previous = shiftMonth(period, -1)
  return previous.slice(0, 4) === period.slice(0, 4) ? monthName(previous) : monthLabel(previous)
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
 * Destino de la acción principal de una alerta según `accion_detalle`:
 *   budget → /app/presupuestos?mes=<mes>&presupuesto=<id>
 *   transaction | transactions → /app/movimientos?mes=<mes>
 *   otro → null (el llamador usa /app/alertas)
 */
export function alertTarget(alert, fallbackPeriod) {
  const detail = alert?.accion_detalle
  if (!detail) return null
  const mes = [detail.mes, alert?.periodo, fallbackPeriod].find(isValidMonth)
  if (detail.type === 'budget') {
    const params = new URLSearchParams()
    if (mes) params.set('mes', mes)
    if (detail.id !== null && detail.id !== undefined) params.set('presupuesto', String(detail.id))
    return { pathname: '/app/presupuestos', search: `?${params}` }
  }
  if (detail.type === 'transaction' || detail.type === 'transactions') {
    return movementsLink(mes)
  }
  return null
}

// Montos que el backend escribe dentro de textos: 'S/ 1,234.50', '-$ 20.00', '€ 3.00'.
const AMOUNT_IN_TEXT = /-?(?:S\/|US\$|\$|€)\s?\d[\d,]*(?:\.\d+)?/g

/** Oculta los montos de un texto (títulos y descripciones de alertas) cuando "Mostrar montos" está apagado. */
export function maskAmountsInText(text, hidden) {
  if (!hidden || !text) return text
  return String(text).replace(AMOUNT_IN_TEXT, HIDDEN_AMOUNT)
}

const limaDay = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
const limaShortDay = new Intl.DateTimeFormat('es-PE', { timeZone: APP_TIME_ZONE, day: 'numeric', month: 'short' })
const limaTime = new Intl.DateTimeFormat('es-PE', { timeZone: APP_TIME_ZONE, hour: '2-digit', minute: '2-digit' })

/** Fecha de un movimiento en hora de Lima: 'Hoy, 09:30 a. m.', 'Ayer, …' o '24 nov., 11:00 a. m.'. */
export function movementWhen(occurredAt, now = new Date()) {
  const date = occurredAt ? new Date(occurredAt) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  const day = limaDay.format(date)
  const today = limaDay.format(now)
  const yesterday = limaDay.format(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const dayText = day === today ? 'Hoy' : day === yesterday ? 'Ayer' : limaShortDay.format(date)
  return `${dayText}, ${limaTime.format(date)}`
}
