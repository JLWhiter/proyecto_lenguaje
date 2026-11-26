// Lógica pura de los formularios en diálogo (FormDialog y el de Movimientos): valores iniciales,
// validación en el cliente y reparto de los errores que devuelve la API.

const GENERIC_ERROR = 'No se pudo completar la operación.'

export function isEmptyValue(value) {
  return value === '' || value === undefined || value === null
}

/** Valores iniciales como texto; un select sin valor toma su primera opción. */
export function initialFormValues(fields, initialValues = {}) {
  const values = {}
  for (const field of fields) {
    const provided = initialValues[field.name]
    if (provided !== undefined && provided !== null) {
      values[field.name] = String(provided)
    } else if (field.type === 'select') {
      values[field.name] = field.options?.[0]?.[0] ?? ''
    } else {
      values[field.name] = ''
    }
  }
  return values
}

function minAmountMessage(field) {
  if (field.minMessage) return field.minMessage
  return Number(field.min) > 0 ? 'Ingresa un monto mayor a 0.' : 'El monto no puede ser negativo.'
}

function numberError(field, value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Ingresa un número válido.'
  if (field.min !== undefined && number < Number(field.min)) return minAmountMessage(field)
  return null
}

function fieldError(field, raw) {
  const value = typeof raw === 'string' ? raw.trim() : raw
  if (field.required && isEmptyValue(value)) {
    return field.type === 'select' ? 'Selecciona una opción.' : 'Este campo es obligatorio.'
  }
  if (field.type === 'number' && value !== '') return numberError(field, value)
  return null
}

/** Reglas de `FormDialog`: `required` y, en números, que sea válido y respete `min`. → `{ campo: 'mensaje' }` */
export function validateFormFields(fields, values) {
  const errors = {}
  for (const field of fields) {
    const message = fieldError(field, values[field.name])
    if (message) errors[field.name] = message
  }
  return errors
}

/** Recorta textos y omite opcionales vacíos (el backend aplica sus valores por defecto). */
export function cleanFormValues(fields, values) {
  const result = {}
  for (const field of fields) {
    const raw = values[field.name]
    const value = typeof raw === 'string' ? raw.trim() : raw
    if (value === '' && !field.required && field.type !== 'text') continue
    result[field.name] = value
  }
  return result
}

/**
 * Reparte los errores de un ApiError entre los campos del formulario:
 * - `fieldErrors`: los de campos presentes (se muestran bajo cada input).
 * - `formError`: los de campos que no están en el formulario o, si no hay ninguno por campo,
 *   el mensaje general del error (se muestra arriba de los botones).
 */
export function splitServerErrors(fields, error) {
  const names = new Set(fields.map((field) => field.name))
  const fieldErrors = {}
  const others = []
  for (const [key, message] of Object.entries(error?.fieldErrors || {})) {
    if (names.has(key)) fieldErrors[key] = message
    else others.push(message)
  }
  return { fieldErrors, formError: generalError(others, fieldErrors, error) }
}

function generalError(others, fieldErrors, error) {
  if (others.length > 0) return others.join(' ')
  if (Object.keys(fieldErrors).length > 0) return ''
  return error?.message || GENERIC_ERROR
}

/** Primer campo (en el orden del formulario) que tiene error, o `undefined`. */
export function firstFieldWithError(fields, fieldErrors) {
  return fields.find((field) => fieldErrors[field.name])
}
