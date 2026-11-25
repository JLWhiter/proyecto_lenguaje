import { apiRequest, toQuery } from '../api.js'

export const taxesApi = {
  /**
   * Estimación del Impuesto a la Renta de quinta categoría.
   * Params: anio, ingreso_anual, deducciones_adicionales y proyectar (1 = en el año en curso y con los
   * ingresos registrados, `ingreso_bruto` es la proyección del año completo; en otros casos se ignora).
   */
  incomeTax({ anio, ingreso_anual: ingresoAnual, deducciones_adicionales: deducciones, proyectar, signal } = {}) {
    return apiRequest(
      `/impuestos/renta/${toQuery({ anio, ingreso_anual: ingresoAnual, deducciones_adicionales: deducciones, proyectar })}`,
      { signal },
    )
  },
}
