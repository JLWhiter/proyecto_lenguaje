import { ApiError, apiRequest, toQuery } from '../api.js'
import { filenameFromDisposition } from '../download.js'

const API_ROOT = import.meta.env.VITE_API_ROOT || '/api/v1'

/** Filtros que entiende el backend (listado y exportación). Los vacíos se omiten de la URL. */
function filterQuery({ mes, search, tipo, categoria, cuenta_id: cuentaId } = {}) {
  return { mes, search, tipo, categoria, cuenta_id: cuentaId }
}

export const XLSX_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const ACCEPT_BY_FORMAT = { xlsx: XLSX_MEDIA_TYPE, csv: 'text/csv' }
const DETAIL_KEYS = new Set(['detail', 'non_field_errors'])
const CSV_ERROR_HEADER = 'campo,mensaje'
const MARKUP_START = /^[<{[]/

/**
 * Parámetros de `/transacciones/exportar/`: los filtros del listado más `formato` (xlsx por defecto).
 * Con `todo` se pide todo el historial en un solo archivo y no se envía `mes`.
 */
export function exportQuery({ todo = false, formato = 'xlsx', ...filters } = {}) {
  const query = { ...filterQuery(filters), formato }
  if (!todo) return query
  return { ...query, mes: undefined, todo: 1 }
}

/** Nombre de respaldo con el mismo patrón que el backend (si el navegador no deja leer Content-Disposition). */
export function exportFilename({ mes, todo = false, formato = 'xlsx' } = {}) {
  if (todo) return `finova-historial-completo.${formato}`
  const prefix = formato === 'csv' ? 'finova-transacciones' : 'finova-movimientos'
  return mes ? `${prefix}-${mes}.${formato}` : `${prefix}.${formato}`
}

function firstText(value) {
  const first = Array.isArray(value) ? value[0] : value
  return first === undefined || first === null ? '' : String(first)
}

/** Agrega un error "campo → mensaje" al resultado (detail y non_field_errors son el mensaje general). */
function addError(result, key, text) {
  if (!text) return result
  if (DETAIL_KEYS.has(key)) return { ...result, message: result.message || text }
  return { ...result, fieldErrors: { ...result.fieldErrors, [key]: text } }
}

/** Errores en JSON de DRF: `{ detail }` o `{ campo: ['mensaje'] }`. `null` si no es JSON. */
function jsonErrors(body) {
  try {
    const data = JSON.parse(body)
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    return Object.entries(data).reduce((result, [key, value]) => addError(result, key, firstText(value)), {
      message: '',
      fieldErrors: {},
    })
  } catch {
    return null
  }
}

function unquote(text) {
  const value = text.trim()
  if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"')) return value
  return value.slice(1, -1).replaceAll('""', '"')
}

/** Errores de una exportación CSV: filas "campo,mensaje" (el mensaje puede tener comas). */
function csvErrors(lines) {
  return lines.slice(1).reduce(
    (result, line) => {
      const comma = line.indexOf(',')
      return comma < 0 ? result : addError(result, unquote(line.slice(0, comma)), unquote(line.slice(comma + 1)))
    },
    { message: '', fieldErrors: {} },
  )
}

/** Texto plano: CSV de errores o, si es una sola línea legible (no HTML, JSON roto ni error 5xx), ese mensaje. */
function textErrors(body, status) {
  const lines = body.split(/\r?\n/).filter((line) => line.trim())
  if (lines[0]?.trim().toLowerCase() === CSV_ERROR_HEADER) return csvErrors(lines)
  const readable = status < 500 && lines.length === 1 && !MARKUP_START.test(body)
  return { message: readable ? lines[0].trim() : '', fieldErrors: {} }
}

function fallbackMessage(status) {
  if (status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.'
  if (status >= 500) return 'El servidor tuvo un problema al generar el archivo. Inténtalo de nuevo en unos minutos.'
  return 'No se pudo descargar el archivo.'
}

/**
 * Los errores de /exportar/ llegan como JSON (Excel) o como CSV "campo,mensaje" (formato=csv).
 * Devuelve `{ message, fieldErrors }` legibles, con un mensaje en español si el cuerpo no sirve.
 */
export function parseExportError(text, status) {
  const body = String(text || '')
    .replace(/^﻿/, '')
    .trim()
  const parsed = (body.startsWith('{') && jsonErrors(body)) || textErrors(body, status)
  const message = parsed.message || Object.values(parsed.fieldErrors)[0] || fallbackMessage(status)
  return { message, fieldErrors: parsed.fieldErrors }
}

export const transactionsApi = {
  /**
   * Movimientos agrupados por día. Filtros: mes, search, tipo (INGRESO|GASTO), categoria, cuenta_id.
   * Paginación: page (desde 1) y page_size (máx. 500).
   */
  list({ signal, page, page_size: pageSize, ...filters } = {}) {
    return apiRequest(`/transacciones/${toQuery({ ...filterQuery(filters), page, page_size: pageSize })}`, { signal })
  },
  /** `{ name, category, amount, type, account_id, occurred_at? }` → `{ message, data }` */
  create(payload) {
    return apiRequest('/transacciones/', { method: 'POST', body: payload })
  },
  /** Edición parcial (solo movimientos REGULAR): `{ name?, category?, amount?, account_id?, occurred_at? }`. */
  update(id, payload) {
    return apiRequest(`/transacciones/${id}/`, { method: 'PATCH', body: payload })
  },
  /** Elimina un movimiento. Una transferencia elimina sus dos movimientos. */
  remove(id) {
    return apiRequest(`/transacciones/${id}/`, { method: 'DELETE' })
  },
  transfer(payload) {
    return apiRequest('/transacciones/transferir/', { method: 'POST', body: payload })
  },
  deposit(payload) {
    return apiRequest('/transacciones/depositar/', { method: 'POST', body: payload })
  },
  /**
   * Descarga de movimientos → `{ blob, filename }`. Excel (.xlsx) por defecto; `formato: 'csv'` para el CSV.
   * Filtros: mes, tipo, categoria, cuenta_id, search; `todo: true` trae todo el historial en un solo archivo.
   * `filename` es el del backend (Content-Disposition, p. ej. finova-movimientos-2026-11.xlsx); si el navegador
   * no deja leer esa cabecera se usa el mismo patrón. Usa fetch directo para leer las cabeceras y los errores.
   */
  async exportMovements(options = {}) {
    const formato = options.formato === 'csv' ? 'csv' : 'xlsx'
    let response
    try {
      response = await fetch(`${API_ROOT}/transacciones/exportar/${toQuery(exportQuery({ ...options, formato }))}`, {
        credentials: 'include',
        headers: { Accept: ACCEPT_BY_FORMAT[formato] },
      })
    } catch {
      throw new ApiError('No pudimos conectar con el servidor. Verifica que Django esté en ejecución.', 0, null)
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      const { message, fieldErrors } = parseExportError(text, response.status)
      throw new ApiError(message, response.status, fieldErrors)
    }
    const blob = await response.blob()
    const filename = filenameFromDisposition(response.headers.get('Content-Disposition'))
    return { blob, filename: filename || exportFilename({ ...options, formato }) }
  },
}
