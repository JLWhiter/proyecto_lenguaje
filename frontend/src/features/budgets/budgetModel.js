// Reglas y estilos de Presupuestos (sin React). Los umbrales replican core/budgets.py:
// Normal < 75 % ≤ Precaución < 90 % ≤ Crítico ≤ 100 % < Excedido.

import { toNumber } from '../../lib/format'
import { shiftMonth } from '../../lib/period'

/** Recursos a recargar después de crear, editar, eliminar, copiar o rebalancear. */
export const BUDGET_MUTATION_TAGS = ['budgets', 'alerts', 'dashboard']

/** Parámetro con el que Alertas y el Resumen enlazan a un presupuesto concreto. */
export const HIGHLIGHT_PARAM = 'presupuesto'

/** Acción opcional junto a `?presupuesto=<id>`: `?accion=editar` abre "Editar presupuesto" tras resaltarlo. */
export const ACTION_PARAM = 'accion'
export const EDIT_ACTION = 'editar'

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

/** Cuánto se pasó ya un presupuesto (gastado − límite), en céntimos exactos; 0 si no se pasó. */
export function overspent(budget) {
  const cents = Math.round(toNumber(budget?.gastado) * 100) - Math.round(toNumber(budget?.presupuesto) * 100)
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
  const amount = margin > 0 && need > 0 ? Math.min(need, margin) : 0
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

const DEFAULT_ICON = 'shopping'

const ICON_HINTS = [
  { icon: 'car', pattern: /transp|movilid|taxi|uber|gasolin|combust|auto|carro|pasaje|bus|peaje|estacion/ },
  { icon: 'home', pattern: /vivien|alquil|hogar|casa|depa|servicio|luz|agua|internet|gas|mantenim|hipotec/ },
  { icon: 'gamepad', pattern: /entreten|ocio|cine|juego|stream|suscrip|diversi|salida|viaje|vacacion|musica|hobby/ },
  { icon: 'health', pattern: /salud|farmac|medic|clinic|doctor|gimnas|seguro|dental|cuidado|bienestar/ },
]

/** Ícono sugerido a partir del nombre de la categoría ('Transporte' → 'car'). */
export function guessIcon(category) {
  const key = looseCategoryKey(category)
  if (!key) return DEFAULT_ICON
  const match = ICON_HINTS.find((hint) => hint.pattern.test(key))
  return match ? match.icon : DEFAULT_ICON
}

export const MAX_LIMIT = 9_999_999_999.99
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

/** "1,234.50" / "15,5" / " 900 " → "1234.50" / "15.5" / "900" (texto listo para validar o enviar). */
export function normalizeAmount(raw) {
  let value = String(raw ?? '').replace(/\s/g, '')
  if (value.includes(',') && value.includes('.')) value = value.replaceAll(',', '')
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
  if (!/^\d*(?:\.\d*)?$/.test(value)) return 'Ingresa un número válido, por ejemplo 250.00.'
  if (!AMOUNT_PATTERN.test(value)) return 'Usa como máximo 2 decimales.'
  if (number > MAX_LIMIT) return 'El monto es demasiado grande.'
  return ''
}

/** Reemplaza montos dentro de textos del backend ("S/ 1,234.50", "$ 20.00", "€ 5.00") cuando los saldos están ocultos. */
export function maskAmounts(text, mask = '••••') {
  return String(text ?? '').replace(/-?(?:S\/|US\$|\$|€)\s?\d[\d,]*(?:\.\d+)?/g, mask)
}

/**
 * Cuántos presupuestos del mes anterior se copiarían: los de categorías que aún no existen en este mes
 * (lo mismo que copia el backend). `null` mientras no se conoce el mes anterior.
 */
export function copyableCount(previousItems, items) {
  if (!previousItems) return null
  const current = new Set((items ?? []).map((item) => categoryKey(item.nombre)))
  return previousItems.filter((item) => !current.has(categoryKey(item.nombre))).length
}

/** Por qué "Copiar de <mes anterior>" no tiene nada que copiar, o `null` si sí puede copiar (o aún no se sabe). */
export function copyBlockedReason({ copyable, previousCount, previousLabel, periodLabel }) {
  if (copyable !== 0) return null
  if (previousCount === 0) return `Nada que copiar: ${previousLabel} no tiene presupuestos.`
  return `Nada que copiar: ya tienes en ${periodLabel} todas las categorías de ${previousLabel}.`
}

/** '1 presupuesto' · '3 presupuestos' */
export function budgetsCountText(count) {
  return count === 1 ? '1 presupuesto' : `${count} presupuestos`
}

/** Texto del estado vacío de un mes según lo que tenía el mes anterior (`previousCount` null = aún no se sabe). */
export function emptyMonthDescription(previousCount, previousLabel) {
  if (previousCount > 0) {
    const previousText = budgetsCountText(previousCount)
    return `En ${previousLabel} tenías ${previousText}. Cópialos para empezar con los mismos límites o crea uno nuevo.`
  }
  if (previousCount === 0) return `${previousLabel} tampoco tiene presupuestos. Crea uno por categoría para controlar cuánto gastas.`
  return 'Crea un presupuesto por categoría para controlar cuánto gastas, o copia los del mes anterior.'
}

/** Frase que se añade al aviso de "Copiar de…" cuando se omitieron categorías que ya existían ('' si no se omitió nada). */
export function skippedCopyText(skipped) {
  if (skipped === 0) return ''
  if (skipped === 1) return ' Se omitió 1 que ya existía en este mes.'
  return ` Se omitieron ${skipped} que ya existían en este mes.`
}

// --- Formularios ---------------------------------------------------------------------------

/** Cuerpo para crear un presupuesto a partir de los valores del formulario. */
export function budgetPayload(values) {
  return {
    category: values.category.trim().replace(/\s+/g, ' '),
    limit_amount: normalizeAmount(values.limit_amount),
    icon: values.icon,
    description: values.description.trim(),
  }
}

/** Al editar, solo los campos de `payload` que cambiaron respecto de `budget` (`{}` si nada cambió). */
export function changedBudgetFields(payload, budget) {
  const body = {}
  if (payload.category !== budget.nombre) body.category = payload.category
  if (Number(payload.limit_amount) !== toNumber(budget.presupuesto)) body.limit_amount = payload.limit_amount
  if (payload.icon !== budget.icon) body.icon = payload.icon
  if (payload.description !== (budget.descripcion ?? '')) body.description = payload.description
  return body
}

/** Valores iniciales de "Mover saldo": los de `initial` (si trae monto, se respeta) o los calculados. */
export function initialRebalanceValues(budgets, phase, initial) {
  const base = rebalanceDefaults(budgets, phase, initial ?? {})
  const given = initial?.amount
  const amount = given !== undefined && given !== null && given !== '' ? toNumber(given).toFixed(2) : base.amount
  return { source_category: base.source, target_category: base.target, amount }
}

/** Ayuda bajo el origen del rebalanceo: su margen libre o que ya no tiene. `money` formatea montos. */
export function sourceHintText(source, money) {
  if (!source) return null
  const margin = freeMargin(source)
  if (margin > 0) return `Margen libre: ${money(margin)} (límite ${money(source.presupuesto)}, gastado ${money(source.gastado)}).`
  return `Sin margen libre: ya gastó ${money(source.gastado)} de ${money(source.presupuesto)}.`
}

/**
 * Ayuda bajo el destino: exceso que ya tiene (gastado − límite) y, en el mes en curso, lo que le faltará
 * al ritmo actual (`need`, proyección − límite). Se muestran los dos para que cuadren con la tarjeta y la alerta.
 */
export function targetHintText(target, need, money) {
  if (!target) return null
  const exceeded = overspent(target)
  const spentText = `Gastado ${money(target.gastado)} de ${money(target.presupuesto)}`
  if (exceeded > 0 && need > exceeded) return `${spentText}. Ya se pasó por ${money(exceeded)} · al ritmo actual le faltarán ${money(need)}.`
  if (exceeded > 0) return `${spentText}. Ya se pasó por ${money(exceeded)}.`
  if (need > 0) return `${spentText}. Al ritmo actual le faltarán ${money(need)}.`
  return `${spentText} (${formatPct(target.porcentaje)}).`
}

/** Error del monto a mover cuando supera el margen libre del origen. */
export function overMarginError(source, money) {
  const margin = freeMargin(source)
  if (margin <= 0) return `${source.nombre} no tiene margen libre: ya gastó todo su límite. Elige otro origen.`
  return `${source.nombre} solo tiene ${money(margin)} libres. Ingresa ese monto o uno menor.`
}

/**
 * Montos sugeridos para mover del origen al destino (cubrir el exceso, lo que falta o todo el margen),
 * limitados al margen libre del origen y sin repetidos: [{ key, value: '120.00', label }].
 */
export function suggestedAmounts({ source, target, need, money }) {
  const margin = freeMargin(source)
  if (!source || !target || source.id === target.id || margin <= 0) return []
  const exceeded = overspent(target)
  const picks = []
  const addPick = (key, amount, label) => {
    const value = Math.min(amount, margin).toFixed(2)
    if (picks.some((pick) => pick.value === value)) return
    picks.push({ key, value, label: `${amount > margin ? 'Todo lo posible' : label} (${money(value)})` })
  }
  if (exceeded > 0) addPick('exceeded', exceeded, 'Cubrir el exceso')
  if (need > exceeded) addPick('need', need, exceeded > 0 ? 'Cubrir hasta fin de mes' : 'Cubrir lo que falta')
  if (need < margin) addPick('all', margin, 'Todo el margen')
  return picks
}

/** Query de Movimientos para ver los gastos de una categoría en el período (conserva ?mes=). */
export function movementsSearch(periodSearch, category) {
  const params = new URLSearchParams(periodSearch)
  params.set('categoria', category)
  params.set('tipo', 'GASTO')
  return `?${params.toString()}`
}
