import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useConfirm, useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { usePreferences } from '../../context/PreferencesContext'
import { useApiResource } from '../../hooks/useApiResource'
import { useMoney } from '../../hooks/useMoney'
import { goalsApi } from '../../lib/api/goals'
import { DEPOSIT, formatGoalDate, GOAL_MUTATION_TAGS, HIGHLIGHT_PARAM } from './goalModel'

const GOALS_TAG = ['goals']

/** Metas activas o archivadas con el resumen. Se recarga con invalidate('goals'). */
export function useGoals(estado) {
  return useApiResource(({ signal }) => goalsApi.list({ estado, signal }), [estado], {
    tags: GOALS_TAG,
    cacheKey: `goals:${estado}`,
  })
}

/** Una meta con su historial y la serie mensual. Con `id` nulo no pide nada. */
export function useGoalDetail(id) {
  return useApiResource(({ signal }) => (id ? goalsApi.detail(id, { signal }) : Promise.resolve(null)), [id], {
    tags: GOALS_TAG,
  })
}

/** Id del elemento de la tarjeta de una meta (para enlazar y desplazarse hasta ella). */
export function goalElementId(id) {
  return `meta-${id}`
}

/**
 * Acciones sin formulario: archivar/restaurar, eliminar una meta y eliminar un aporte o retiro.
 * Cada una confirma (si corresponde), avisa con un toast e invalida metas, alertas y Resumen.
 * `pending` = { type, id } mientras hay una en curso.
 */
export function useGoalActions() {
  const invalidate = useInvalidate()
  const toast = useToast()
  const confirm = useConfirm()
  const { money } = useMoney()
  const { showAmounts } = usePreferences()
  const [pending, setPending] = useState(null)
  const busyRef = useRef(false)

  const run = useCallback(
    async (marker, task, fallbackError) => {
      if (busyRef.current) return false
      busyRef.current = true
      setPending(marker)
      try {
        await task()
        return true
      } catch (error) {
        toast.error(error?.status === 404 ? 'Esa meta ya no existe.' : error?.message || fallbackError)
        return false
      } finally {
        busyRef.current = false
        setPending(null)
        invalidate(GOAL_MUTATION_TAGS)
      }
    },
    [invalidate, toast],
  )

  const setArchived = useCallback(
    async (goal, archived) => {
      if (archived) {
        const ok = await confirm({
          title: `¿Archivar «${goal.nombre}»?`,
          message:
            'Dejará de aparecer entre tus metas activas y en el Resumen, y no te enviaremos alertas de ella. Su historial se conserva y puedes restaurarla cuando quieras.',
          confirmLabel: 'Archivar meta',
        })
        if (!ok) return false
      }
      return run(
        { type: 'archive', id: goal.id },
        async () => {
          await goalsApi.update(goal.id, { archived })
          toast.success(archived ? `Archivaste «${goal.nombre}».` : `Restauraste «${goal.nombre}».`)
        },
        'No se pudo actualizar la meta.',
      )
    },
    [confirm, run, toast],
  )

  const remove = useCallback(
    async (goal) => {
      const ok = await confirm({
        title: `¿Eliminar «${goal.nombre}»?`,
        message:
          'Se borrará la meta con todo su historial de aportes y retiros. Tus cuentas y movimientos no cambian. Si solo quieres dejar de verla, archívala.',
        confirmLabel: 'Eliminar meta',
        tone: 'danger',
      })
      if (!ok) return false
      return run(
        { type: 'delete', id: goal.id },
        async () => {
          await goalsApi.remove(goal.id)
          toast.success(`Eliminaste la meta «${goal.nombre}».`)
        },
        'No se pudo eliminar la meta.',
      )
    },
    [confirm, run, toast],
  )

  const removeMovement = useCallback(
    async (goal, movement) => {
      const noun = movement.tipo === DEPOSIT ? 'aporte' : 'retiro'
      const amount = showAmounts ? ` de ${money(movement.monto)}` : ''
      const ok = await confirm({
        title: `¿Eliminar este ${noun}?`,
        message: `Se quitará el ${noun}${amount} del ${formatGoalDate(movement.fecha)} del historial de «${goal.nombre}». No afecta tus cuentas.`,
        confirmLabel: `Eliminar ${noun}`,
        tone: 'danger',
      })
      if (!ok) return false
      return run(
        { type: 'movement', id: movement.id },
        async () => {
          await goalsApi.removeMovement(goal.id, movement.id)
          toast.success(`Eliminaste el ${noun}.`)
        },
        `No se pudo eliminar el ${noun}.`,
      )
    },
    [confirm, money, run, showAmounts, toast],
  )

  return { pending, setArchived, remove, removeMovement }
}

const HIGHLIGHT_MS = 3200
const SCROLL_DELAY_MS = 160

/**
 * `?meta=<id>` (enlaces de Alertas y del Resumen): cuando cargan las metas activas, desplaza la vista
 * hasta esa tarjeta, la resalta unos segundos y quita el parámetro de la URL.
 */
export function useGoalHighlight({ items, ready }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get(HIGHLIGHT_PARAM)
  const [highlightId, setHighlightId] = useState(null)
  const toast = useToast()

  useEffect(() => {
    if (!requested || !ready) return
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        next.delete(HIGHLIGHT_PARAM)
        return next
      },
      { replace: true },
    )
    const found = (items ?? []).find((item) => String(item.id) === requested)
    if (found) setHighlightId(found.id)
    else toast.info('Esa meta ya no está entre tus metas activas.')
  }, [requested, ready, items, setSearchParams, toast])

  useEffect(() => {
    if (highlightId === null) return undefined
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scrollTimer = window.setTimeout(() => {
      const element = document.getElementById(goalElementId(highlightId))
      element?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
      element?.focus({ preventScroll: true })
    }, SCROLL_DELAY_MS)
    const clearTimer = window.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS)
    return () => {
      window.clearTimeout(scrollTimer)
      window.clearTimeout(clearTimer)
    }
  }, [highlightId])

  return { highlightId, requested }
}
