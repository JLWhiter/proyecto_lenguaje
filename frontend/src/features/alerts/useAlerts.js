import { useCallback } from 'react'
import { useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { useApiResource } from '../../hooks/useApiResource'
import { alertsApi } from '../../lib/api/alerts'
import { ACTIVE_ALERTS } from './alertModel'

const ALERT_TAGS = ['alerts', 'dashboard']

/**
 * Alertas del usuario: `{ counts: { activas, no_leidas, total }, filters, items }`.
 * `estado`: 'activas' (por defecto, la que usa la campana del header) | 'todas'.
 * Se recarga con invalidate('alerts').
 */
export function useAlerts({ estado = ACTIVE_ALERTS } = {}) {
  return useApiResource(({ signal }) => alertsApi.list({ estado, signal }), [estado], {
    tags: ['alerts'],
    cacheKey: estado === ACTIVE_ALERTS ? 'alerts' : `alerts:${estado}`,
  })
}

/** Acciones sobre alertas con invalidación ('alerts', 'dashboard') y avisos incluidos. */
export function useAlertActions() {
  const invalidate = useInvalidate()
  const toast = useToast()

  /**
   * `act(alert, 'read' | 'unread' | 'dismiss' | 'snooze' | 'restore', { hours?, silent? })`.
   * Devuelve la respuesta (`{ message, data }`) o `null` si falló (el error ya se mostró).
   * Con `silent` no muestra el aviso de éxito (la pantalla da su propio feedback).
   */
  const act = useCallback(
    async (alert, action, { hours, silent = false } = {}) => {
      try {
        const payload = action === 'snooze' && hours ? { action, hours } : { action }
        const result = await alertsApi.act(alert.id, payload)
        invalidate(ALERT_TAGS)
        if (!silent) toast.success(result?.message || 'Acción aplicada.')
        return result ?? { success: true }
      } catch (error) {
        toast.error(error.message || 'No se pudo actualizar la alerta.')
        return null
      }
    },
    [invalidate, toast],
  )

  /** Deshace "Descartar"/"Posponer": restaura la alerta y, si no estaba leída, la deja otra vez sin leer. */
  const undo = useCallback(
    async (alert) => {
      try {
        let result = await alertsApi.act(alert.id, { action: 'restore' })
        if (alert.leida === false) result = await alertsApi.act(alert.id, { action: 'unread' })
        toast.success('Alerta restaurada.')
        return result ?? { success: true }
      } catch (error) {
        toast.error(error.message || 'No se pudo restaurar la alerta.')
        return null
      } finally {
        invalidate(ALERT_TAGS)
      }
    },
    [invalidate, toast],
  )

  /** Pospone todas las alertas activas (24 h por defecto). Devuelve la respuesta o `null`. */
  const silenceAll = useCallback(
    async ({ hours } = {}) => {
      try {
        const result = await alertsApi.silenceAll({ hours })
        invalidate(ALERT_TAGS)
        toast.success(result?.message || 'Alertas silenciadas.')
        return result ?? { success: true }
      } catch (error) {
        toast.error(error.message || 'No se pudieron silenciar las alertas.')
        return null
      }
    },
    [invalidate, toast],
  )

  return { act, undo, silenceAll }
}
