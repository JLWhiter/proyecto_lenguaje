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

/** formatPercent(81.25) → '81.25%' (recibe el valor ya en escala 0–100). */
export function formatPercent(value, { digits = 2 } = {}) {
  return `${toNumber(value).toFixed(digits)}%`
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

/** '25 de noviembre de 2026' */
export function formatDate(value, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return formatWith(value, options)
}

/** '25 nov. 2026' */
export function formatShortDate(value) {
  return formatWith(value, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** '11:28 a. m.' */
export function formatTime(value) {
  return formatWith(value, { hour: '2-digit', minute: '2-digit' })
}

/** '25 nov. 2026, 11:28 a. m.' */
export function formatDateTime(value) {
  return formatWith(value, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Iniciales para avatares: 'María Fernanda López' → 'ML'; sin nombre usa el correo. */
export function initialsOf(fullName, fallback = '') {
  const words = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return (String(fallback).trim()[0] || '?').toUpperCase()
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return `${first}${last}`.toUpperCase()
}
