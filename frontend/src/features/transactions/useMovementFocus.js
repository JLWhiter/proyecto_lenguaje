import { useEffect, useState } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery'

export const MOVEMENT_PARAM = 'movimiento'
const HIGHLIGHT_MS = 3000
const ID_PATTERN = /^\d+$/

/**
 * `?movimiento=<id>` (p. ej. «Revisar gasto» de una alerta de gasto inusual):
 * 1. Se lee el id y se quita el parámetro de la URL (los filtros y el `?mes=` se conservan).
 * 2. Cuando la lista está al día, si el movimiento está entre lo cargado: se desplaza hasta su fila,
 *    la enfoca y la resalta ~3 s (`highlightId`).
 * 3. Si no está, `missing` es true (la pantalla muestra un aviso). Si después se cargan más páginas
 *    o cambian los filtros y aparece, se resalta igual.
 *
 *   const focus = useMovementFocus(searchParams.get('movimiento'), feed, filters.setFilter)
 *   focus.highlightId · focus.missing · focus.dismiss()
 */
export function useMovementFocus(param, feed, setFilter) {
  const [target, setTarget] = useState(null) // { id, missing }
  const [highlightId, setHighlightId] = useState(null)
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const requested = String(param ?? '').trim()

  useEffect(() => {
    if (!requested) return
    setTarget(ID_PATTERN.test(requested) ? { id: requested, missing: false } : null)
    setFilter(MOVEMENT_PARAM, '')
  }, [requested, setFilter])

  const ready = feed.status === 'ready' && !feed.stale && !feed.refreshing && !feed.loadingMore
  const found = Boolean(target && ready && feed.groups.some((group) => group.items.some((item) => String(item.id) === target.id)))

  useEffect(() => {
    if (!target || !ready) return
    if (found) {
      setHighlightId(target.id)
      setTarget(null)
    } else if (!target.missing) {
      setTarget({ ...target, missing: true })
    }
  }, [target, ready, found])

  useEffect(() => {
    if (!highlightId) return undefined
    const row = document.querySelector(`[data-movement-id="${highlightId}"]`)
    row?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
    // El foco va a la fila: el lector de pantalla lee el movimiento y Enter abre su detalle.
    row?.querySelector('button')?.focus({ preventScroll: true })
    const timer = window.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS)
    return () => window.clearTimeout(timer)
  }, [highlightId, reduceMotion])

  return {
    highlightId,
    missing: Boolean(target?.missing),
    dismiss: () => setTarget(null),
  }
}
