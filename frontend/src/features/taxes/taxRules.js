// Reglas del Impuesto a la Renta de quinta categoría que la pantalla necesita para explicar el cálculo.
// El cálculo real lo hace el backend (backend/core/taxes.py); aquí solo están los datos para
// mostrar los tramos no alcanzados, el tope de deducciones antes de la respuesta y los textos.

import { formatMoney, toNumber } from '../../lib/format'
import { currentMonth } from '../../lib/period'

/** UIT por año (mismo valor que `UIT_BY_YEAR` del backend). La respuesta de la API manda si difiere. */
export const UIT_BY_YEAR = { 2023: 4950, 2024: 5150, 2025: 5350, 2026: 5500 }

export const TAX_YEARS = Object.keys(UIT_BY_YEAR)
  .map(Number)
  .sort((a, b) => b - a)

/** Año por defecto: el actual (hora de Lima) si tiene UIT; si no, el último registrado. */
export const DEFAULT_YEAR = (() => {
  const year = Number(currentMonth().slice(0, 4))
  return UIT_BY_YEAR[year] ? year : TAX_YEARS[0]
})()

export const FIXED_DEDUCTION_UIT = 7
export const MAX_ADDITIONAL_DEDUCTION_UIT = 3

/**
 * Escala progresiva acumulativa (art. 53 LIR), en UIT. `to: null` = sin tope.
 * `color` codifica la tasa con un solo tono (claro → oscuro) y se usa en la escala y en la tabla.
 */
export const BRACKETS = [
  { from: 0, to: 5, rate: 8, color: 'bg-emerald-300' },
  { from: 5, to: 20, rate: 14, color: 'bg-emerald-400' },
  { from: 20, to: 35, rate: 17, color: 'bg-emerald-500' },
  { from: 35, to: 45, rate: 20, color: 'bg-emerald-600' },
  { from: 45, to: null, rate: 30, color: 'bg-emerald-700' },
]

/** Ancho visual (en UIT) del último tramo, que no tiene tope, dentro de la escala gráfica. */
export const LAST_BRACKET_VISUAL_UIT = 15

/** Todos los montos de esta pantalla están en soles, sin importar la moneda del usuario. */
export function soles(value) {
  return formatMoney(value, 'PEN')
}

/** '4.21' → para mostrar cantidades de UIT con hasta 2 decimales. */
export function formatUit(value) {
  const number = toNumber(value)
  return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 }).format(number)
}

const MAX_INTEGER_DIGITS = 12 // DecimalField(max_digits=14, decimal_places=2)

/**
 * Interpreta un monto escrito por el usuario: '60000', '60,000.50', 'S/ 1,200'.
 *   → { empty: true } | { error: 'mensaje' } | { value: 60000.5, text: '60000.5' }
 */
export function parseAmount(input) {
  const raw = String(input ?? '')
    .trim()
    .replace(/^S\/\.?/i, '')
    .replace(/[\s,]/g, '')
  if (raw === '') return { empty: true, value: null }
  if (raw.startsWith('-')) return { error: 'El monto no puede ser negativo.', value: null }
  if (!/^\d*\.?\d*$/.test(raw) || raw === '.') return { error: 'Ingresa solo números, por ejemplo 60000 o 60,000.50.', value: null }
  const [integer, decimals = ''] = raw.split('.')
  if (decimals.length > 2) return { error: 'Usa como máximo 2 decimales.', value: null }
  if (integer.replace(/^0+/, '').length > MAX_INTEGER_DIGITS) return { error: 'El monto es demasiado grande.', value: null }
  const value = Number(raw)
  return { value, text: String(value) }
}

/** ¿Dos textos representan el mismo monto? ('60,000' y '60000' sí; '' y '' sí). */
export function sameAmount(a, b) {
  const left = parseAmount(a)
  const right = parseAmount(b)
  if (left.empty || right.empty) return Boolean(left.empty && right.empty)
  if (left.error || right.error) return String(a ?? '').trim() === String(b ?? '').trim()
  return left.value === right.value
}

/** '?anio=2025' → 2025; valores no numéricos → null (se usa el año por defecto). */
export function parseYear(value) {
  return /^\d{4}$/.test(String(value ?? '')) ? Number(value) : null
}

/**
 * Los cinco tramos, alcanzados o no, combinando la escala local con `tramos` de la API.
 * `fill` (0–1) es cuánto del tramo ocupa la renta neta; en el último tramo es 1 si se alcanzó.
 */
export function buildBrackets(result) {
  const uit = toNumber(result.uit)
  const apiBrackets = result.tramos ?? []
  return BRACKETS.map((bracket, index) => {
    const api = apiBrackets[index]
    const desde = api ? toNumber(api.desde) : bracket.from * uit
    const hasta = api ? (api.hasta === null || api.hasta === undefined ? null : toNumber(api.hasta)) : bracket.to === null ? null : bracket.to * uit
    const base = api ? toNumber(api.base) : 0
    const size = hasta === null ? null : hasta - desde
    return {
      ...bracket,
      number: index + 1,
      desde,
      hasta,
      tasa: api ? toNumber(api.tasa) : bracket.rate,
      base,
      impuesto: api ? toNumber(api.impuesto) : 0,
      reached: base > 0,
      fill: base <= 0 ? 0 : size ? Math.min(1, base / size) : 1,
    }
  })
}

/** Separa la deducción total de la API en la fija (7 UIT, limitada al ingreso) y la adicional. */
export function splitDeductions(result) {
  const uit = toNumber(result.uit)
  const gross = toNumber(result.ingreso_bruto)
  const total = toNumber(result.deducciones)
  const fixedLimit = FIXED_DEDUCTION_UIT * uit
  const fixed = Math.min(fixedLimit, gross)
  const additional = Math.max(0, Math.round((total - fixed) * 100) / 100)
  return { fixed, fixedLimit, fixedCapped: gross < fixedLimit, additional, additionalLimit: MAX_ADDITIONAL_DEDUCTION_UIT * uit }
}
