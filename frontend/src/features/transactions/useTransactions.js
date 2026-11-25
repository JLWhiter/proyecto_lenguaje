import { useApiResource } from '../../hooks/useApiResource'
import { transactionsApi } from '../../lib/api/transactions'

/** Movimientos agrupados del mes `period`. Se recarga con invalidate('transactions'). */
export function useTransactions(period) {
  return useApiResource(({ signal }) => transactionsApi.list({ mes: period, signal }), [period], {
    tags: ['transactions'],
    cacheKey: `transactions:${period}`,
  })
}

/** Recursos afectados por crear/eliminar un movimiento, transferir o depositar. */
export const MONEY_MOVEMENT_TAGS = ['transactions', 'accounts', 'dashboard', 'budgets']
