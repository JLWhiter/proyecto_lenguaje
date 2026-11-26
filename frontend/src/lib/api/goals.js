import { apiRequest, toQuery } from '../api.js'

/**
 * Metas de ahorro (`/api/v1/metas/`). Los aportes y retiros solo registran lo que el usuario
 * separa: no mueven dinero entre cuentas. Tras cualquier mutación el backend reevalúa las
 * alertas de metas: invalida 'goals', 'alerts' y 'dashboard'.
 */
export const goalsApi = {
  /** `{ resumen: { total_objetivo, total_ahorrado, metas_activas, alcanzadas }, metas: [<meta>] }`. `estado`: 'activas' | 'archivadas'. */
  list({ estado, signal } = {}) {
    return apiRequest(`/metas/${toQuery({ estado })}`, { signal })
  },
  /** `<meta>` + `aportes: [{ id, tipo, monto, fecha, nota }]` (más reciente primero) + `serie_mensual: [{ mes, aportado }]`. */
  detail(id, { signal } = {}) {
    return apiRequest(`/metas/${id}/`, { signal })
  },
  /** `{ name, target_amount, target_date, icon?, description?, initial_amount? }` → 201 `{ message, data: <meta con aportes> }`. */
  create(payload) {
    return apiRequest('/metas/', { method: 'POST', body: payload })
  },
  /** Cambio parcial: `{ name?, description?, icon?, target_amount?, target_date?, archived? }` → `{ message, data: <meta> }`. */
  update(id, payload) {
    return apiRequest(`/metas/${id}/`, { method: 'PATCH', body: payload })
  },
  /** 204 sin cuerpo (elimina la meta y su historial). */
  remove(id) {
    return apiRequest(`/metas/${id}/`, { method: 'DELETE' })
  },
  /** `{ tipo: 'APORTE' | 'RETIRO', amount, occurred_at?, note? }` → 201 `{ message, data: <meta con aportes> }`. */
  addMovement(id, payload) {
    return apiRequest(`/metas/${id}/aportes/`, { method: 'POST', body: payload })
  },
  /** 204 sin cuerpo. */
  removeMovement(id, movementId) {
    return apiRequest(`/metas/${id}/aportes/${movementId}/`, { method: 'DELETE' })
  },
}
