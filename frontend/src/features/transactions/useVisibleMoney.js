import { useMemo } from 'react'
import { usePreferences } from '../../context/PreferencesContext'
import { useMoney } from '../../hooks/useMoney'
import { HIDDEN_AMOUNT, HIDDEN_AMOUNT_LABEL, maskAmountsInText, speakAmountsInText } from '../../lib/format'

/**
 * Montos que respetan la preferencia "Ocultar montos" (`showAmounts`), en Resumen, Movimientos y Alertas.
 *   const { hidden, text, signedText, maskText, speakText } = useVisibleMoney()
 *   text(1200)        → 'S/ 1,200.00' o '••••'
 *   signedText(-20)   → '-S/ 20.00' o '••••'
 *   speak(…)/speakSigned(…) → igual, pero 'Monto oculto' (para aria-label y lectores de pantalla)
 *   maskText('Llevas S/ 170.40 de S/ 120.00') → 'Llevas •••• de ••••' (si están ocultos)
 */
export function useVisibleMoney() {
  const { showAmounts } = usePreferences()
  const { money, signedMoney, symbol, currency } = useMoney()
  return useMemo(() => {
    const hidden = !showAmounts
    return {
      hidden,
      symbol,
      currency,
      text: (value) => (hidden ? HIDDEN_AMOUNT : money(value)),
      signedText: (value) => (hidden ? HIDDEN_AMOUNT : signedMoney(value)),
      speak: (value) => (hidden ? HIDDEN_AMOUNT_LABEL : money(value)),
      speakSigned: (value) => (hidden ? HIDDEN_AMOUNT_LABEL : signedMoney(value)),
      maskText: (text) => maskAmountsInText(text, hidden),
      speakText: (text) => speakAmountsInText(text, hidden),
    }
  }, [showAmounts, money, signedMoney, symbol, currency])
}
