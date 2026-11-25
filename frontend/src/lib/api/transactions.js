import { ApiError, apiRequest, toQuery } from '../api.js'

const API_ROOT = import.meta.env.VITE_API_ROOT || '/api/v1'

/** Filtros que entiende el backend (listado y exportación). Los vacíos se omiten de la URL. */
function filterQuery({ mes, search, tipo, categoria, cuenta_id: cuentaId } = {}) {
  return { mes, search, tipo, categoria, cuenta_id: cuentaId }
}

/** Divide una línea CSV respetando comillas ("a,b" y "" escapadas). */
function splitCsvLine(line) {
  const cells = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      cells.push(cell)
      cell = ''
    } else {
      cell += char
    }
  }
  cells.push(cell)
  return cells
}

/**
 * Los errores de /exportar/ llegan como CSV "campo,mensaje" (o JSON / texto si algo falla antes).
 * Devuelve `{ message, fieldErrors }` legibles.
 */
export function parseExportError(text, status) {
  const body = String(text || '').replace(/^﻿/, '').trim()
  const fieldErrors = {}
  let message = ''

  if (body.startsWith('{')) {
    try {
      const data = JSON.parse(body)
      for (const [key, value] of Object.entries(data)) {
        const first = Array.isArray(value) ? value[0] : value
        if (key === 'detail' || key === 'non_field_errors') message ||= String(first)
        else fieldErrors[key] = String(first)
      }
    } catch {
      // no era JSON: se usa el mensaje genérico
    }
  } else if (body && !body.startsWith('<')) {
    const lines = body.split(/\r?\n/).filter(Boolean)
    const rows = lines.map(splitCsvLine)
    const start = rows[0]?.[0]?.trim().toLowerCase() === 'campo' ? 1 : 0
    for (const [key = '', ...rest] of rows.slice(start)) {
      const text = rest.join(', ').trim()
      if (!text) continue
      if (key === 'detail' || key === 'non_field_errors') message ||= text
      else fieldErrors[key] = text
    }
    if (!message && !Object.keys(fieldErrors).length && lines.length === 1) message = lines[0]
  }

  if (!message) message = Object.values(fieldErrors)[0] || ''
  if (!message) {
    message =
      status === 401
        ? 'Tu sesión expiró. Inicia sesión nuevamente.'
        : status >= 500
          ? 'El servidor tuvo un problema al generar el archivo. Inténtalo de nuevo en unos minutos.'
          : 'No se pudo descargar el historial.'
  }
  return { message, fieldErrors }
}

/** 'attachment; filename="finova-transacciones-2026-11.csv"' → 'finova-transacciones-2026-11.csv' */
function filenameFrom(disposition) {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition || '')
  if (!match) return ''
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
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
   * CSV con los movimientos que cumplen los filtros → `{ blob, filename }`.
   * Usa fetch directo porque los errores llegan como texto CSV y hay que leerlos.
   */
  async exportCsv(filters = {}) {
    let response
    try {
      response = await fetch(`${API_ROOT}/transacciones/exportar/${toQuery(filterQuery(filters))}`, {
        credentials: 'include',
        headers: { Accept: 'text/csv' },
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
    const fallback = `finova-transacciones${filters.mes ? `-${filters.mes}` : ''}.csv`
    return { blob, filename: filenameFrom(response.headers.get('Content-Disposition')) || fallback }
  },
}
