import { apiRequest } from '../api.js'

export const categoriesApi = {
  /**
   * Catálogo de categorías ordenado por uso:
   * `{ categorias: [{ nombre, predeterminada, tipos: ['GASTO' | 'INGRESO'], movimientos }] }`.
   */
  list({ signal } = {}) {
    return apiRequest('/categorias/', { signal })
  },
}
