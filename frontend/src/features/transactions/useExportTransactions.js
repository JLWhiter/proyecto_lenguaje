import { useCallback, useState } from 'react'
import { useToast } from '../../components/ui'
import { transactionsApi } from '../../lib/api/transactions'
import { downloadBlob } from '../../lib/download'

/** `const { exportCsv, exporting } = useExportTransactions()` → descarga finova-transacciones.csv con aviso. */
export function useExportTransactions() {
  const toast = useToast()
  const [exporting, setExporting] = useState(false)

  const exportCsv = useCallback(async () => {
    setExporting(true)
    try {
      const blob = await transactionsApi.exportCsv()
      downloadBlob(blob, 'finova-transacciones.csv')
      toast.success('Reporte descargado.')
    } catch (error) {
      toast.error(error.message || 'No se pudo descargar el reporte.')
    } finally {
      setExporting(false)
    }
  }, [toast])

  return { exportCsv, exporting }
}
