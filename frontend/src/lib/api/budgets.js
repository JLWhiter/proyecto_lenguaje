import { apiRequest, toQuery } from '../api.js'

/**
 * Presupuestos mensuales (`/api/v1/presupuestos/`).
 * Tras cualquier mutación el backend regenera las alertas de presupuesto:
 * invalida 'budgets', 'alerts' y 'dashboard'.
 */
export const budgetsApi = {
  /** `{ mes, summary, ia_alert, filtros, categorias }` del mes AAAA-MM. */
  list({ mes, signal } = {}) {
    return apiRequest(`/presupuestos/${toQuery({ mes })}`, { signal })
  },
  /** `{ month?, category, description?, limit_amount, icon? }` → 201 `{ data: presupuesto }`. */
  create(payload) {
    return apiRequest('/presupuestos/', { method: 'POST', body: payload })
  },
  /** Cambio parcial: `{ category?, description?, limit_amount?, icon? }` → `{ data: presupuesto }`. */
  update(id, payload) {
    return apiRequest(`/presupuestos/${id}/`, { method: 'PATCH', body: payload })
  },
  /** 204 sin cuerpo. */
  remove(id) {
    return apiRequest(`/presupuestos/${id}/`, { method: 'DELETE' })
  },
  /** Ruta antigua: solo cambia el límite (`{ limit_amount }`). Preferir `update`. */
  adjust(id, payload) {
    return apiRequest(`/presupuestos/${id}/ajustar/`, { method: 'PATCH', body: payload })
  },
  /** `{ month?, source_category, target_category, amount }` → `{ data: [origen, destino], transfer }`. */
  rebalance(payload) {
    return apiRequest('/presupuestos/rebalancear/', { method: 'POST', body: payload })
  },
  /** `{ month?, source_month? }` → `{ message, data, copiados, omitidos }`. */
  copy(payload) {
    return apiRequest('/presupuestos/copiar/', { method: 'POST', body: payload })
  },
}
