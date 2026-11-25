import { useApiResource } from '../../hooks/useApiResource'
import { budgetsApi } from '../../lib/api/budgets'

/** Presupuestos del mes `period` (AAAA-MM). Se recarga con invalidate('budgets'). */
export function useBudgets(period) {
  return useApiResource(({ signal }) => budgetsApi.list({ mes: period, signal }), [period], {
    tags: ['budgets'],
    cacheKey: `budgets:${period}`,
  })
}
