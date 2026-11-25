import { usePreferences } from '../../context/PreferencesContext'
import { useMoney } from '../../hooks/useMoney'

export const HIDDEN_AMOUNT = '••••'

/**
 * Monto que respeta la preferencia "Mostrar saldos" (solo lectura).
 *   <Amount value={1200} />          → 'S/ 1,200.00' o '••••' (con texto "oculto" para lectores de pantalla)
 *   <Amount value={-50} signed />    → '-S/ 50.00'
 */
export default function Amount({ value, signed = false, className = '' }) {
  const { showAmounts } = usePreferences()
  const { money, signedMoney } = useMoney()

  if (!showAmounts) {
    return (
      <span className={className}>
        <span aria-hidden="true">{HIDDEN_AMOUNT}</span>
        <span className="sr-only">Monto oculto</span>
      </span>
    )
  }
  return <span className={`tabular-nums ${className}`}>{signed ? signedMoney(value) : money(value)}</span>
}
