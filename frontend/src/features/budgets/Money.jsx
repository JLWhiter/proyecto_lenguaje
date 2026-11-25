import { usePreferences } from '../../context/PreferencesContext'
import { useMoney } from '../../hooks/useMoney'

export const HIDDEN_AMOUNT = '••••'

/**
 * Monto que respeta la preferencia "Mostrar saldos".
 *   <Money value={900} />            → 'S/ 900.00' o '••••' (con "Monto oculto" para lectores de pantalla)
 *   <Money value={-50} absolute />   → 'S/ 50.00'
 */
export default function Money({ value, absolute = false, className = '' }) {
  const { showAmounts } = usePreferences()
  const { money } = useMoney()

  if (!showAmounts) {
    return (
      <span className={className}>
        <span aria-hidden="true">{HIDDEN_AMOUNT}</span>
        <span className="sr-only">Monto oculto</span>
      </span>
    )
  }
  const number = Number(value) || 0
  return <span className={`tabular-nums ${className}`}>{money(absolute ? Math.abs(number) : number)}</span>
}
