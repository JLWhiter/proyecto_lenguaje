import { apiRequest } from '../api.js'

export const accountsApi = {
  /** `{ patrimonio, liquidez, efectivo, accounts: [...] }` (el backend también envía `cuentas`). */
  async list({ signal } = {}) {
    const data = await apiRequest('/cuentas/', { signal })
    return { ...data, accounts: data?.accounts ?? data?.cuentas ?? [] }
  },
  create(payload) {
    return apiRequest('/cuentas/', { method: 'POST', body: payload })
  },
  updateBalance(id, payload) {
    return apiRequest(`/cuentas/${id}/saldo/`, { method: 'PATCH', body: payload })
  },
}
