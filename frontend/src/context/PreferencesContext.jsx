import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const STORAGE_KEY = 'finova:preferences'
const DEFAULTS = { showAmounts: true }

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

const PreferencesContext = createContext(null)

/** Preferencias de interfaz del usuario en este dispositivo (p. ej. ocultar saldos). */
export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(readStored)

  const setPreference = useCallback((key, value) => {
    setPreferences((current) => {
      const next = { ...current, [key]: typeof value === 'function' ? value(current[key]) : value }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Almacenamiento no disponible (modo privado): la preferencia dura solo esta sesión.
      }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      ...preferences,
      setShowAmounts: (next) => setPreference('showAmounts', next),
      setPreference,
    }),
    [preferences, setPreference],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) throw new Error('usePreferences debe usarse dentro de PreferencesProvider')
  return context
}
