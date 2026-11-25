import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CURRENT_YEAR, DEFAULT_YEAR, parseAmount, parseYear, sameAmount } from './taxRules'

const DEBOUNCE_MS = 400

/** '?proyectar=1' → true · '?proyectar=0' → false · ausente u otro valor → null (por defecto: proyectar). */
function parseProjectChoice(value) {
  if (value === '1') return true
  if (value === '0') return false
  return null
}

/**
 * Controles de la pantalla de impuestos guardados en la URL:
 *   ?anio=2025        año (se omite si es el año por defecto)
 *   ?ingreso=60000    modo "Simular un ingreso" (presente aunque esté vacío: `?ingreso=`)
 *   ?deducciones=0    deducciones adicionales (opcional)
 *   ?proyectar=0|1    año en curso con "Mis ingresos registrados": solo lo registrado (0) o el año
 *                     completo proyectado (1). Sin el parámetro se proyecta (la opción por defecto).
 *
 * `forceSimulate` (moneda distinta de PEN) fija el modo "Simular un ingreso": los movimientos no están
 * en soles y no sirven para el impuesto peruano.
 *
 * Los inputs de montos trabajan sobre un borrador local que se escribe en la URL 400 ms después
 * de la última tecla; la consulta a la API sale siempre de la URL. `?mes=` y otros parámetros
 * se conservan.
 */
export function useTaxParams({ forceSimulate = false } = {}) {
  const [searchParams, setSearchParams] = useSearchParams()

  const yearParam = parseYear(searchParams.get('anio'))
  const year = yearParam ?? DEFAULT_YEAR
  const simulate = forceSimulate || searchParams.has('ingreso')
  const incomeParam = searchParams.get('ingreso') ?? ''
  const deductionsParam = searchParams.get('deducciones') ?? ''
  const projectChoice = parseProjectChoice(searchParams.get('proyectar'))
  const project = projectChoice !== false

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
    latest.current = { searchParams, setSearchParams, year, simulate, incomeDraft, deductionsDraft, projectChoice }
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

    if (state.projectChoice === null || state.projectChoice === undefined) next.delete('proyectar')
    else next.set('proyectar', state.projectChoice ? '1' : '0')

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

  /** Año en curso: `true` proyecta el año completo, `false` usa solo lo registrado hasta hoy. */
  const setProject = useCallback((value) => commit({ projectChoice: Boolean(value) }), [commit])

  const income = parseAmount(incomeParam)
  const deductions = parseAmount(deductionsParam)
  const incomeText = income.text
  const deductionsText = deductions.text
  const waitingForIncome = simulate && !incomeText
  const projectable = !simulate && year === CURRENT_YEAR

  // Parámetros para la API (null = falta el ingreso a simular, no se consulta).
  const query = useMemo(() => {
    if (waitingForIncome) return null
    return {
      anio: year,
      ingreso_anual: simulate ? incomeText : undefined,
      deducciones_adicionales: deductionsText,
      proyectar: projectable && project ? 1 : undefined,
    }
  }, [waitingForIncome, year, simulate, incomeText, deductionsText, projectable, project])

  const incomeDraftParsed = parseAmount(incomeDraft)
  const deductionsDraftParsed = parseAmount(deductionsDraft)

  return {
    year,
    yearFromUrl: yearParam,
    simulate,
    simulateLocked: forceSimulate,
    /** El año elegido es el actual y el ingreso sale de los movimientos: aplica la proyección. */
    projectable,
    project,
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
    setProject,
  }
}
