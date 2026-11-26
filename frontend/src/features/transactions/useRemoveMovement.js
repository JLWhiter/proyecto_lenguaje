import { useState } from 'react'
import { useConfirm, useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { transactionsApi } from '../../lib/api/transactions'
import { deleteRequest } from './movementText'
import { MONEY_MOVEMENT_TAGS } from './useTransactions'

/**
 * Eliminar un movimiento con confirmación. `money` respeta "Ocultar montos" en el mensaje;
 * `beforeConfirm` cierra el diálogo abierto (p. ej. la hoja de detalle) antes de preguntar.
 * → `{ busyId, removeMovement(item) }` (`busyId`: movimiento que se está eliminando).
 */
export function useRemoveMovement(money, beforeConfirm) {
  const invalidate = useInvalidate()
  const toast = useToast()
  const confirm = useConfirm()
  const [busyId, setBusyId] = useState(null)

  async function removeMovement(item) {
    beforeConfirm?.()
    const ok = await confirm({ ...deleteRequest(item, money), tone: 'danger' })
    if (!ok) return
    setBusyId(item.id)
    try {
      await transactionsApi.remove(item.id)
      invalidate(MONEY_MOVEMENT_TAGS)
      toast.success(item.kind === 'TRANSFER' ? 'Transferencia eliminada: se borraron sus dos movimientos.' : 'Movimiento eliminado.')
    } catch (error) {
      // 404: ya se había eliminado (otra pestaña): se actualiza la lista igual.
      if (error?.status === 404) invalidate(MONEY_MOVEMENT_TAGS)
      toast.error(error?.message || 'No se pudo eliminar el movimiento.')
    } finally {
      setBusyId(null)
    }
  }

  return { busyId, removeMovement }
}
