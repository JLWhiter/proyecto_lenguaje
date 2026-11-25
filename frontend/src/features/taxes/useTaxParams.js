import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_YEAR, parseAmount, parseYear, sameAmount } from './taxRules'

const DEBOUNCE_MS = 400

/**
 * Controles de la pantalla de impuestos guardados en la URL:
 *   ?anio=2025        año (se omite si es el año por defecto)
 *   ?ingreso=60000    modo "Simular un ingreso" (presente aunque esté vacío: `?ingreso=`)
 *   ?deducciones=0    deducciones adicionales (opcional)
 *
 * Los inputs de montos trabajan sobre un borrador local que se escribe en la URL 400 ms después
 * de la última tecla; la consulta a la API sale siempre de la URL. `?mes=` y otros parámetros
 * se conservan.
 */
export function useTaxParams() {
  const [searchParams, setSearchParams] = useSearchParams()

  const yearParam = parseYear(searchParams.get('anio'))
  const year = yearParam ?? DEFAULT_YEAR
  const simulate = searchParams.has('ingreso')
  const incomeParam = searchParams.get('ingreso') ?? ''
  const deductionsParam = searchParams.get('deducciones') ?? ''

  const [incomeDraft, setIncomeDraft] = useState(incomeParam)
  const [deductionsDraft, setDeductionsDraft] = useState(deductionsParam)

  // La URL cambió desde fuera (atrás/adelante, enlace compartido): el borrador la sigue,
  // salvo que ya represente el mismo monto (así no se pisa "600." mientras se escribe).
  // Sin `?ingreso` el borrador del ingreso se conserva para volver a "Simular" sin reescribirlo.
  const [seen, setSeen] = useState({ simulate, income: incomeParam, deductions: deductionsParam })
  if (seen.simulate !== simulate || seen.income !== incomeParam || seen.deductions !== deductionsParam) {
    setSeen({ simulate, income: incomeParam, deductions: deductionsParam })
    if (simulate && !sameAmount(incomeDraft, incomeParam)) setIncomeDraft(incomeParam)
    if (!sameAmount(deductionsDraft, deductionsParam)) setDeductionsDraft(deductionsParam)
  }

  const latest = useRef(null)
  useLayoutEffect(() => {
    latest.current = { searchParams, setSearchParams, year, simulate, incomeDraft, deductionsDraft }
  })

  /** Escribe en la URL el estado actual (más los cambios indicados) sin crear otra entrada en el historial. */
  const commit = useCallback((changes = {}) => {
    const state = { ...latest.current, ...changes }
    const next = new URLSearchParams(state.searchParams)

    if (state.year === DEFAULT_YEAR) next.delete('anio')
    else next.set('anio', String(state.year))

    if (!state.simulate) {
      next.delete('ingreso')
    } else {
      const income = parseAmount(state.incomeDraft)
      if (income.empty) next.set('ingreso', '')
      else if (!income.error) next.set('ingreso', income.text)
      else if (!next.has('ingreso')) next.set('ingreso', '')
    }

    const deductions = parseAmount(state.deductionsDraft)
    if (deductions.empty) next.delete('deducciones')
    else if (!deductions.error) next.set('deducciones', deductions.text)

    if (next.toString() !== state.searchParams.toString()) {
      state.setSearchParams(next, { replace: true })
    }
  }, [])

  // Debounce de los montos escritos a mano.
  useEffect(() => {
    const timer = window.setTimeout(() => commit(), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [incomeDraft, deductionsDraft, commit])

  const setYear = useCallback((value) => commit({ year: Number(value) }), [commit])

  const setSimulate = useCallback(
    (value, { prefill } = {}) => {
      let draft = latest.current.incomeDraft
      if (value && parseAmount(draft).empty && prefill) {
        draft = String(prefill)
        setIncomeDraft(draft)
      }
      commit({ simulate: value, incomeDraft: draft })
    },
    [commit],
  )

  const income = parseAmount(incomeParam)
  const deductions = parseAmount(deductionsParam)
  const incomeText = income.text
  const deductionsText = deductions.text
  const waitingForIncome = simulate && !incomeText

  // Parámetros para la API (null = falta el ingreso a simular, no se consulta).
  const query = useMemo(() => {
    if (waitingForIncome) return null
    return {
      anio: year,
      ingreso_anual: simulate ? incomeText : undefined,
      deducciones_adicionales: deductionsText,
    }
  }, [waitingForIncome, year, simulate, incomeText, deductionsText])

  const incomeDraftParsed = parseAmount(incomeDraft)
  const deductionsDraftParsed = parseAmount(deductionsDraft)

  return {
    year,
    yearFromUrl: yearParam,
    simulate,
    query,
    waitingForIncome,
    incomeDraft,
    setIncomeDraft,
    deductionsDraft,
    setDeductionsDraft,
    incomeDraftValue: incomeDraftParsed.value,
    deductionsDraftValue: deductionsDraftParsed.value,
    incomeInputError: simulate ? incomeDraftParsed.error : undefined,
    deductionsInputError: deductionsDraftParsed.error,
    /** Hay cambios escritos que todavía no llegan a la URL (debounce o monto inválido). */
    pending: (simulate && !sameAmount(incomeDraft, incomeParam)) || !sameAmount(deductionsDraft, deductionsParam),
    setYear,
    setSimulate,
  }
}
