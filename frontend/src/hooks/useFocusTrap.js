import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const FIELD = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'

function focusableIn(container) {
  return [...container.querySelectorAll(FOCUSABLE)].filter(
    (element) => !element.closest('[inert]') && element.getClientRects().length > 0,
  )
}

// Pila de trampas activas: solo la última (el modal de más arriba) atiende Tab/Escape.
// El listener vive en `document` para seguir funcionando aunque el foco caiga en <body>
// (p. ej. cuando el botón enfocado se deshabilita).
const trapStack = []

function handleDocumentKeyDown(event) {
  const trap = trapStack[trapStack.length - 1]
  if (!trap) return
  const { container, onEscapeRef } = trap

  if (event.key === 'Escape') {
    if (onEscapeRef.current) {
      event.preventDefault()
      event.stopPropagation()
      onEscapeRef.current()
    }
    return
  }

  if (event.key !== 'Tab') return
  const items = focusableIn(container)
  if (items.length === 0) {
    event.preventDefault()
    container.focus()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement
  const inside = container.contains(active)
  if (!inside) {
    event.preventDefault()
    ;(event.shiftKey ? last : first).focus()
  } else if (event.shiftKey && (active === first || active === container)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

/**
 * Mantiene el foco dentro de `containerRef` mientras `active` es true.
 * - Al activarse enfoca `initialFocusRef`, o `[data-autofocus]`, o el primer campo de formulario,
 *   o el primer elemento enfocable.
 * - Escape llama a `onEscape`.
 * - Al desactivarse devuelve el foco al elemento que lo tenía antes.
 */
export function useFocusTrap(containerRef, { active = true, initialFocusRef, onEscape } = {}) {
  const onEscapeRef = useRef(onEscape)

  useEffect(() => {
    onEscapeRef.current = onEscape
  })

  useEffect(() => {
    const container = containerRef.current
    if (!active || !container) return undefined

    const previouslyFocused = document.activeElement
    const preferred =
      initialFocusRef?.current ||
      container.querySelector('[data-autofocus]') ||
      container.querySelector(FIELD) ||
      focusableIn(container)[0] ||
      container
    preferred.focus({ preventScroll: true })

    const trap = { container, onEscapeRef }
    trapStack.push(trap)
    if (trapStack.length === 1) document.addEventListener('keydown', handleDocumentKeyDown, true)

    return () => {
      const index = trapStack.indexOf(trap)
      if (index !== -1) trapStack.splice(index, 1)
      if (trapStack.length === 0) document.removeEventListener('keydown', handleDocumentKeyDown, true)
      if (previouslyFocused && previouslyFocused.isConnected && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus({ preventScroll: true })
      }
    }
  }, [active, containerRef, initialFocusRef])
}

let lockCount = 0
let previousOverflow = ''

/** Bloquea el scroll del body mientras `locked` es true (soporta varios bloqueos a la vez). */
export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return undefined
    if (lockCount === 0) {
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    lockCount += 1
    return () => {
      lockCount -= 1
      if (lockCount === 0) document.body.style.overflow = previousOverflow
    }
  }, [locked])
}
