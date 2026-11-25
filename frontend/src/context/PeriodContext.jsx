import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApiResource } from '../hooks/useApiResource'
import { periodsApi } from '../lib/api/periods'
import { currentMonth, isValidMonth, monthLabel, shiftMonth } from '../lib/period'

export { currentMonth, monthLabel, shiftMonth } from '../lib/period'

const PERIOD_PARAM = 'mes'
const PeriodContext = createContext(null)

// Fuente de opciones del selector. Para usar el backend cambia `periodsApi.list` (lib/api/periods.js).
const loadPeriodOptions = ({ signal }) => periodsApi.list({ signal })

function normalizeOptions(raw) {
  const list = Array.isArray(raw) ? raw : raw?.items ?? raw?.periodos ?? []
  return list
    .map((item) => (typeof item === 'string' ? { value: item, label: monthLabel(item) } : item))
    .filter((item) => isValidMonth(item?.value))
    .map((item) => ({ value: item.value, label: item.label || monthLabel(item.value) }))
}

/**
 * Período (mes AAAA-MM) seleccionado en toda el área privada.
 * - Por defecto: mes actual en America/Lima.
 * - Sincronizado con `?mes=` en la URL (los enlaces se pueden compartir y el botón atrás funciona).
 * - Si navegas a una ruta sin `?mes=`, se conserva el último período elegido.
 */
export function PeriodProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultPeriod = useMemo(() => currentMonth(), [])
  const urlValue = searchParams.get(PERIOD_PARAM)
  const urlPeriod = isValidMonth(urlValue) ? urlValue : null
  const [stickyPeriod, setStickyPeriod] = useState(urlPeriod || defaultPeriod)

  const period = urlPeriod || stickyPeriod

  useEffect(() => {
    if (urlPeriod && urlPeriod !== stickyPeriod) setStickyPeriod(urlPeriod)
  }, [urlPeriod, stickyPeriod])

  // La URL no trae (o trae inválido) ?mes=: reponemos el período vigente sin crear otra entrada en el historial.
  useEffect(() => {
    if (urlPeriod) return
    const needsParam = stickyPeriod !== defaultPeriod
    if (!needsParam && urlValue === null) return
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        if (needsParam) next.set(PERIOD_PARAM, stickyPeriod)
        else next.delete(PERIOD_PARAM)
        return next
      },
      { replace: true },
    )
  }, [urlPeriod, urlValue, stickyPeriod, defaultPeriod, setSearchParams])

  const setPeriod = useCallback(
    (value) => {
      if (!isValidMonth(value)) return
      setStickyPeriod(value)
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params)
          if (value === defaultPeriod) next.delete(PERIOD_PARAM)
          else next.set(PERIOD_PARAM, value)
          return next
        },
        { replace: true },
      )
    },
    [defaultPeriod, setSearchParams],
  )

  const optionsResource = useApiResource(loadPeriodOptions, [], { cacheKey: 'periods' })

  const options = useMemo(() => {
    const list = normalizeOptions(optionsResource.data)
    const base = list.length ? list : [{ value: defaultPeriod, label: monthLabel(defaultPeriod) }]
    // Un ?mes= fuera del rango (enlace antiguo, flechas de Presupuestos) igual debe poder mostrarse.
    if (!base.some((option) => option.value === period)) {
      return [...base, { value: period, label: monthLabel(period) }].sort((a, b) => b.value.localeCompare(a.value))
    }
    return base
  }, [optionsResource.data, period, defaultPeriod])

  const value = useMemo(
    () => ({
      period,
      setPeriod,
      options,
      defaultPeriod,
      isCurrentPeriod: period === defaultPeriod,
      label: monthLabel(period),
      shortLabel: monthLabel(period, { short: true }),
      /** Query string para enlaces que deben conservar el período: `to={{ pathname, search }}`. */
      search: period === defaultPeriod ? '' : `?${PERIOD_PARAM}=${period}`,
    }),
    [period, setPeriod, options, defaultPeriod],
  )

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}

/** `const { period, setPeriod, label, options } = usePeriod()` */
export function usePeriod() {
  const context = useContext(PeriodContext)
  if (!context) throw new Error('usePeriod debe usarse dentro de PeriodProvider')
  return context
}

/** Desplaza el período seleccionado n meses (−1 = anterior). */
export function useShiftPeriod() {
  const { period, setPeriod } = usePeriod()
  return useCallback((offset) => setPeriod(shiftMonth(period, offset)), [period, setPeriod])
}
