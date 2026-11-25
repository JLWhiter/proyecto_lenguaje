import { apiRequest, toQuery } from '../api.js'

export const taxesApi = {
  /** Estimación del Impuesto a la Renta de quinta categoría. Params: anio, ingreso_anual, deducciones_adicionales. */
  incomeTax({ anio, ingreso_anual: ingresoAnual, deducciones_adicionales: deducciones, signal } = {}) {
    return apiRequest(
      `/impuestos/renta/${toQuery({ anio, ingreso_anual: ingresoAnual, deducciones_adicionales: deducciones })}`,
      { signal },
    )
  },
}
