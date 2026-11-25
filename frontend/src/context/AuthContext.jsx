import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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

  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials)
    setSessionExpired(false)
    setUser(data.user)
    return data
  }, [])

  const register = useCallback(async (payload) => {
    const data = await authService.register(payload)
    setSessionExpired(false)
    setUser(data.user)
    return data
  }, [])

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

  const refreshUser = useCallback(async () => {
    const data = await authService.me()
    setUser(data)
    return data
  }, [])

  const value = useMemo(
    () => ({ user, checking, sessionExpired, login, register, logout, refreshUser }),
    [user, checking, sessionExpired, login, register, logout, refreshUser],
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
