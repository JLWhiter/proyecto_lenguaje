// Reglas y estilos de Presupuestos (sin React). Los umbrales replican core/budgets.py:
// Normal < 75 % ≤ Precaución < 90 % ≤ Crítico ≤ 100 % < Excedido.

import { toNumber } from '../../lib/format'
import { shiftMonth } from '../../lib/period'

/** Recursos a recargar después de crear, editar, eliminar, copiar o rebalancear. */
export const BUDGET_MUTATION_TAGS = ['budgets', 'alerts', 'dashboard']

/** Parámetro con el que Alertas y el Resumen enlazan a un presupuesto concreto. */
export const HIGHLIGHT_PARAM = 'presupuesto'

/** Hasta cuántos meses hacia adelante se puede planificar desde esta pantalla. */
export const PLANNING_MONTHS_AHEAD = 1

export const FILTER_ALL = 'all'

export const BUDGET_STATES = [
  { key: 'Normal', label: 'Normal', tone: 'green' },
  { key: 'Precaución', label: 'Precaución', tone: 'amber' },
  { key: 'Crítico', label: 'Crítico', tone: 'red' },
  { key: 'Excedido', label: 'Excedido', tone: 'red' },
]

const STATE_BY_KEY = Object.fromEntries(BUDGET_STATES.map((state) => [state.key, state]))

/** Estilos por estado. `Excedido` usa un rojo más intenso que `Crítico`. */
export const STATE_STYLES = {
  Normal: {
    tile: 'bg-emerald-50 text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-800',
    text: 'text-emerald-700',
    bar: 'bg-emerald-500',
    track: 'bg-emerald-100',
    dot: 'bg-emerald-500',
  },
  Precaución: {
    tile: 'bg-amber-50 text-amber-600',
    badge: 'bg-amber-100 text-amber-800',
    text: 'text-amber-700',
    bar: 'bg-amber-500',
    track: 'bg-amber-100',
    dot: 'bg-amber-500',
  },
  Crítico: {
    tile: 'bg-red-50 text-red-600',
    badge: 'bg-red-100 text-red-700',
    text: 'text-red-600',
    bar: 'bg-red-500',
    track: 'bg-red-100',
    dot: 'bg-red-500',
  },
  Excedido: {
    tile: 'bg-red-100 text-red-700',
    badge: 'bg-red-600 text-white',
    text: 'text-red-700',
    bar: 'bg-red-600',
    track: 'bg-red-100',
    dot: 'bg-red-600',
  },
}

const COLOR_TO_STATE = { green: 'Normal', amber: 'Precaución', red: 'Crítico' }

/** Estado del backend (`estado`), con respaldo en `color` o en el porcentaje. */
export function stateOf(budget) {
  if (STATE_BY_KEY[budget?.estado]) return budget.estado
  if (COLOR_TO_STATE[budget?.color]) return COLOR_TO_STATE[budget.color]
  return stateForPercentage(budget?.porcentaje)
}

export function stateForPercentage(percentage) {
  const value = toNumber(percentage)
  if (value > 100) return 'Excedido'
  if (value >= 90) return 'Crítico'
  if (value >= 75) return 'Precaución'
  return 'Normal'
}

export function stylesFor(state) {
  return STATE_STYLES[state] ?? STATE_STYLES.Normal
}

/** Texto del resumen general según el porcentaje consumido. */
export const SUMMARY_STATE_LABEL = {
  Normal: 'En control',
  Precaución: 'Precaución',
  Crítico: 'Cerca del límite',
  Excedido: 'Excedido',
}

/** 'past' | 'current' | 'future' respecto del mes actual (America/Lima). */
export function periodPhase(period, current) {
  if (period < current) return 'past'
  if (period > current) return 'future'
  return 'current'
}

export function lastPlannableMonth(current) {
  return shiftMonth(current, PLANNING_MONTHS_AHEAD)
}

/** 72 → '72%' · 83.25 → '83.3%' */
export function formatPct(value) {
  return `${toNumber(value).toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`
}

/** Lo que aún se puede mover del límite (límite − gastado, nunca negativo), en céntimos exactos. */
export function freeMargin(budget) {
  const cents = Math.round(toNumber(budget?.presupuesto) * 100) - Math.round(toNumber(budget?.gastado) * 100)
  return Math.max(0, cents) / 100
}

/** Cuánto le falta a un presupuesto: exceso actual o, en el mes en curso, el exceso proyectado. */
export function shortfall(budget, phase) {
  const limit = toNumber(budget?.presupuesto)
  const spent = toNumber(budget?.gastado)
  const projected = phase === 'current' ? toNumber(budget?.proyeccion) : spent
  return Math.max(0, roundCents(Math.max(spent, projected) - limit))
}

function roundCents(value) {
  return Math.round(value * 100) / 100
}

/**
 * Valores iniciales del rebalanceo calculados con datos reales:
 * - origen: el presupuesto con más margen libre;
 * - destino: el más comprometido (mayor % consumido, luego mayor exceso proyectado);
 * - monto: lo que le falta al destino, limitado al margen del origen.
 * `prefer.source` / `prefer.target` fijan uno de los dos (p. ej. desde el menú de una tarjeta).
 */
export function rebalanceDefaults(budgets, phase, prefer = {}) {
  const list = budgets ?? []
  if (list.length < 2) return { source: list[0]?.nombre ?? '', target: '', amount: '' }

  const byMargin = [...list].sort((a, b) => freeMargin(b) - freeMargin(a))
  const byPressure = [...list].sort(
    (a, b) => toNumber(b.porcentaje) - toNumber(a.porcentaje) || shortfall(b, phase) - shortfall(a, phase),
  )

  let source = list.find((item) => item.nombre === prefer.source) ?? null
  let target = list.find((item) => item.nombre === prefer.target) ?? null
  if (!source) source = byMargin.find((item) => item !== target) ?? null
  if (!target) target = byPressure.find((item) => item !== source) ?? null

  const margin = freeMargin(source)
  const need = shortfall(target, phase)
  const amount = margin > 0 ? (need > 0 ? Math.min(need, margin) : 0) : 0
  return { source: source?.nombre ?? '', target: target?.nombre ?? '', amount: amount > 0 ? amount.toFixed(2) : '' }
}

/** Clave para comparar categorías como el backend: sin espacios repetidos y sin distinguir mayúsculas. */
export function categoryKey(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es')
}

/** Igual que `categoryKey` pero ignorando tildes (para sugerir "¿quisiste decir…?"). */
export function looseCategoryKey(value) {
  return categoryKey(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Íconos que acepta el backend para un presupuesto. */
export const BUDGET_ICONS = [
  { value: 'shopping', label: 'Compras' },
  { value: 'car', label: 'Transporte' },
  { value: 'home', label: 'Hogar' },
  { value: 'gamepad', label: 'Ocio' },
  { value: 'health', label: 'Salud' },
]

const ICON_HINTS = [
  ['car', /transp|movilid|taxi|uber|gasolin|combust|auto|carro|pasaje|bus|peaje|estacion/],
  ['home', /vivien|alquil|hogar|casa|depa|servicio|luz|agua|internet|gas|mantenim|hipotec/],
  ['gamepad', /entreten|ocio|cine|juego|stream|suscrip|diversi|salida|viaje|vacacion|musica|hobby/],
  ['health', /salud|farmac|medic|clinic|doctor|gimnas|seguro|dental|cuidado|bienestar/],
]

/** Ícono sugerido a partir del nombre de la categoría ('Transporte' → 'car'). */
export function guessIcon(category) {
  const key = looseCategoryKey(category)
  if (!key) return 'shopping'
  const match = ICON_HINTS.find(([, pattern]) => pattern.test(key))
  return match ? match[0] : 'shopping'
}

export const MAX_LIMIT = 9_999_999_999.99
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

/** "1,234.50" / "15,5" / " 900 " → "1234.50" / "15.5" / "900" (texto listo para validar o enviar). */
export function normalizeAmount(raw) {
  let value = String(raw ?? '').replace(/\s/g, '')
  if (value.includes(',') && value.includes('.')) value = value.replace(/,/g, '')
  else value = value.replace(',', '.')
  return value
}

/** Mensaje de error de un monto > 0 con hasta 2 decimales, o '' si es válido. */
export function amountError(raw, { label = 'el monto' } = {}) {
  const value = normalizeAmount(raw)
  if (!value) return `Ingresa ${label}.`
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Ingresa un número válido, por ejemplo 250.00.'
  if (number <= 0) return 'Ingresa un monto mayor a 0.'
  if (!/^\d*\.?\d*$/.test(value)) return 'Ingresa un número válido, por ejemplo 250.00.'
  if (!AMOUNT_PATTERN.test(value)) return 'Usa como máximo 2 decimales.'
  if (number > MAX_LIMIT) return 'El monto es demasiado grande.'
  return ''
}

/** Reemplaza montos dentro de textos del backend ("S/ 1,234.50", "$ 20.00", "€ 5.00") cuando los saldos están ocultos. */
export function maskAmounts(text, mask = '••••') {
  return String(text ?? '').replace(/-?(?:S\/|US\$|\$|€)\s?\d[\d,]*(?:\.\d+)?/g, mask)
}

/** Query de Movimientos para ver los gastos de una categoría en el período (conserva ?mes=). */
export function movementsSearch(periodSearch, category) {
  const params = new URLSearchParams(periodSearch)
  params.set('categoria', category)
  params.set('tipo', 'GASTO')
  return `?${params.toString()}`
}
