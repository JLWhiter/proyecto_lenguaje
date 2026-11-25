import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Modal } from '../../components/ui'

const ROW_TONES = {
  default: { row: 'text-slate-700 hover:bg-slate-50', icon: 'bg-slate-100 text-slate-600' },
  danger: { row: 'text-red-700 hover:bg-red-50', icon: 'bg-red-50 text-red-600' },
}

/**
 * Botón con menú desplegable (role="menu"): flechas/Home/End, Escape y clic fuera cierran.
 * Se abre hacia arriba o se alinea a la derecha si no cabe en la pantalla.
 *
 *   <MenuButton label="Posponer" icon={Clock} menuLabel="Posponer alerta" items={[{ key, label, onSelect }]} />
 */
export function MenuButton({ label, icon: Icon, menuLabel, items, disabled = false, className = '' }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)
  const menuId = useId()

  function select(item) {
    triggerRef.current?.focus({ preventScroll: true })
    setOpen(false)
    item.onSelect()
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={className}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {label}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <DropdownMenu id={menuId} label={menuLabel} items={items} triggerRef={triggerRef} onSelect={select} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

function DropdownMenu({ id, label, items, triggerRef, onSelect, onClose }) {
  const menuRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const [placement, setPlacement] = useState({ alignRight: false, above: false })

  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Si el menú se sale por la derecha o por abajo, lo reubicamos antes de pintarlo.
  useLayoutEffect(() => {
    const rect = menuRef.current?.getBoundingClientRect()
    const trigger = triggerRef.current?.getBoundingClientRect()
    if (!rect || !trigger) return
    const alignRight = rect.right > window.innerWidth - 8
    const above = rect.bottom > window.innerHeight - 8 && trigger.top - rect.height - 8 > 64
    if (alignRight || above) setPlacement({ alignRight, above })
  }, [triggerRef])

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
      className={`absolute z-30 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 ${
        placement.alignRight ? 'right-0' : 'left-0'
      } ${placement.above ? 'bottom-full mb-1' : 'top-full mt-1'}`}
    >
      {items.map((item) => {
        const tone = ROW_TONES[item.tone] ?? ROW_TONES.default
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
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Hoja inferior (móvil) con acciones grandes. Cada entrada es una acción
 * `{ key, label, description?, Icon, tone?, onSelect }` o un grupo de opciones
 * `{ key, label, Icon, options: [{ key, label, ariaLabel?, onSelect }] }` (p. ej. "Posponer: 1 h · 24 h · 7 días").
 */
export function ActionSheet({ title, description, items, onClose }) {
  const baseId = useId()
  return (
    <Modal title={title} description={description} onClose={onClose} size="sm">
      <ul className="-mx-2 space-y-1">
        {items.map((item) => {
          const tone = ROW_TONES[item.tone] ?? ROW_TONES.default
          const Icon = item.Icon
          if (item.options) {
            return (
              <li key={item.key} className="rounded-2xl px-2 py-2">
                <div className="flex items-center gap-3" id={`${baseId}-${item.key}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                </div>
                <div role="group" aria-labelledby={`${baseId}-${item.key}`} className="mt-2 grid grid-cols-3 gap-2 pl-[52px]">
                  {item.options.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      aria-label={option.ariaLabel}
                      onClick={option.onSelect}
                      className="min-h-11 rounded-xl border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </li>
            )
          }
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={item.onSelect}
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
