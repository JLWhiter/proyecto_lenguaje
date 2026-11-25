import { useApiResource } from '../../hooks/useApiResource'
import { dashboardApi } from '../../lib/api/dashboard'

/** Resumen del mes `period`. Se recarga con invalidate('dashboard'). */
export function useDashboard(period) {
  return useApiResource(({ signal }) => dashboardApi.summary({ mes: period, signal }), [period], {
    tags: ['dashboard'],
    cacheKey: `dashboard:${period}`,
  })
}
