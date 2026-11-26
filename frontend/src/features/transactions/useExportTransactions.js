import { useCallback, useState } from 'react'
import { useToast } from '../../components/ui'
import { usePeriod } from '../../context/PeriodContext'
import { transactionsApi } from '../../lib/api/transactions'
import { downloadBlob } from '../../lib/download'

const FILTER_KEYS = ['mes', 'tipo', 'categoria', 'cuenta_id', 'search']

/** Solo objetos de filtros: otras pantallas usan `onClick={exportExcel}` y reciben el evento del clic. */
function pickFilters(value) {
  if (!value || typeof value !== 'object' || 'nativeEvent' in value || 'target' in value) return {}
  return Object.fromEntries(FILTER_KEYS.filter((key) => value[key]).map((key) => [key, value[key]]))
}

/**
 * `const { exportExcel, exporting } = useExportTransactions()`
 *   exportExcel()                                          → Excel del período seleccionado en el header
 *   exportExcel({ mes, tipo, categoria, cuenta_id, search }) → Excel con esos filtros
 * Siempre es el Excel de UN mes (`mes`, por defecto el del header) con esos filtros. El archivo se guarda con el
 * nombre que envía el backend (Content-Disposition, p. ej. `finova-movimientos-2026-11.xlsx`) y el aviso lo muestra.
 */
export function useExportTransactions() {
  const toast = useToast()
  const { period } = usePeriod()
  const [exporting, setExporting] = useState(false)

  const exportExcel = useCallback(
    async (options) => {
      const filters = { mes: period, ...pickFilters(options) }
      setExporting(true)
      try {
        const { blob, filename } = await transactionsApi.exportMovements(filters)
        downloadBlob(blob, filename)
        toast.success(`Excel descargado: ${filename}`)
      } catch (error) {
        toast.error(error?.message || 'No se pudo descargar el archivo.')
      } finally {
        setExporting(false)
      }
    },
    [period, toast],
  )

  return { exportExcel, exporting }
}
