import { apiRequest, toQuery } from '../api.js'

export const transactionsApi = {
  /** Movimientos agrupados del período. Filtros opcionales soportados por el backend: search, tipo, categoria, cuenta_id. */
  list({ mes, search, tipo, categoria, cuenta_id: cuentaId, signal } = {}) {
    return apiRequest(`/transacciones/${toQuery({ mes, search, tipo, categoria, cuenta_id: cuentaId })}`, { signal })
  },
  create(payload) {
    return apiRequest('/transacciones/', { method: 'POST', body: payload })
  },
  remove(id) {
    return apiRequest(`/transacciones/${id}/`, { method: 'DELETE' })
  },
  transfer(payload) {
    return apiRequest('/transacciones/transferir/', { method: 'POST', body: payload })
  },
  deposit(payload) {
    return apiRequest('/transacciones/depositar/', { method: 'POST', body: payload })
  },
  /** Devuelve un Blob CSV con todos los movimientos. */
  exportCsv() {
    return apiRequest('/transacciones/exportar/', { responseType: 'blob', accept: 'text/csv' })
  },
}
