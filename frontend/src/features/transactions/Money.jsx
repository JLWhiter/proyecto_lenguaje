// Montos y textos con montos que respetan "Ocultar montos" (Resumen, Movimientos y Alertas).
import { HIDDEN_AMOUNT, HIDDEN_AMOUNT_LABEL } from '../../lib/format'
import { useVisibleMoney } from './useVisibleMoney'

/** Monto con `tabular-nums`; '••••' (y "Monto oculto" para lectores de pantalla) si los montos están ocultos. */
export function Amount({ value, signed = false, className = '' }) {
  const { hidden, text, signedText } = useVisibleMoney()
  if (hidden) {
    return (
      <span className={className}>
        <span aria-hidden="true">{HIDDEN_AMOUNT}</span>
        <span className="sr-only">{HIDDEN_AMOUNT_LABEL}</span>
      </span>
    )
  }
  return <span className={`tabular-nums ${className}`}>{signed ? signedText(value) : text(value)}</span>
}

/**
 * Texto del backend que puede traer montos ("Llevas S/ 170.40 de S/ 120.00"). Con los montos ocultos
 * se ve "Llevas •••• de ••••" y el lector de pantalla oye "Llevas monto oculto de monto oculto".
 */
export function MaskedText({ children }) {
  const { hidden, maskText, speakText } = useVisibleMoney()
  if (!hidden || typeof children !== 'string') return children ?? null
  const masked = maskText(children)
  if (masked === children) return children
  return (
    <>
      <span aria-hidden="true">{masked}</span>
      <span className="sr-only">{speakText(children)}</span>
    </>
  )
}
