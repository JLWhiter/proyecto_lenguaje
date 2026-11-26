import { useState } from 'react'
import { useApiResource } from '../../hooks/useApiResource'
import { taxesApi } from '../../lib/api/taxes'

/**
 * Estimación del Impuesto a la Renta para `query` ({ anio, ingreso_anual?, deducciones_adicionales? }).
 * `query === null` no consulta la API (data = null).
 *
 * Mientras se recalcula con otros parámetros devuelve el último resultado con `stale: true`,
 * para que la pantalla no salte a un esqueleto en cada tecla.
 */
export function useIncomeTax(query) {
  const resource = useApiResource(
    ({ signal }) => (query ? taxesApi.incomeTax({ ...query, signal }) : Promise.resolve(null)),
    [query],
  )

  const [last, setLast] = useState(null)
  if (resource.status === 'ready' && last?.data !== resource.data) {
    setLast({ data: resource.data })
  }

  const stale = resource.status === 'loading' && last !== null
  let data
  if (resource.status === 'ready') data = resource.data
  else if (stale) data = last.data
  return {
    status: stale ? 'ready' : resource.status,
    data,
    error: resource.error,
    stale,
    reload: resource.reload,
  }
}
