import { useCallback } from 'react'
import { useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { useApiResource } from '../../hooks/useApiResource'
import { alertsApi } from '../../lib/api/alerts'

/** Alertas activas (no descartadas): `{ filters: [...], items: [...] }`. Se recarga con invalidate('alerts'). */
export function useAlerts() {
  return useApiResource(({ signal }) => alertsApi.list({ signal }), [], {
    tags: ['alerts'],
    cacheKey: 'alerts',
  })
}

/** Acciones sobre alertas con invalidación y aviso incluidos. */
export function useAlertActions() {
  const invalidate = useInvalidate()
  const toast = useToast()

  const act = useCallback(
    async (alert, action) => {
      try {
        const result = await alertsApi.act(alert.id, { action })
        invalidate('alerts', 'dashboard')
        toast.success(result?.message || 'Acción aplicada.')
      } catch (error) {
        toast.error(error.message || 'No se pudo actualizar la alerta.')
      }
    },
    [invalidate, toast],
  )

  const silenceAll = useCallback(async () => {
    try {
      const result = await alertsApi.silenceAll()
      invalidate('alerts', 'dashboard')
      toast.success(result?.message || 'Todas las alertas fueron silenciadas.')
    } catch (error) {
      toast.error(error.message || 'No se pudieron silenciar las alertas.')
    }
  }, [invalidate, toast])

  return { act, silenceAll }
}
