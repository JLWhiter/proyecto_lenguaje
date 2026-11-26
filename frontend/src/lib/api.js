import { firstError } from './validation'

const API_ROOT = import.meta.env.VITE_API_ROOT || '/api/v1'
const CSRF_COOKIE = 'csrftoken'

// Rutas donde un 401 significa "credenciales incorrectas", no "sesión expirada".
const AUTH_ATTEMPT_PATHS = new Set(['/auth/login/', '/auth/register/'])
// Métodos que no modifican datos: no necesitan el token CSRF.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

let csrfToken = null
let unauthorizedHandler = null

/**
 * Error de la API. Además del mensaje general expone `fieldErrors`
 * (`{ campo: 'primer mensaje' }`) para mostrar cada error bajo su input.
 */
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.fieldErrors = extractFieldErrors(data)
  }
}

function extractFieldErrors(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  const fields = {}
  for (const [key, value] of Object.entries(data)) {
    if (key === 'detail' || key === 'non_field_errors') continue
    const message = firstError(value)
    if (message) fields[key] = message
  }
  return fields
}

/**
 * Registra la función que se ejecuta cuando el backend responde 401
 * (sesión expirada o cerrada en otro lado). AuthContext la usa para limpiar al usuario.
 * Devuelve una función para desregistrarla.
 */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null
  }
}

function readCookie(name) {
  const match = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null
}

export function setCsrfToken(token) {
  if (token) csrfToken = token
}

export function resetCsrfToken() {
  csrfToken = null
}

async function ensureCsrfToken() {
  const cookieToken = readCookie(CSRF_COOKIE)
  if (cookieToken) {
    csrfToken = cookieToken
    return cookieToken
  }
  if (csrfToken) return csrfToken

  const response = await fetch(`${API_ROOT}/auth/csrf/`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.csrfToken) {
    throw new ApiError('No pudimos iniciar una sesión segura. Recarga la página.', response.status, data)
  }
  csrfToken = data.csrfToken
  return csrfToken
}

/** Convierte `{ mes: '2026-11', vacio: '' }` en `?mes=2026-11` (omite valores vacíos). */
export function toQuery(params = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

function acceptHeader(accept, responseType) {
  if (accept) return accept
  return responseType === 'blob' ? '*/*' : 'application/json'
}

async function requestHeaders({ method, body, responseType, accept }) {
  const headers = { Accept: acceptHeader(accept, responseType) }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (!SAFE_METHODS.has(method)) headers['X-CSRFToken'] = await ensureCsrfToken()
  return headers
}

/** `fetch` a la API; un fallo de red se convierte en ApiError (status 0). Las cancelaciones se propagan tal cual. */
async function send(path, { method, body, signal, headers }) {
  try {
    return await fetch(`${API_ROOT}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError('No pudimos conectar con el servidor. Verifica que Django esté en ejecución.', 0, null)
  }
}

function parseJson(text) {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function statusMessage(status) {
  if (status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.'
  if (status >= 500) return 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.'
  return 'No pudimos completar la solicitud. Inténtalo de nuevo.'
}

/** Mensaje principal de una respuesta con error: `detail`, `non_field_errors`, el primer error de campo o uno según el status. */
export function errorMessageFrom(status, data) {
  return (
    firstError(data?.detail) ||
    firstError(data?.non_field_errors) ||
    Object.values(extractFieldErrors(data))[0] ||
    statusMessage(status)
  )
}

/** Un 401 fuera del login/registro significa sesión expirada o cerrada: se avisa a AuthContext. */
function notifyUnauthorized(path, status) {
  if (status === 401 && !AUTH_ATTEMPT_PATHS.has(path) && unauthorizedHandler) unauthorizedHandler()
}

/**
 * Petición a la API de Django.
 * @param {string} path  Ruta relativa a /api/v1 (ej. '/cuentas/').
 * @param {{ method?: string, body?: unknown, signal?: AbortSignal, responseType?: 'json' | 'blob', accept?: string }} options
 */
export async function apiRequest(path, { method = 'GET', body, signal, responseType = 'json', accept } = {}) {
  const headers = await requestHeaders({ method, body, responseType, accept })
  const response = await send(path, { method, body, signal, headers })

  if (response.ok && responseType === 'blob') {
    return response.blob()
  }

  const data = parseJson(await response.text())
  if (!response.ok) {
    notifyUnauthorized(path, response.status)
    throw new ApiError(errorMessageFrom(response.status, data), response.status, data)
  }
  return data
}

export function fieldErrorsFromApi(error) {
  if (error?.fieldErrors) return error.fieldErrors
  return extractFieldErrors(error?.data)
}

export function messageFromApi(error, fallback = 'Ocurrió un error inesperado. Inténtalo de nuevo.') {
  if (error?.message) return error.message
  return fallback
}

export function isAbortError(error) {
  return error?.name === 'AbortError'
}
