import { useCallback, useState } from 'react'
import { useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { alertsApi } from '../../lib/api/alerts'

const SNOOZE_HOURS = 24

const FALLBACK_MESSAGES = {
  snooze: 'Alerta pospuesta por 24 horas.',
  dismiss: 'Alerta descartada.',
}

/**
 * Posponer (24 h) o descartar alertas desde el Resumen.
 * Mientras llega el resumen actualizado, las alertas atendidas se ocultan al instante (`isHandled`).
 * El estado se asocia a la respuesta `source`: cuando llega una nueva, manda el servidor.
 */
export function useAlertQuickActions(source) {
  const invalidate = useInvalidate()
  const toast = useToast()
  const [busy, setBusy] = useState(null) // { id, action }
  const [handled, setHandled] = useState({ source: null, ids: [] })

  const handledIds = handled.source === source ? handled.ids : []

  const run = useCallback(
    async (alert, action) => {
      setBusy({ id: alert.id, action })
      try {
        const payload = action === 'snooze' ? { action, hours: SNOOZE_HOURS } : { action }
        const result = await alertsApi.act(alert.id, payload)
        setHandled((current) => ({
          source,
          ids: [...(current.source === source ? current.ids : []), alert.id],
        }))
        invalidate('alerts', 'dashboard')
        toast.success(result?.message || FALLBACK_MESSAGES[action])
        return true
      } catch (error) {
        toast.error(error?.message || 'No se pudo actualizar la alerta. Inténtalo de nuevo.')
        return false
      } finally {
        setBusy(null)
      }
    },
    [invalidate, toast, source],
  )

  return {
    busy,
    handledCount: handledIds.length,
    isHandled: (id) => handledIds.includes(id),
    snooze: (alert) => run(alert, 'snooze'),
    dismiss: (alert) => run(alert, 'dismiss'),
  }
}
