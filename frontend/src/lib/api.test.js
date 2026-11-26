// Pruebas del cliente de la API: mensajes de error, 401 (sesión expirada) y fallos de red.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, errorMessageFrom, setUnauthorizedHandler, toQuery } from './api'

function fakeResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, text: async () => body, blob: async () => body }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('errorMessageFrom', () => {
  it('prefiere detail, luego non_field_errors y luego el primer error de campo', () => {
    expect(errorMessageFrom(400, { detail: 'No encontrado.' })).toBe('No encontrado.')
    expect(errorMessageFrom(400, { non_field_errors: ['Datos inválidos.'] })).toBe('Datos inválidos.')
    expect(errorMessageFrom(400, { nombre: ['Ya existe.'] })).toBe('Ya existe.')
  })

  it('sin cuerpo usa un mensaje según el status', () => {
    expect(errorMessageFrom(401, null)).toBe('Tu sesión expiró. Inicia sesión nuevamente.')
    expect(errorMessageFrom(503, null)).toBe('El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.')
    expect(errorMessageFrom(404, 'texto')).toBe('No pudimos completar la solicitud. Inténtalo de nuevo.')
  })
})

describe('apiRequest (GET)', () => {
  it('devuelve el JSON de la respuesta (o null si está vacía)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(200, '{"ok":true}')))
    await expect(apiRequest('/cuentas/')).resolves.toEqual({ ok: true })
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(200, '')))
    await expect(apiRequest('/cuentas/')).resolves.toBeNull()
  })

  it('un 401 avisa de la sesión expirada salvo en login/registro', async () => {
    const handler = vi.fn()
    const unregister = setUnauthorizedHandler(handler)
    vi.stubGlobal('fetch', vi.fn(async () => fakeResponse(401, '{"detail":"Sin sesión."}')))
    await expect(apiRequest('/cuentas/')).rejects.toMatchObject({ status: 401, message: 'Sin sesión.' })
    await expect(apiRequest('/auth/login/')).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledTimes(1)
    unregister()
  })

  it('un fallo de red es un ApiError con status 0; una cancelación se propaga', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    await expect(apiRequest('/cuentas/')).rejects.toMatchObject({ name: 'ApiError', status: 0 })
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(abort)))
    await expect(apiRequest('/cuentas/')).rejects.toBe(abort)
  })
})

describe('toQuery', () => {
  it('omite valores vacíos', () => {
    expect(toQuery({ mes: '2026-11', tipo: '', cuenta_id: null, page: 2 })).toBe('?mes=2026-11&page=2')
    expect(toQuery({})).toBe('')
  })
})
