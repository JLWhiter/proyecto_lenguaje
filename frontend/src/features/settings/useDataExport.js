import { useCallback, useState } from 'react'
import { useToast } from '../../components/ui'
import { apiRequest, toQuery } from '../../lib/api'
import { downloadBlob } from '../../lib/download'
import { isValidMonth, monthLabel } from '../../lib/period'

const BOM = '﻿'

function fetchMonthCsv(month) {
  return apiRequest(`/transacciones/exportar/${toQuery({ mes: month })}`, { responseType: 'blob', accept: 'text/csv' })
}

/** Separa el encabezado (primera línea, sin comillas ni saltos) del resto del CSV de un mes. */
function splitCsv(text) {
  const clean = text.startsWith(BOM) ? text.slice(1) : text
  const end = clean.indexOf('\n')
  if (end === -1) return { header: clean ? `${clean}\r\n` : '', body: '' }
  return { header: clean.slice(0, end + 1), body: clean.slice(end + 1) }
}

/**
 * Exportación de movimientos a CSV desde Configuración.
 *
 * El backend exporta un mes por petición (`/transacciones/exportar/?mes=`). Para "todos los
 * movimientos" pedimos los meses con datos (`/periodos/`) y unimos sus CSV con un solo encabezado,
 * del mes más reciente al más antiguo (igual que dentro de cada mes).
 *
 *   const { exportAll, exportMonth, exporting } = useDataExport()   // exporting: 'all' | 'month' | null
 */
export function useDataExport() {
  const toast = useToast()
  const [exporting, setExporting] = useState(null)

  const exportMonth = useCallback(
    async (month) => {
      setExporting('month')
      try {
        const blob = await fetchMonthCsv(month)
        downloadBlob(blob, `finova-movimientos-${month}.csv`)
        toast.success(`Descargaste los movimientos de ${monthLabel(month)}.`)
      } catch (error) {
        toast.error(error.message || 'No se pudo descargar el archivo.')
      } finally {
        setExporting(null)
      }
    },
    [toast],
  )

  const exportAll = useCallback(async () => {
    setExporting('all')
    try {
      const data = await apiRequest('/periodos/')
      const months = (data?.periodos ?? []).map((item) => item?.mes).filter(isValidMonth)
      const texts = await Promise.all(months.map((month) => fetchMonthCsv(month).then((blob) => blob.text())))

      let header = ''
      const bodies = []
      for (const text of texts) {
        const part = splitCsv(text)
        header ||= part.header
        if (part.body.trim()) bodies.push(/\r?\n$/.test(part.body) ? part.body : `${part.body}\r\n`)
      }

      if (bodies.length === 0) {
        toast.info('Aún no tienes movimientos registrados para exportar.')
        return
      }

      const blob = new Blob([BOM, header, ...bodies], { type: 'text/csv;charset=utf-8' })
      downloadBlob(blob, 'finova-movimientos-todos.csv')
      toast.success(
        bodies.length === 1
          ? 'Descargaste todos tus movimientos.'
          : `Descargaste todos tus movimientos (${bodies.length} meses).`,
      )
    } catch (error) {
      toast.error(error.message || 'No se pudo descargar el archivo.')
    } finally {
      setExporting(null)
    }
  }, [toast])

  return { exportAll, exportMonth, exporting }
}
