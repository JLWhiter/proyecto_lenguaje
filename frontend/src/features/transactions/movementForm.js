// Lógica pura del formulario de movimientos (MovementFormDialog): campos, valores y validación.
import { isEmptyValue } from '../../components/ui/formModel'
import { formatDay, isValidDate } from './dates'

/** `fields` puede ser un arreglo o una función `(values) => fields` (campos que dependen de otros). */
export function resolveFields(fields, values) {
  return typeof fields === 'function' ? fields(values) : fields
}

/** Valores iniciales como texto; select y segmented sin valor toman su primera opción. */
export function initialMovementValues(fields, initialValues) {
  const values = Object.fromEntries(Object.entries(initialValues).map(([key, value]) => [key, value == null ? '' : String(value)]))
  for (const field of fields) {
    if (values[field.name] !== undefined && values[field.name] !== '') continue
    if (field.type === 'select' || field.type === 'segmented') values[field.name] = field.options?.[0]?.[0] ?? ''
    else values[field.name] = values[field.name] ?? ''
  }
  return values
}

/** Recorta textos; los montos aceptan coma decimal ("15,50" → "15.50"). */
export function cleanMovementValues(fields, values) {
  const result = {}
  for (const field of fields) {
    const raw = values[field.name]
    let value = typeof raw === 'string' ? raw.trim() : raw ?? ''
    if (field.type === 'number' && value) value = value.replace(/\s/g, '').replace(',', '.')
    result[field.name] = value
  }
  return result
}

const REQUIRED_MESSAGES = { select: 'Selecciona una opción.', date: 'Elige una fecha.' }
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

function requiredMessage(field) {
  return field.requiredMessage || REQUIRED_MESSAGES[field.type] || 'Este campo es obligatorio.'
}

function amountError(field, value) {
  const number = Number(value)
  if (!AMOUNT_PATTERN.test(value) || !Number.isFinite(number)) return 'Ingresa un monto válido, con hasta 2 decimales (ej. 15.50).'
  if (field.min !== undefined && number < Number(field.min)) return 'Ingresa un monto mayor a 0.'
  return null
}

function dateError(field, value) {
  if (!isValidDate(value)) return 'Ingresa una fecha válida.'
  if (field.max && value > field.max) return 'La fecha no puede ser posterior a hoy.'
  if (field.min && value < field.min) return `La fecha no puede ser anterior al ${formatDay(field.min)}.`
  return null
}

const TYPE_CHECKS = { number: amountError, date: dateError }

/** Error de un campo ya limpio (o `null`). El largo máximo tiene prioridad sobre el formato. */
function movementFieldError(field, value) {
  if (field.required && isEmptyValue(value)) return requiredMessage(field)
  if (value === '') return null
  if (field.maxLength && value.length > field.maxLength) return `Máximo ${field.maxLength} caracteres.`
  return TYPE_CHECKS[field.type]?.(field, value) ?? null
}

/** `{ campo: 'mensaje' }` con los errores de los valores ya limpios (`cleanMovementValues`). */
export function validateMovementFields(fields, values) {
  const errors = {}
  for (const field of fields) {
    const message = movementFieldError(field, values[field.name])
    if (message) errors[field.name] = message
  }
  return errors
}
