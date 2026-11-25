import { apiRequest, toQuery } from '../api.js'

export const alertsApi = {
  /** `{ filters: ['Todas (5)', ...], items: [...] }`. Filtro opcional `tipo` (categoría). */
  list({ tipo, signal } = {}) {
    return apiRequest(`/alertas/${toQuery({ tipo })}`, { signal })
  },
  /** `action`: read | dismiss | snooze | confirm | confirm_fraud | ... */
  act(id, payload) {
    return apiRequest(`/alertas/${id}/accion/`, { method: 'POST', body: payload })
  },
  silenceAll() {
    return apiRequest('/alertas/silenciar-todo/', { method: 'POST', body: {} })
  },
}
