import { firstError } from './validation'

const API_ROOT = import.meta.env.VITE_API_ROOT || '/api/v1'
const CSRF_COOKIE = 'csrftoken'

let csrfToken = null

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
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

export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers['X-CSRFToken'] = await ensureCsrfToken()
  }

  let response
  try {
    response = await fetch(`${API_ROOT}${path}`, {
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

  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const detail =
      firstError(data?.detail) ||
      firstError(data?.non_field_errors) ||
      'No pudimos completar la solicitud. Inténtalo de nuevo.'
    throw new ApiError(detail, response.status, data)
  }

  return data
}

export function fieldErrorsFromApi(error) {
  if (!error?.data || typeof error.data !== 'object') return {}

  const fields = {}
  for (const [key, value] of Object.entries(error.data)) {
    if (key === 'detail' || key === 'non_field_errors') continue
    const message = firstError(value)
    if (message) fields[key] = message
  }
  return fields
}

export function messageFromApi(error, fallback = 'Ocurrió un error inesperado. Inténtalo de nuevo.') {
  if (error?.message) return error.message
  return fallback
}
