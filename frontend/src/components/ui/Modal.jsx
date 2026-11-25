import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import IconButton from './IconButton'
import { useBodyScrollLock, useFocusTrap } from '../../hooks/useFocusTrap'

let openModals = 0

/** Mientras haya un modal abierto, el resto de la app (#root) queda inerte para teclado y lectores. */
function useInertRoot(active) {
  useEffect(() => {
    if (!active) return undefined
    const root = document.getElementById('root')
    openModals += 1
    if (root) root.inert = true
    return () => {
      openModals -= 1
      if (root && openModals === 0) root.inert = false
    }
  }, [active])
}

/**
 * Diálogo modal accesible.
 * - Bottom-sheet en móvil, centrado desde `sm`.
 * - Foco atrapado, Escape y clic en el fondo cierran, devuelve el foco al cerrar.
 * - El cuerpo hace scroll; `footer` queda siempre visible.
 *
 *   <Modal title="Nueva cuenta" onClose={close} footer={<button>Guardar</button>}>…</Modal>
 */
export default function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  initialFocusRef,
  size = 'md',
  closeOnBackdrop = true,
}) {
  const panelRef = useRef(null)
  const titleId = useId()
  const descriptionId = useId()

  // Orden importante: al desmontar, React limpia en orden de declaración; #root debe dejar de ser
  // inerte antes de que el focus trap devuelva el foco al botón que abrió el modal.
  useInertRoot(true)
  useBodyScrollLock(true)
  useFocusTrap(panelRef, { active: true, initialFocusRef, onEscape: onClose })

  const width = size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg'

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose?.()
      }}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`flex max-h-[92svh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl outline-none sm:rounded-[24px] ${width}`}
      >
        <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-bold text-slate-900">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Cerrar" variant="soft" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>

        {footer && (
          <footer className="border-t border-slate-100 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-5">
            {footer}
          </footer>
        )}
      </section>
    </div>,
    document.body,
  )
}
