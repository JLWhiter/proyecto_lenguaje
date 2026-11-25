import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

/**
 * Invalidación mínima de datos financieros.
 *
 * Cada recurso tiene un contador de versión. `useApiResource(..., { tags: ['accounts'] })`
 * vuelve a pedir sus datos cuando la versión de alguno de sus tags cambia.
 * Después de una mutación llama a `invalidate('accounts', 'dashboard')` y solo se recargan
 * las pantallas/componentes que dependen de esos recursos (incluido el header).
 *
 * También guarda en memoria la última respuesta por `cacheKey` para que un segundo consumidor
 * (p. ej. un diálogo que necesita la lista de cuentas) se pinte al instante mientras revalida.
 */
export const FINANCE_RESOURCES = ['accounts', 'transactions', 'budgets', 'alerts', 'dashboard']

const VersionsContext = createContext(null)
const ActionsContext = createContext(null)

const initialVersions = Object.fromEntries(FINANCE_RESOURCES.map((key) => [key, 0]))

export function FinanceDataProvider({ children }) {
  const [versions, setVersions] = useState(initialVersions)
  const cacheRef = useRef(new Map())

  const invalidate = useCallback((...keys) => {
    const list = keys.flat().filter(Boolean)
    if (import.meta.env.DEV) {
      const unknown = list.filter((key) => !FINANCE_RESOURCES.includes(key))
      if (unknown.length) console.warn('[invalidate] recursos desconocidos:', unknown)
    }
    setVersions((current) => {
      const next = { ...current }
      for (const key of list) next[key] = (next[key] ?? 0) + 1
      return next
    })
  }, [])

  const actions = useMemo(
    () => ({
      invalidate,
      readCache: (key) => cacheRef.current.get(key),
      writeCache: (key, data) => cacheRef.current.set(key, data),
    }),
    [invalidate],
  )

  return (
    <ActionsContext.Provider value={actions}>
      <VersionsContext.Provider value={versions}>{children}</VersionsContext.Provider>
    </ActionsContext.Provider>
  )
}

/** `const invalidate = useInvalidate(); invalidate('transactions', 'accounts')` */
export function useInvalidate() {
  const context = useContext(ActionsContext)
  return context?.invalidate ?? noop
}

/** Uso interno de useApiResource. Funciona también fuera del provider (sin caché ni invalidación). */
export function useResourceVersionKey(tags) {
  const versions = useContext(VersionsContext)
  if (!versions || !tags?.length) return ''
  return tags.map((tag) => `${tag}:${versions[tag] ?? 0}`).join('|')
}

export function useResourceCache() {
  return useContext(ActionsContext)
}

function noop() {}
