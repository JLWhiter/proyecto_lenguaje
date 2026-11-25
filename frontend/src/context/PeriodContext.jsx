import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApiResource } from '../hooks/useApiResource'
import { periodsApi } from '../lib/api/periods'
import { currentMonth, isValidMonth, monthLabel, shiftMonth } from '../lib/period'

export { currentMonth, monthLabel, shiftMonth } from '../lib/period'

const PERIOD_PARAM = 'mes'
const PeriodContext = createContext(null)

// Fuente de opciones del selector: GET /periodos/ con respaldo en el cliente (lib/api/periods.js).
const loadPeriodOptions = ({ signal }) => periodsApi.list({ signal })

/**
 * Escribe `?mes=` partiendo de la URL ACTUAL (window.location), no de los params del último render:
 * así no se pierden parámetros que otra pantalla acaba de escribir (p. ej. ?tipo=&categoria= en Movimientos).
 */
function writePeriodParam(setSearchParams, value, defaultPeriod) {
  const next = new URLSearchParams(window.location.search)
  if (value === defaultPeriod) next.delete(PERIOD_PARAM)
  else next.set(PERIOD_PARAM, value)
  setSearchParams(next, { replace: true })
}

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
 * - Como máximo el mes siguiente al actual (`maxPeriod`): un ?mes= posterior se ignora.
 */
export function PeriodProvider({ children }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const defaultPeriod = useMemo(() => currentMonth(), [])
  const maxPeriod = useMemo(() => shiftMonth(defaultPeriod, 1), [defaultPeriod])
  const isAllowed = useCallback((value) => isValidMonth(value) && value <= maxPeriod, [maxPeriod])
  const urlValue = searchParams.get(PERIOD_PARAM)
  const urlPeriod = isAllowed(urlValue) ? urlValue : null
  const [stickyPeriod, setStickyPeriod] = useState(urlPeriod || defaultPeriod)
  const [seenUrlPeriod, setSeenUrlPeriod] = useState(urlPeriod)

  // El ?mes= de la URL manda, pero solo cuando la URL CAMBIA (enlace, atrás/adelante). Comparar con
  // stickyPeriod en cada render no sirve: el router aplica la URL nueva dentro de una transición y,
  // mientras tanto, el ?mes= viejo revertiría el período recién elegido (al volver al mes actual se
  // reescribía el mes anterior en la URL).
  if (urlPeriod !== seenUrlPeriod) {
    setSeenUrlPeriod(urlPeriod)
    if (urlPeriod) setStickyPeriod(urlPeriod)
  }

  const period = urlPeriod || stickyPeriod

  // La URL no trae (o trae inválido) ?mes=: reponemos el período vigente sin crear otra entrada en el historial.
  useEffect(() => {
    if (urlPeriod) return
    const needsParam = stickyPeriod !== defaultPeriod
    if (!needsParam && urlValue === null) return
    writePeriodParam(setSearchParams, stickyPeriod, defaultPeriod)
  }, [urlPeriod, urlValue, stickyPeriod, defaultPeriod, setSearchParams])

  const setPeriod = useCallback(
    (value) => {
      if (!isAllowed(value)) return
      setStickyPeriod(value)
      writePeriodParam(setSearchParams, value, defaultPeriod)
    },
    [isAllowed, defaultPeriod, setSearchParams],
  )

  // Se recarga al registrar movimientos o presupuestos (puede aparecer un mes nuevo en la lista).
  const optionsResource = useApiResource(loadPeriodOptions, [], { cacheKey: 'periods', tags: ['transactions', 'budgets'] })

  const options = useMemo(() => {
    const list = normalizeOptions(optionsResource.data).filter((option) => option.value <= maxPeriod)
    const base = list.length ? list : [{ value: defaultPeriod, label: monthLabel(defaultPeriod) }]
    // El período elegido siempre figura entre las opciones aunque el backend no lo liste
    // (mes siguiente desde Presupuestos, ?mes= de un enlace compartido, mes sin datos).
    if (!base.some((option) => option.value === period)) {
      return [...base, { value: period, label: monthLabel(period) }].sort((a, b) => b.value.localeCompare(a.value))
    }
    return base
  }, [optionsResource.data, period, defaultPeriod, maxPeriod])

  const value = useMemo(
    () => ({
      period,
      setPeriod,
      options,
      defaultPeriod,
      /** Último mes seleccionable (el siguiente al actual). */
      maxPeriod,
      isCurrentPeriod: period === defaultPeriod,
      label: monthLabel(period),
      shortLabel: monthLabel(period, { short: true }),
      /** Query string para enlaces que deben conservar el período: `to={{ pathname, search }}`. */
      search: period === defaultPeriod ? '' : `?${PERIOD_PARAM}=${period}`,
    }),
    [period, setPeriod, options, defaultPeriod, maxPeriod],
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
