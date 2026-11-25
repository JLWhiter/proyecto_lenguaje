import { apiRequest, toQuery } from '../api.js'

export const budgetsApi = {
  list({ mes, signal } = {}) {
    return apiRequest(`/presupuestos/${toQuery({ mes })}`, { signal })
  },
  create(payload) {
    return apiRequest('/presupuestos/', { method: 'POST', body: payload })
  },
  adjust(id, payload) {
    return apiRequest(`/presupuestos/${id}/ajustar/`, { method: 'PATCH', body: payload })
  },
  remove(id) {
    return apiRequest(`/presupuestos/${id}/ajustar/`, { method: 'DELETE' })
  },
  rebalance(payload) {
    return apiRequest('/presupuestos/rebalancear/', { method: 'POST', body: payload })
  },
}
