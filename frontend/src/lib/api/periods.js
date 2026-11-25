import { apiRequest, isAbortError } from '../api.js'
import { isValidMonth, monthLabel, recentMonths } from '../period.js'

const FALLBACK_MONTHS = 24

/** Respaldo en el cliente: últimos 24 meses hasta el mes actual (America/Lima). */
function clientPeriods() {
  return recentMonths(FALLBACK_MONTHS).map((value) => ({ value, label: monthLabel(value) }))
}

/**
 * Fuente de los períodos que ofrece el selector del header.
 *
 * GET /periodos/ → `{ actual, periodos: [{ mes, etiqueta, es_actual }] }` (meses con movimientos o
 * presupuestos + el mes actual, del más reciente al más antiguo), mapeado a `[{ value, label }]`.
 * La etiqueta se arma en el cliente (`monthLabel`) para que coincida con la píldora del header.
 * Si la petición falla (red caída, 5xx…) se usan los últimos 24 meses generados en el cliente.
 */
export const periodsApi = {
  async list({ signal } = {}) {
    try {
      const data = await apiRequest('/periodos/', { signal })
      const list = (Array.isArray(data?.periodos) ? data.periodos : [])
        .filter((item) => isValidMonth(item?.mes))
        .map((item) => ({ value: item.mes, label: monthLabel(item.mes) || item.etiqueta }))
      return list.length ? list : clientPeriods()
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) throw error
      return clientPeriods()
    }
  },
}
