import { useCallback, useState } from 'react'
import { useToast } from '../../components/ui'
import { usePeriod } from '../../context/PeriodContext'
import { transactionsApi } from '../../lib/api/transactions'
import { downloadBlob } from '../../lib/download'
import { monthLabel } from '../../lib/period'

const FILTER_KEYS = ['mes', 'tipo', 'categoria', 'cuenta_id', 'search']

/** Solo objetos de filtros: otras pantallas usan `onClick={exportCsv}` y reciben el evento del clic. */
function pickFilters(value) {
  if (!value || typeof value !== 'object' || 'nativeEvent' in value || 'target' in value) return {}
  return Object.fromEntries(FILTER_KEYS.filter((key) => value[key]).map((key) => [key, value[key]]))
}

/**
 * `const { exportCsv, exporting } = useExportTransactions()`
 *   exportCsv()                                  → CSV del período seleccionado en el header
 *   exportCsv({ mes, tipo, categoria, cuenta_id, search }) → CSV con esos filtros
 * Descarga `finova-transacciones-AAAA-MM.csv` y avisa con un toast (también si falla, con el motivo).
 */
export function useExportTransactions() {
  const toast = useToast()
  const { period } = usePeriod()
  const [exporting, setExporting] = useState(false)

  const exportCsv = useCallback(
    async (options) => {
      const filters = { mes: period, ...pickFilters(options) }
      setExporting(true)
      try {
        const { blob, filename } = await transactionsApi.exportCsv(filters)
        downloadBlob(blob, filename)
        toast.success(`Historial de ${monthLabel(filters.mes) || 'movimientos'} descargado.`)
      } catch (error) {
        toast.error(error?.message || 'No se pudo descargar el historial.')
      } finally {
        setExporting(false)
      }
    },
    [period, toast],
  )

  return { exportCsv, exporting }
}
