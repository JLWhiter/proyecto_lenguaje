import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usePeriod } from '../../context/PeriodContext'

export const SEARCH_DEBOUNCE_MS = 300

// Parámetros propios de la pantalla. `mes` lo maneja PeriodContext (selector del header).
const PARAMS = { tipo: 'tipo', categoria: 'categoria', cuenta: 'cuenta', search: 'q' }
const TYPES = new Set(['INGRESO', 'GASTO'])

function normalizeType(value) {
  const upper = String(value || '').trim().toUpperCase()
  return TYPES.has(upper) ? upper : ''
}

/**
 * Filtros de Movimientos guardados en la URL:
 *   /app/movimientos?mes=2026-10&tipo=GASTO&categoria=Transporte&cuenta=7&q=uber
 *
 * - Sobreviven a recargas y se pueden enlazar (Cuentas → `/app/movimientos?cuenta=<id>`).
 * - `cuenta` es el id. Por compatibilidad con enlaces antiguos también acepta el nombre
 *   (`?cuenta=Yape`): `resolveAccountName` lo reemplaza por el id cuando cargan las cuentas.
 * - El texto de búsqueda se escribe en la URL con un debounce de 300 ms.
 */
export function useTransactionFilters() {
  const { period } = usePeriod()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const tipo = normalizeType(searchParams.get(PARAMS.tipo))
  const categoria = (searchParams.get(PARAMS.categoria) || '').trim()
  const cuentaParam = (searchParams.get(PARAMS.cuenta) || '').trim()
  const cuentaId = /^\d+$/.test(cuentaParam) ? cuentaParam : ''
  const cuentaName = cuentaParam && !cuentaId ? cuentaParam : ''
  const search = (searchParams.get(PARAMS.search) || '').trim()

  // Se parte de la URL vigente (no del `searchParams` del último render): así una búsqueda con
  // debounce no pisa un chip o el período elegidos mientras tanto.
  const updateParams = useCallback(
    (changes) => {
      const next = new URLSearchParams(window.location.search)
      for (const [key, value] of Object.entries(changes)) {
        const name = PARAMS[key] ?? key
        const text = typeof value === 'string' ? value.trim() : value
        if (text === '' || text === null || text === undefined) next.delete(name)
        else next.set(name, String(text))
      }
      const query = next.toString()
      const nextSearch = query ? `?${query}` : ''
      if (nextSearch === window.location.search) return
      navigate({ search: nextSearch }, { replace: true })
    },
    [navigate],
  )

  // --- Búsqueda con debounce --------------------------------------------------------------
  const [searchText, setSearchText] = useState(search)
  const [syncedSearch, setSyncedSearch] = useState(search)
  const timerRef = useRef(null)

  // La URL cambió por fuera (Limpiar filtros, atrás/adelante): el input la refleja.
  if (search !== syncedSearch) {
    setSyncedSearch(search)
    if (searchText.trim() !== search) setSearchText(search)
  }

  const changeSearchText = useCallback(
    (value) => {
      setSearchText(value)
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => updateParams({ search: value }), SEARCH_DEBOUNCE_MS)
    },
    [updateParams],
  )

  /** Aplica la búsqueda ya (Enter o botón ×) sin esperar el debounce. */
  const commitSearch = useCallback(
    (value) => {
      window.clearTimeout(timerRef.current)
      updateParams({ search: typeof value === 'string' ? value : searchText })
    },
    [searchText, updateParams],
  )

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const setFilter = useCallback((key, value) => updateParams({ [key]: value }), [updateParams])

  const clearFilters = useCallback(() => {
    window.clearTimeout(timerRef.current)
    setSearchText('')
    updateParams(Object.fromEntries(Object.keys(PARAMS).map((key) => [key, ''])))
  }, [updateParams])

  /** `?cuenta=<nombre>` (enlace antiguo) → `?cuenta=<id>` cuando ya se conocen las cuentas. */
  const resolveAccountName = useCallback(
    (accounts) => {
      if (!cuentaName || !accounts) return
      const target = cuentaName.toLocaleLowerCase('es')
      const match = accounts.find((account) => String(account.nombre).toLocaleLowerCase('es') === target)
      updateParams({ cuenta: match ? String(match.id) : '' })
    },
    [cuentaName, updateParams],
  )

  const activeCount = [tipo, categoria, cuentaParam, search].filter(Boolean).length

  // Lo que se envía al backend (mismo objeto mientras no cambien los valores).
  const apiFilters = useMemo(
    () => ({ mes: period, tipo, categoria, cuenta_id: cuentaId, search }),
    [period, tipo, categoria, cuentaId, search],
  )

  return {
    period,
    tipo,
    categoria,
    cuentaId,
    cuentaName,
    search,
    searchText,
    searchPending: searchText.trim() !== search,
    setSearchText: changeSearchText,
    commitSearch,
    setFilter,
    clearFilters,
    resolveAccountName,
    activeCount,
    hasFilters: activeCount > 0,
    apiFilters,
  }
}
