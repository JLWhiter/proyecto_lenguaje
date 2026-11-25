import { useEffect, useId, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { IconButton, Modal } from '../../components/ui'
import { useMediaQuery } from '../../hooks/useMediaQuery'

const SM_QUERY = '(min-width: 640px)'

const TONES = {
  default: { row: 'text-slate-700 hover:bg-slate-50', icon: 'bg-slate-100 text-slate-600' },
  danger: { row: 'text-red-600 hover:bg-red-50', icon: 'bg-red-50 text-red-600' },
}

/**
 * Menú "Más acciones" de una cuenta.
 * - Desde `sm`: menú desplegable (role="menu", flechas/Home/End/Escape, clic fuera cierra).
 * - En móvil: hoja inferior (Modal) con filas grandes, ícono, etiqueta y una línea de ayuda.
 *
 * `items`: [{ key, label, description?, Icon, tone?: 'danger', mobileOnly?, onSelect }]
 * Los `mobileOnly` solo aparecen en la hoja móvil (en escritorio ya están visibles en la tarjeta).
 */
export default function AccountActionsMenu({ accountName, items, disabled = false }) {
  const isDesktop = useMediaQuery(SM_QUERY)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const menuId = useId()
  const visible = items.filter((item) => !(isDesktop && item.mobileOnly))

  function close() {
    setOpen(false)
  }

  function select(item) {
    // El foco vuelve al botón antes de abrir el siguiente diálogo: así este lo devuelve aquí al cerrarse.
    triggerRef.current?.focus({ preventScroll: true })
    setOpen(false)
    item.onSelect()
  }

  return (
    <div className="relative shrink-0">
      <IconButton
        ref={triggerRef}
        label={`Más acciones de ${accountName}`}
        variant="ghost"
        disabled={disabled}
        aria-haspopup={isDesktop ? 'menu' : 'dialog'}
        aria-expanded={open}
        aria-controls={open && isDesktop ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="-mr-1 -mt-1 text-slate-500"
      >
        <MoreVertical className="h-5 w-5" />
      </IconButton>

      {open && isDesktop && (
        <DropdownMenu id={menuId} label={`Acciones de ${accountName}`} items={visible} triggerRef={triggerRef} onSelect={select} onClose={close} />
      )}
      {open && !isDesktop && <ActionSheet title={accountName} items={visible} onSelect={select} onClose={close} />}
    </div>
  )
}

function DropdownMenu({ id, label, items, triggerRef, onSelect, onClose }) {
  const menuRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const menu = menuRef.current
    menu?.querySelector('[role="menuitem"]')?.focus({ preventScroll: true })

    function handlePointerDown(event) {
      if (menu?.contains(event.target) || triggerRef.current?.contains(event.target)) return
      onCloseRef.current()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [triggerRef])

  function handleKeyDown(event) {
    const elements = [...menuRef.current.querySelectorAll('[role="menuitem"]')]
    const index = elements.indexOf(document.activeElement)
    const focusAt = (next) => elements[(next + elements.length) % elements.length]?.focus()

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusAt(index + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusAt(index - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      focusAt(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      focusAt(elements.length - 1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      triggerRef.current?.focus()
      onClose()
    } else if (event.key === 'Tab') {
      onClose()
    }
  }

  return (
    <div
      ref={menuRef}
      id={id}
      role="menu"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className="absolute right-0 top-full z-30 mt-1 w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
    >
      {items.map((item) => {
        const tone = TONES[item.tone] ?? TONES.default
        const Icon = item.Icon
        return (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => onSelect(item)}
            className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold outline-none focus-visible:bg-slate-100 ${tone.row}`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function ActionSheet({ title, items, onSelect, onClose }) {
  return (
    <Modal title={title} description="Elige una acción para esta cuenta." onClose={onClose} size="sm">
      <ul className="-mx-2 space-y-1">
        {items.map((item) => {
          const tone = TONES[item.tone] ?? TONES.default
          const Icon = item.Icon
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left ${tone.row}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  {item.description && <span className="block text-xs leading-5 text-slate-500">{item.description}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
