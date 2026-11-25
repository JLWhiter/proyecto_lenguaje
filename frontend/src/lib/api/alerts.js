import { apiRequest, toQuery } from '../api.js'

export const alertsApi = {
  /**
   * `{ estado, tipo, counts: { activas, no_leidas, total }, filters: ['Todas (6)', ...], items: [...] }`.
   * - `estado`: 'activas' (por defecto: ni descartadas ni pospuestas) | 'todas'.
   * - `tipo`: regla (`budget_threshold`…), su etiqueta ('Presupuesto'…) o un nivel (`danger`…).
   */
  list({ estado, tipo, signal } = {}) {
    return apiRequest(`/alertas/${toQuery({ estado, tipo })}`, { signal })
  },
  /**
   * `payload.action`: read | unread | dismiss | snooze (con `hours` 1–720, 24 por defecto) | restore.
   * Responde `{ success, message, data: <alerta actualizada> }`.
   */
  act(id, payload) {
    return apiRequest(`/alertas/${id}/accion/`, { method: 'POST', body: payload })
  },
  /** Pospone (no descarta) todas las alertas activas; 24 h por defecto. `{ message, pospuestas, pospuesta_hasta }`. */
  silenceAll({ hours } = {}) {
    return apiRequest('/alertas/silenciar-todo/', { method: 'POST', body: hours ? { hours } : {} })
  },
}
