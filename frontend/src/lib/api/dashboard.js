import { apiRequest, toQuery } from '../api.js'

export const dashboardApi = {
  /** Resumen del período. `mes` en formato AAAA-MM. */
  summary({ mes, signal } = {}) {
    return apiRequest(`/dashboard/resumen/${toQuery({ mes })}`, { signal })
  },
}
