import { usePreferences } from '../../context/PreferencesContext'
import { soles } from './taxRules'

export const HIDDEN_AMOUNT = '••••'

/**
 * Monto en soles que respeta la preferencia "Mostrar saldos" (como `Money` en Presupuestos):
 *   <TaxAmount value={1200} />  → 'S/ 1,200.00' o '••••' (con "Monto oculto" para lectores de pantalla)
 * Los porcentajes (tasas, tasa efectiva) y las cantidades de UIT de la escala siguen visibles.
 */
export default function TaxAmount({ value, className = '' }) {
  const { showAmounts } = usePreferences()
  if (!showAmounts) {
    return (
      <span className={className}>
        <span aria-hidden="true">{HIDDEN_AMOUNT}</span>
        <span className="sr-only">Monto oculto</span>
      </span>
    )
  }
  return <span className={`tabular-nums ${className}`}>{soles(value)}</span>
}

/** `true` si el usuario ocultó los montos: los textos armados con montos deben usar una versión sin cifras. */
export function useAmountsHidden() {
  return !usePreferences().showAmounts
}
