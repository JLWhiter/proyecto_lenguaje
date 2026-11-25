import { useApiResource } from '../../hooks/useApiResource'
import { accountsApi } from '../../lib/api/accounts'

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
