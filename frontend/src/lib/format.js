// Formateo de dinero, porcentajes y fechas. Locale es-PE, zona horaria America/Lima.
// En componentes usa el hook `useMoney()` (lee la moneda del usuario); estas funciones puras
// sirven fuera de React o cuando ya conoces la moneda.

import { APP_TIME_ZONE } from './period'

export const DEFAULT_CURRENCY = 'PEN'
const LOCALE = 'es-PE'

const moneyFormatters = new Map()

function moneyFormatter(currency, signDisplay = 'auto') {
  const key = `${currency}|${signDisplay}`
  if (!moneyFormatters.has(key)) {
    let formatter
    try {
      formatter = new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        signDisplay,
      })
    } catch {
      formatter = new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: DEFAULT_CURRENCY,
        currencyDisplay: 'narrowSymbol',
        signDisplay,
      })
    }
    moneyFormatters.set(key, formatter)
  }
  return moneyFormatters.get(key)
}

/** Convierte números o strings decimales del backend ("8450.00") a número. */
export function toNumber(value) {
  const number = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(number) ? number + 0 : 0
}

/** formatMoney(-20, 'PEN') → '-S/ 20.00' · formatMoney(1234.5, 'USD') → '$ 1,234.50' */
export function formatMoney(value, currency = DEFAULT_CURRENCY) {
  return moneyFormatter(currency || DEFAULT_CURRENCY).format(toNumber(value))
}

/** Con signo explícito: '+S/ 20.00' / '-S/ 20.00' / 'S/ 0.00'. */
export function formatSignedMoney(value, currency = DEFAULT_CURRENCY) {
  return moneyFormatter(currency || DEFAULT_CURRENCY, 'exceptZero').format(toNumber(value))
}

/** Símbolo de la moneda: 'S/', '$', '€'. */
export function currencySymbol(currency = DEFAULT_CURRENCY) {
  const part = moneyFormatter(currency || DEFAULT_CURRENCY)
    .formatToParts(1)
    .find((item) => item.type === 'currency')
  return part ? part.value : currency
}

const numberFormatters = new Map()

/**
 * Número con separador de miles es-PE: formatNumber(1292.63, { digits: 1 }) → '1,292.6'.
 * `minDigits` menor que `digits` quita los ceros sobrantes (75 → '75', 82.5 → '82.5').
 */
export function formatNumber(value, { digits = 2, minDigits = digits } = {}) {
  const key = `${minDigits}|${digits}`
  if (!numberFormatters.has(key)) {
    numberFormatters.set(key, new Intl.NumberFormat(LOCALE, { minimumFractionDigits: minDigits, maximumFractionDigits: digits }))
  }
  return numberFormatters.get(key).format(toNumber(value))
}

/** formatPercent(81.25) → '81.25%' · formatPercent(1292.63, { digits: 1 }) → '1,292.6%' (valor ya en escala 0–100). */
export function formatPercent(value, { digits = 2, minDigits = digits } = {}) {
  return `${formatNumber(value, { digits, minDigits })}%`
}

// --- Montos ocultos ("Ocultar montos") -------------------------------------------------------

/** Lo que se muestra en lugar de un monto cuando el usuario ocultó los montos. */
export const HIDDEN_AMOUNT = '••••'
/** Texto para lectores de pantalla en lugar de un monto oculto. */
export const HIDDEN_AMOUNT_LABEL = 'Monto oculto'

// Montos que el backend escribe dentro de textos: 'S/ 1,234.50', '-$ 20.00', '€ 3.00', '+S/ 5.00'.
const AMOUNT_IN_TEXT = /[-+]?(?:S\/|US\$|\$|€)\s?\d[\d,]*(?:\.\d+)?/g

/** Oculta los montos de un texto (títulos y descripciones de alertas, avisos) cuando `hidden` es true. */
export function maskAmountsInText(text, hidden) {
  if (!hidden || !text) return text
  return String(text).replace(AMOUNT_IN_TEXT, HIDDEN_AMOUNT)
}

/** Igual que `maskAmountsInText`, pero para lectores de pantalla: 'monto oculto' en lugar de '••••'. */
export function speakAmountsInText(text, hidden) {
  if (!hidden || !text) return text
  return String(text).replace(AMOUNT_IN_TEXT, HIDDEN_AMOUNT_LABEL.toLocaleLowerCase('es'))
}

function toDate(value) {
  if (value instanceof Date) return value
  if (value === null || value === undefined || value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatWith(value, options) {
  const date = toDate(value)
  if (!date) return ''
  return new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIME_ZONE, ...options }).format(date)
}

const LONG_DATE = { day: 'numeric', month: 'long', year: 'numeric' }

/** '25 de noviembre de 2026' */
export function formatDate(value, options = LONG_DATE) {
  return formatWith(value, options)
}

/** '25 nov. 2026' */
export function formatShortDate(value) {
  return formatWith(value, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Horas siempre en formato de 24 horas ('18:30'), igual que las que envía el backend en Movimientos.
const TIME_OPTIONS = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }

/** '18:30' */
export function formatTime(value) {
  return formatWith(value, TIME_OPTIONS)
}

/** '25 nov. 2026, 18:30' */
export function formatDateTime(value) {
  return formatWith(value, { day: 'numeric', month: 'short', year: 'numeric', ...TIME_OPTIONS })
}

/** Iniciales para avatares: 'María Fernanda López' → 'ML'; sin nombre usa el correo. */
export function initialsOf(fullName, fallback = '') {
  const words = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return (String(fallback).trim()[0] || '?').toUpperCase()
  const first = words[0][0]
  const last = words.length > 1 ? words.at(-1)[0] : ''
  return `${first}${last}`.toUpperCase()
}
