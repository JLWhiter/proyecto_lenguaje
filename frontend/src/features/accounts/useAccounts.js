import { useApiResource } from '../../hooks/useApiResource'
import { accountsApi } from '../../lib/api/accounts'
import { dashboardApi } from '../../lib/api/dashboard'

/** Recursos afectados al crear, editar, ajustar el saldo o eliminar una cuenta. */
export const ACCOUNT_MUTATION_TAGS = ['accounts', 'transactions', 'dashboard', 'alerts']

/** Cuentas del usuario: `{ patrimonio, liquidez, efectivo, accounts: [...] }`. Se recarga con invalidate('accounts'). */
export function useAccounts() {
  return useApiResource(({ signal }) => accountsApi.list({ signal }), [], {
    tags: ['accounts'],
    cacheKey: 'accounts',
  })
}

/** Opciones `[value, label]` para un <select> de cuentas: 'BCP Débito · S/ 1,200.00'. */
export function accountOptions(accounts, money) {
  return (accounts ?? []).map((account) => [String(account.id), `${account.nombre} · ${money(account.saldo)}`])
}

/**
 * Variación del patrimonio en el mes `month` (normalmente el actual) frente al cierre del mes anterior,
 * tomada del resumen del dashboard: `{ pct: number | null, delta: number | null }`.
 */
export function useBalanceVariation(month) {
  return useApiResource(
    ({ signal }) =>
      dashboardApi.summary({ mes: month, signal }).then((data) => {
        const evolution = Array.isArray(data?.evolucion_saldo) ? data.evolucion_saldo : []
        const last = evolution.at(-1)
        const previous = evolution[evolution.length - 2]
        const pct = typeof data?.balance_variacion_pct === 'number' ? data.balance_variacion_pct : null
        const delta =
          last && previous && last.periodo === month ? Math.round((Number(last.value) - Number(previous.value)) * 100) / 100 : null
        return { pct, delta: Number.isFinite(delta) ? delta : null }
      }),
    [month],
    { tags: ['dashboard'], cacheKey: `accounts:variation:${month}` },
  )
}

/** `?mes=…&cuenta=<id>` para abrir Movimientos filtrado por la cuenta, conservando el período. */
export function movementsSearch(periodSearch, accountId) {
  const params = new URLSearchParams(periodSearch)
  params.set('cuenta', String(accountId))
  return `?${params}`
}
