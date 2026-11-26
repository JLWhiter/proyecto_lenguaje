import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useResourceVersionKey } from '../../context/FinanceDataContext'
import { useApiResource } from '../../hooks/useApiResource'
import { isAbortError } from '../../lib/api'
import { categoriesApi } from '../../lib/api/categories'
import { transactionsApi } from '../../lib/api/transactions'

/** Recursos afectados por crear/editar/eliminar un movimiento, transferir o depositar. */
export const MONEY_MOVEMENT_TAGS = ['transactions', 'accounts', 'dashboard', 'budgets', 'alerts']

export const PAGE_SIZE = 50
const FEED_TAGS = ['transactions']

/** Movimientos agrupados del mes `period` (sin filtros ni paginación). Se recarga con invalidate('transactions'). */
export function useTransactions(period) {
  return useApiResource(({ signal }) => transactionsApi.list({ mes: period, signal }), [period], {
    tags: FEED_TAGS,
    cacheKey: `transactions:${period}`,
  })
}

/** Catálogo de categorías (ordenado por uso). Cambia cuando se registran movimientos. */
export function useCategories() {
  return useApiResource(({ signal }) => categoriesApi.list({ signal }), [], {
    tags: FEED_TAGS,
    cacheKey: 'categories',
  })
}

/**
 * Une páginas del listado en una sola lista de grupos por día. Un día puede quedar partido
 * entre dos páginas: se unen sus movimientos (el total del día ya viene completo del backend).
 * Se descartan ids repetidos por si la lista cambió entre una página y otra.
 */
export function mergePages(pages) {
  const seen = new Set()
  const groups = []
  const byDate = new Map()
  for (const page of pages) {
    for (const group of page?.grupos ?? []) {
      const items = (group.items ?? []).filter((item) => {
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
      })
      const key = group.fecha || group.titulo
      const existing = byDate.get(key)
      if (existing) {
        existing.items.push(...items)
      } else if (items.length > 0) {
        const merged = { ...group, items: [...items] }
        byDate.set(key, merged)
        groups.push(merged)
      }
    }
  }
  return { groups, loaded: seen.size }
}

function emptyState(key, previous = null) {
  return { key, pages: [], previous, status: 'loading', error: null, refreshing: false, loadingMore: false, moreError: null }
}

/**
 * Listado paginado con "Cargar más".
 *
 *   const feed = useTransactionFeed({ mes, tipo, categoria, cuenta_id, search })
 *   feed.status              // 'loading' | 'ready' | 'error'
 *   feed.stale               // true: se muestran resultados del filtro anterior mientras carga el nuevo
 *   feed.summary             // { total_ingresos, total_gastos, neto, count, page, pages } (de la última página)
 *   feed.groups              // grupos por día ya unidos
 *   feed.hasMore / feed.loadMore() / feed.loadingMore / feed.moreError
 *
 * `useApiResource` maneja una sola respuesta; aquí se acumulan páginas. Usa los mismos tags:
 * tras `invalidate('transactions')` se vuelven a pedir TODAS las páginas ya mostradas, así la
 * lista no se recorta ni queda desactualizada después de editar o eliminar un movimiento.
 */
export function useTransactionFeed(filters) {
  const filterKey = JSON.stringify(filters)
  const versionKey = useResourceVersionKey(FEED_TAGS)
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState(() => emptyState(filterKey))
  const stateRef = useRef(state)
  const moreRef = useRef(null)

  let current = state
  if (state.key !== filterKey) {
    // Cambiaron los filtros: mientras llega la respuesta se muestra el resultado anterior atenuado
    // (`stale`) en lugar de un esqueleto en cada tecla o chip.
    current = emptyState(filterKey, state.pages.length > 0 ? state.pages : state.previous)
    setState(current)
  }

  useLayoutEffect(() => {
    stateRef.current = current
  })

  useEffect(() => {
    const controller = new AbortController()
    const params = JSON.parse(filterKey)
    const known = stateRef.current.key === filterKey ? stateRef.current.pages.length : 0
    const count = Math.max(1, known)
    moreRef.current?.abort()

    setState((previous) => {
      if (previous.key !== filterKey) return previous
      if (previous.pages.length === 0) return previous.status === 'loading' ? previous : { ...previous, status: 'loading', error: null }
      return { ...previous, refreshing: true, loadingMore: false, moreError: null }
    })

    Promise.all(
      Array.from({ length: count }, (_, index) =>
        transactionsApi.list({ ...params, page: index + 1, page_size: PAGE_SIZE, signal: controller.signal }),
      ),
    )
      .then((pages) => {
        if (controller.signal.aborted) return
        // Si la lista se achicó (p. ej. tras eliminar), se quitan las páginas que ya no existen.
        const total = pages[0]?.pages ?? 1
        const kept = pages.filter((page, index) => index === 0 || index < total)
        setState({ ...emptyState(filterKey), pages: kept, status: 'ready' })
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbortError(error)) return
        setState((previous) =>
          previous.key === filterKey && previous.pages.length > 0
            ? { ...previous, refreshing: false, error }
            : { ...emptyState(filterKey), status: 'error', error },
        )
      })

    return () => controller.abort()
  }, [filterKey, versionKey, nonce])

  useEffect(() => () => moreRef.current?.abort(), [])

  const loadMore = useCallback(() => {
    const snapshot = stateRef.current
    const last = snapshot.pages.at(-1)
    if (snapshot.status !== 'ready' || snapshot.loadingMore || snapshot.refreshing || !last || last.page >= last.pages) return

    const controller = new AbortController()
    moreRef.current?.abort()
    moreRef.current = controller
    setState((previous) => (previous.key === snapshot.key ? { ...previous, loadingMore: true, moreError: null } : previous))

    transactionsApi
      .list({ ...JSON.parse(snapshot.key), page: last.page + 1, page_size: PAGE_SIZE, signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return
        setState((previous) =>
          previous.key === snapshot.key ? { ...previous, pages: [...previous.pages, page], loadingMore: false } : previous,
        )
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbortError(error)) return
        setState((previous) => (previous.key === snapshot.key ? { ...previous, loadingMore: false, moreError: error } : previous))
      })
  }, [])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  const stale = current.status === 'loading' && current.pages.length === 0 && Boolean(current.previous?.length)
  const shown = stale ? current.previous : current.pages
  const merged = useMemo(() => mergePages(shown), [shown])
  const last = shown.at(-1)

  return {
    status: stale ? 'ready' : current.status,
    stale,
    error: current.error,
    refreshing: current.refreshing,
    summary: last ?? null,
    groups: merged.groups,
    loaded: merged.loaded,
    hasMore: !stale && Boolean(last && last.page < last.pages),
    loadMore,
    loadingMore: current.loadingMore,
    moreError: current.moreError,
    reload,
  }
}
