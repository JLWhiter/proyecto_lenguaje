import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useConfirm, useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { usePreferences } from '../../context/PreferencesContext'
import { useApiResource } from '../../hooks/useApiResource'
import { useMoney } from '../../hooks/useMoney'
import { budgetsApi } from '../../lib/api/budgets'
import { categoriesApi } from '../../lib/api/categories'
import { toNumber } from '../../lib/format'
import { monthLabel } from '../../lib/period'
import { BUDGET_MUTATION_TAGS, HIGHLIGHT_PARAM } from './budgetModel'

/**
 * Presupuestos del mes `period` (AAAA-MM). Se recarga con invalidate('budgets').
 * Con `enabled: false` no pide nada (data = null) y no toca la caché compartida.
 */
export function useBudgets(period, { enabled = true } = {}) {
  return useApiResource(
    ({ signal }) => (enabled ? budgetsApi.list({ mes: period, signal }) : Promise.resolve(null)),
    [period, enabled],
    { tags: ['budgets'], cacheKey: enabled ? `budgets:${period}` : undefined },
  )
}

/** Nombres de categorías de gasto (ordenadas por uso) para sugerir al crear o editar un presupuesto. */
export function useExpenseCategories() {
  const resource = useApiResource(({ signal }) => categoriesApi.list({ signal }), [], {
    tags: ['transactions', 'budgets'],
    cacheKey: 'categories',
  })
  const names = useMemo(
    () =>
      (resource.data?.categorias ?? [])
        .filter((item) => !Array.isArray(item.tipos) || item.tipos.length === 0 || item.tipos.includes('GASTO'))
        .map((item) => item.nombre)
        .filter(Boolean),
    [resource.data],
  )
  return { names, ready: resource.status === 'ready' }
}

/**
 * Acciones de la pantalla que no necesitan formulario: eliminar, copiar el mes anterior y
 * aplicar la sugerencia del análisis. Cada una confirma (si corresponde), invalida y avisa.
 * `pending` = { type: 'delete' | 'copy' | 'apply', id? } mientras hay una en curso.
 */
export function useBudgetActions({ period, periodLabel }) {
  const invalidate = useInvalidate()
  const toast = useToast()
  const confirm = useConfirm()
  const { money } = useMoney()
  const { showAmounts } = usePreferences()
  const [pending, setPending] = useState(null)
  const busyRef = useRef(false)

  const run = useCallback(async (marker, task) => {
    if (busyRef.current) return false
    busyRef.current = true
    setPending(marker)
    try {
      return await task()
    } finally {
      busyRef.current = false
      setPending(null)
    }
  }, [])

  const remove = useCallback(
    async (budget) => {
      const ok = await confirm({
        title: `¿Eliminar el presupuesto de «${budget.nombre}»?`,
        message: `Se quitará el límite de ${budget.nombre} en ${periodLabel}. Tus movimientos no se borran y puedes volver a crearlo cuando quieras.`,
        confirmLabel: 'Eliminar presupuesto',
        tone: 'danger',
      })
      if (!ok) return false
      return run({ type: 'delete', id: budget.id }, async () => {
        try {
          await budgetsApi.remove(budget.id)
          toast.success(`Eliminaste el presupuesto de ${budget.nombre}.`)
          return true
        } catch (error) {
          toast.error(error?.status === 404 ? 'Ese presupuesto ya no existía.' : error?.message || 'No se pudo eliminar el presupuesto.')
          return false
        } finally {
          invalidate(BUDGET_MUTATION_TAGS)
        }
      })
    },
    [confirm, invalidate, periodLabel, run, toast],
  )

  const copyFrom = useCallback(
    (sourceMonth) =>
      run({ type: 'copy' }, async () => {
        const sourceLabel = monthLabel(sourceMonth)
        try {
          const result = await budgetsApi.copy({ month: period, source_month: sourceMonth })
          invalidate(BUDGET_MUTATION_TAGS)
          const copied = toNumber(result?.copiados)
          const skipped = toNumber(result?.omitidos)
          if (copied === 0 && skipped === 0) {
            toast.info(`${sourceLabel} no tiene presupuestos para copiar.`)
          } else if (copied === 0) {
            toast.info(`${periodLabel} ya tiene todas las categorías de ${sourceLabel}: no se copió nada.`)
          } else {
            const skippedText =
              skipped === 0 ? '' : skipped === 1 ? ' Se omitió 1 que ya existía en este mes.' : ` Se omitieron ${skipped} que ya existían en este mes.`
            toast.success(`${result?.message || `Se copiaron ${copied} presupuestos de ${sourceLabel}.`}${skippedText}`)
          }
          return true
        } catch (error) {
          toast.error(error?.message || 'No se pudieron copiar los presupuestos.')
          return false
        }
      }),
    [invalidate, period, periodLabel, run, toast],
  )

  const applySuggestion = useCallback(
    async (action) => {
      if (!action) return false
      const { type: _type, ...payload } = action
      const amountText = showAmounts ? money(payload.amount) : 'el monto sugerido'
      const ok = await confirm({
        title: 'Aplicar sugerencia',
        message: `Se ${showAmounts ? 'moverán' : 'moverá'} ${amountText} del límite de ${payload.source_category} al de ${payload.target_category} en ${periodLabel}. Tu total asignado no cambia y podrás ajustarlo después.`,
        confirmLabel: 'Mover saldo',
      })
      if (!ok) return false
      return run({ type: 'apply' }, async () => {
        try {
          await budgetsApi.rebalance({ month: period, ...payload })
          toast.success(`Listo: moviste ${amountText} de ${payload.source_category} a ${payload.target_category}.`)
          return true
        } catch (error) {
          toast.error(error?.message || 'No se pudo aplicar la sugerencia.')
          return false
        } finally {
          invalidate(BUDGET_MUTATION_TAGS)
        }
      })
    },
    [confirm, invalidate, money, period, periodLabel, run, showAmounts, toast],
  )

  return { pending, remove, copyFrom, applySuggestion }
}

const HIGHLIGHT_MS = 3200

/**
 * `?presupuesto=<id>` (enlaces de Alertas y del Resumen): cuando cargan los datos del mes,
 * desplaza la vista hasta esa tarjeta, la resalta unos segundos y quita el parámetro de la URL.
 * `onReveal(budget)` permite, por ejemplo, limpiar un filtro que la ocultaba.
 */
export function useBudgetHighlight({ items, ready, periodLabel, onReveal }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get(HIGHLIGHT_PARAM)
  const [highlightId, setHighlightId] = useState(null)
  const toast = useToast()
  const onRevealRef = useRef(onReveal)

  useEffect(() => {
    onRevealRef.current = onReveal
  })

  useEffect(() => {
    if (!requested || !ready) return
    const found = (items ?? []).find((item) => String(item.id) === requested)
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        next.delete(HIGHLIGHT_PARAM)
        return next
      },
      { replace: true },
    )
    if (!found) {
      toast.info(`Ese presupuesto ya no existe en ${periodLabel}.`)
      return
    }
    onRevealRef.current?.(found)
    setHighlightId(found.id)
  }, [requested, ready, items, periodLabel, setSearchParams, toast])

  useEffect(() => {
    if (highlightId === null) return undefined
    // Espera a que la tarjeta esté pintada (y a que el layout termine su scroll al inicio).
    const scrollTimer = window.setTimeout(() => {
      const element = document.getElementById(`presupuesto-${highlightId}`)
      if (!element) return
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
      element.focus({ preventScroll: true })
    }, 160)
    const clearTimer = window.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS)
    return () => {
      window.clearTimeout(scrollTimer)
      window.clearTimeout(clearTimer)
    }
  }, [highlightId])

  return highlightId
}
