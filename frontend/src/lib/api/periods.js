import { monthLabel, recentMonths } from '../period.js'

/**
 * Fuente de los períodos que ofrece el selector del header.
 *
 * Hoy se generan en el cliente (últimos 24 meses hasta el mes actual en America/Lima).
 * Cuando el backend publique GET /api/v1/periodos/, basta con cambiar el cuerpo de `list` por:
 *   return apiRequest('/periodos/', { signal })
 * (PeriodContext acepta tanto ['2026-11', ...] como [{ value, label }, ...]).
 */
export const periodsApi = {
  async list() {
    return recentMonths(24).map((value) => ({ value, label: monthLabel(value) }))
  },
}
