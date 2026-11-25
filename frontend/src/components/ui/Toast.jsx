import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'

const ToastContext = createContext(null)
const DEFAULT_DURATION = 4000
const MAX_TOASTS = 3

const TONES = {
  success: { Icon: CheckCircle2, icon: 'text-emerald-400' },
  error: { Icon: AlertTriangle, icon: 'text-red-400' },
  info: { Icon: Info, icon: 'text-sky-300' },
}

let sequence = 0

/**
 * Notificaciones efímeras (se cierran solas a los ~4 s o con la ×).
 *   const toast = useToast()
 *   toast.success('Cuenta creada.')
 *   toast.error(error.message)
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback((message, { tone = 'success', duration = DEFAULT_DURATION } = {}) => {
    if (!message) return null
    sequence += 1
    const id = sequence
    setToasts((current) => [...current.slice(-(MAX_TOASTS - 1)), { id, message, tone, duration }])
    return id
  }, [])

  const api = useMemo(
    () => ({
      show,
      dismiss,
      success: (message, options) => show(message, { ...options, tone: 'success' }),
      error: (message, options) => show(message, { ...options, tone: 'error', duration: options?.duration ?? 6000 }),
      info: (message, options) => show(message, { ...options, tone: 'info' }),
    }),
    [show, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[70] mx-auto flex max-w-lg flex-col gap-2 lg:bottom-5"
        >
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false)
  const remaining = useRef(toast.duration)

  useEffect(() => {
    if (paused || !toast.duration) return undefined
    const startedAt = Date.now()
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current)
    return () => {
      window.clearTimeout(timer)
      remaining.current -= Date.now() - startedAt
    }
  }, [paused, toast.id, toast.duration, onDismiss])

  const tone = TONES[toast.tone] ?? TONES.info
  const Icon = tone.Icon

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      // Pausa al pasar el mouse (no en táctil: un tap no emite "leave" y el aviso no se cerraría nunca).
      onPointerEnter={(event) => event.pointerType === 'mouse' && setPaused(true)}
      onPointerLeave={(event) => event.pointerType === 'mouse' && setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex animate-rise items-start gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl"
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.icon}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 break-words">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Cerrar aviso"
        className="-my-2 -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-emerald-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider')
  return context
}
