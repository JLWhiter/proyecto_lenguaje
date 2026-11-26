import { useCallback, useState } from 'react'
import { useToast } from '../../components/ui'
import { transactionsApi } from '../../lib/api/transactions'
import { downloadBlob } from '../../lib/download'
import { monthLabel } from '../../lib/period'

/**
 * Exportación de movimientos a Excel desde Configuración.
 *
 * "Todo el historial" es una sola petición (`/transacciones/exportar/?todo=1`): el backend arma un libro con
 * todos los movimientos, un resumen por categoría y la evolución mes a mes. "Solo un mes" trae además sus
 * presupuestos. El archivo se guarda con el nombre que envía el backend.
 *
 *   const { exportAll, exportMonth, exporting } = useDataExport()   // exporting: 'all' | 'month' | null
 */
export function useDataExport() {
  const toast = useToast()
  const [exporting, setExporting] = useState(null)

  const download = useCallback(
    async (kind, options, successMessage) => {
      setExporting(kind)
      try {
        const { blob, filename } = await transactionsApi.exportMovements(options)
        downloadBlob(blob, filename)
        toast.success(`${successMessage} (${filename})`)
      } catch (error) {
        toast.error(error?.message || 'No se pudo descargar el archivo.')
      } finally {
        setExporting(null)
      }
    },
    [toast],
  )

  const exportMonth = useCallback(
    (month) => download('month', { mes: month }, `Descargaste el Excel de ${monthLabel(month)}`),
    [download],
  )

  const exportAll = useCallback(
    () => download('all', { todo: true }, 'Descargaste el Excel con todo tu historial'),
    [download],
  )

  return { exportAll, exportMonth, exporting }
}
