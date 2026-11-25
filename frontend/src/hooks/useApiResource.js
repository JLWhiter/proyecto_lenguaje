import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isAbortError } from '../lib/api'
import { useResourceCache, useResourceVersionKey } from '../context/FinanceDataContext'

function initialState(key, cached) {
  return cached !== undefined
    ? { key, data: cached, status: 'ready', error: null, refreshing: true }
    : { key, data: undefined, status: 'loading', error: null, refreshing: false }
}

/**
 * Carga datos de la API con cancelación (AbortController) y recarga por invalidación.
 *
 *   const accounts = useApiResource(({ signal }) => accountsApi.list({ signal }), [], {
 *     tags: ['accounts'],      // se recarga cuando alguien llama invalidate('accounts')
 *     cacheKey: 'accounts',    // opcional: comparte la última respuesta con otros consumidores
 *   })
 *   accounts.status  // 'loading' | 'ready' | 'error'
 *   accounts.data    // respuesta (undefined mientras carga por primera vez)
 *   accounts.error   // ApiError | null
 *   accounts.reload()
 *
 * - Si cambian los `deps` (p. ej. el período) se descartan los datos anteriores → 'loading'.
 * - Si cambia un tag o llamas `reload()` se recarga en segundo plano: `data` se mantiene
 *   y `refreshing` es true. Si esa recarga falla, `status` sigue 'ready' y `error` trae el error.
 * - `status === 'error'` solo cuando no hay datos que mostrar (usa <ErrorState onRetry={reload} />).
 */
export function useApiResource(loader, deps = [], { tags = [], cacheKey } = {}) {
  const depsKey = JSON.stringify(deps)
  const versionKey = useResourceVersionKey(tags)
  const cache = useResourceCache()
  const loaderRef = useRef(loader)
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState(() => initialState(depsKey, cacheKey ? cache?.readCache(cacheKey) : undefined))

  useLayoutEffect(() => {
    loaderRef.current = loader
  })

  let current = state
  if (state.key !== depsKey) {
    // Cambiaron los parámetros: no mostramos datos de otro período ni por un frame.
    current = initialState(depsKey, cacheKey ? cache?.readCache(cacheKey) : undefined)
    setState(current)
  }

  useEffect(() => {
    const controller = new AbortController()
    setState((previous) => {
      if (previous.data === undefined) {
        return previous.status === 'loading' ? previous : { ...previous, status: 'loading', error: null }
      }
      return previous.refreshing ? previous : { ...previous, refreshing: true }
    })

    Promise.resolve()
      .then(() => loaderRef.current({ signal: controller.signal }))
      .then((data) => {
        if (controller.signal.aborted) return
        if (cacheKey) cache?.writeCache(cacheKey, data)
        setState({ key: depsKey, data, status: 'ready', error: null, refreshing: false })
      })
      .catch((error) => {
        if (controller.signal.aborted || isAbortError(error)) return
        setState((previous) =>
          previous.data !== undefined && previous.key === depsKey
            ? { ...previous, error, refreshing: false }
            : { key: depsKey, data: undefined, status: 'error', error, refreshing: false },
        )
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, versionKey, nonce, cacheKey])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  return { data: current.data, status: current.status, error: current.error, refreshing: current.refreshing, reload }
}
