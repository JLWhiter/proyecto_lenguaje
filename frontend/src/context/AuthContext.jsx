import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { setUnauthorizedHandler } from '../lib/api'
import { authService } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const userRef = useRef(null)

  useEffect(() => {
    userRef.current = user
  }, [user])

  // Cualquier 401 de la API (fuera de login/registro) significa que la sesión ya no es válida:
  // limpiamos al usuario y ProtectedRoute redirige a /login con el aviso "Tu sesión expiró".
  useEffect(
    () =>
      setUnauthorizedHandler(() => {
        if (userRef.current) setSessionExpired(true)
        userRef.current = null
        setUser(null)
      }),
    [],
  )

  useEffect(() => {
    let active = true

    authService
      .session()
      .then((data) => {
        if (active) setUser(data?.authenticated ? data.user : null)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setChecking(false)
      })

    return () => {
      active = false
    }
  }, [])

  /**
   * Fija el usuario recién autenticado y ejecuta `onSuccess` (normalmente un `navigate`) en la MISMA
   * transición. react-router aplica la navegación como transición: si el usuario se fijara antes y por
   * separado, GuestRoute redirigiría a /app sin `state` y se perderían el destino (`from`) y avisos como
   * `justRegistered`.
   */
  const startSession = useCallback((data, onSuccess) => {
    startTransition(() => {
      setSessionExpired(false)
      setUser(data.user)
      onSuccess?.(data)
    })
  }, [])

  /** `await login(credentials, { onSuccess: () => navigate(destino) })` — `onSuccess` es opcional. */
  const login = useCallback(
    async (credentials, { onSuccess } = {}) => {
      const data = await authService.login(credentials)
      startSession(data, onSuccess)
      return data
    },
    [startSession],
  )

  /** `await register(payload, { onSuccess: (data) => navigate('/app', { state }) })` — `onSuccess` es opcional. */
  const register = useCallback(
    async (payload, { onSuccess } = {}) => {
      const data = await authService.register(payload)
      startSession(data, onSuccess)
      return data
    },
    [startSession],
  )

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } catch {
      // Si la sesión ya había expirado el backend responde 401; igual cerramos localmente.
    } finally {
      userRef.current = null
      setSessionExpired(false)
      setUser(null)
    }
  }, [])

  /**
   * Cierra la sesión en todos los dispositivos. A diferencia de `logout`, si el backend falla
   * el error se propaga y la sesión local se mantiene (la acción no se completó).
   */
  const logoutAll = useCallback(async () => {
    const data = await authService.logoutAll()
    userRef.current = null
    setSessionExpired(false)
    setUser(null)
    return data
  }, [])

  const refreshUser = useCallback(async () => {
    const data = await authService.me()
    setUser(data)
    return data
  }, [])

  /**
   * Actualiza el usuario en memoria con datos que ya devolvió el backend (PATCH me/, cambio de
   * contraseña, verificación…). El header, el menú y `useMoney()` se refrescan al instante.
   * Acepta el usuario completo o un parcial (`{ email_verified: true }`). Sin sesión, o si `next.id`
   * es de otro usuario (p. ej. un enlace de verificación ajeno), no hace nada.
   */
  const updateUser = useCallback((next) => {
    if (!next || typeof next !== 'object') return
    setUser((current) => {
      if (!current) return current
      if (next.id !== undefined && next.id !== current.id) return current
      return { ...current, ...next }
    })
  }, [])

  const value = useMemo(
    () => ({ user, checking, sessionExpired, login, register, logout, logoutAll, refreshUser, updateUser }),
    [user, checking, sessionExpired, login, register, logout, logoutAll, refreshUser, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
