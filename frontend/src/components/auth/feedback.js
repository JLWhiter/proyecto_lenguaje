import { messageFromApi } from '../../lib/api'
import { firstError } from '../../lib/validation'

/**
 * Mensaje general de un error de la API listo para <Alert>.
 * 429 (demasiados intentos) se muestra en ámbar con el `detail` del backend, que ya indica cuánto esperar.
 *   const feedback = feedbackFromError(error, 'No pudimos…')  →  { tone: 'warning' | 'error', title, message }
 */
export function feedbackFromError(error, fallback) {
  const throttled = error?.status === 429
  return {
    tone: throttled ? 'warning' : 'error',
    title: throttled ? 'Espera un momento' : null,
    message: messageFromApi(error, fallback),
  }
}

/**
 * Todos los mensajes de un campo (los validadores de contraseña pueden devolver varios:
 * "demasiado común", "completamente numérica"…). Sin datos usa `fieldErrors` (primer mensaje).
 */
export function fieldMessages(error, field) {
  const raw = error?.data?.[field]
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean).join(' ')
  return firstError(raw) || error?.fieldErrors?.[field] || ''
}

/** `{ campo: 'todos los mensajes' }` para cada campo con error de un ApiError. */
export function allFieldMessages(error) {
  const result = {}
  for (const field of Object.keys(error?.fieldErrors || {})) {
    result[field] = fieldMessages(error, field)
  }
  return result
}
