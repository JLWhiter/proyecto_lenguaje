import { apiRequest } from '../api.js'

export const accountsApi = {
  /** `{ patrimonio, liquidez, efectivo, accounts: [...] }` (el backend también envía `cuentas`). Solo cuentas no archivadas. */
  async list({ signal } = {}) {
    const data = await apiRequest('/cuentas/', { signal })
    return { ...data, accounts: data?.accounts ?? data?.cuentas ?? [] }
  },
  /** `{ name, account_type, description?, balance?, icon? }` → `{ success, message, data: <cuenta> }`. */
  create(payload) {
    return apiRequest('/cuentas/', { method: 'POST', body: payload })
  },
  /** Edición parcial: `{ name?, account_type?, description?, icon? }` → `{ message, data: <cuenta> }`. */
  update(id, payload) {
    return apiRequest(`/cuentas/${id}/`, { method: 'PATCH', body: payload })
  },
  /**
   * Elimina la cuenta (o la archiva si tiene movimientos). Solo con saldo 0.
   * → `{ message, accion: 'eliminada' | 'archivada' }`.
   */
  remove(id) {
    return apiRequest(`/cuentas/${id}/`, { method: 'DELETE' })
  },
  /** `{ balance }` → `{ data: <cuenta>, movimiento: <"Ajuste de saldo"> | null }`. */
  updateBalance(id, payload) {
    return apiRequest(`/cuentas/${id}/saldo/`, { method: 'PATCH', body: payload })
  },
}
