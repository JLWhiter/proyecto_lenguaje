// Textos de la pantalla de Movimientos (funciones puras).
import { toNumber } from '../../lib/format'
import { PAGE_SIZE } from './useTransactions'

export function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

/** Textos del diálogo de eliminar. `money` respeta "Ocultar montos" ('••••'). */
export function deleteRequest(item, money) {
  const amount = money(Math.abs(toNumber(item.monto)))
  const account = item.cuenta || 'la cuenta'
  if (item.kind === 'TRANSFER') {
    return {
      title: 'Eliminar transferencia',
      message: `«${item.nombre}» tiene dos movimientos: la salida de una cuenta y la entrada en la otra. Al eliminarla se borran ambos y se restauran los saldos de las dos cuentas (${amount}). Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar ambos movimientos',
    }
  }
  if (item.kind === 'DEPOSIT') {
    return {
      title: 'Eliminar depósito',
      message: `Se eliminará «${item.nombre}» y se descontarán ${amount} del saldo de ${account}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar depósito',
    }
  }
  const effect = item.tipo === 'INGRESO' ? `se descontarán ${amount} del saldo` : `se devolverán ${amount} al saldo`
  return {
    title: 'Eliminar movimiento',
    message: `Se eliminará «${item.nombre}» y ${effect} de ${account}. Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
  }
}

/**
 * Texto de la barra de resultados (región viva):
 * "Buscando movimientos…", error, sin resultados o "30 movimientos con estos filtros · mostrando 20".
 */
export function feedStatusText({ status, stale, count, loaded, hasFilters, periodPhrase }) {
  if (status === 'loading' || stale) return 'Buscando movimientos…'
  if (status === 'error') return 'No se pudieron cargar los movimientos.'
  if (count === 0) return hasFilters ? 'Ningún movimiento coincide con los filtros.' : `Sin movimientos en ${periodPhrase}.`
  const filtered = hasFilters ? ' con estos filtros' : ''
  const partial = loaded < count ? ` · mostrando ${loaded}` : ''
  return `${plural(count, 'movimiento', 'movimientos')}${filtered}${partial}`
}

/** Botón "Cargar más (50)" / "Reintentar" / "Cargando…". */
export function loadMoreLabel({ loadingMore, moreError, count, loaded }) {
  if (loadingMore) return 'Cargando…'
  if (moreError) return 'Reintentar'
  return `Cargar más (${Math.min(PAGE_SIZE, count - loaded)})`
}

/** Tono de una tarjeta de totales según el signo: 'emerald' (> 0), 'red' (< 0) o 'slate' (0). */
export function signTone(value) {
  if (value > 0) return 'emerald'
  return value < 0 ? 'red' : 'slate'
}
