import { useMemo } from 'react'
import { usePreferences } from '../../context/PreferencesContext'
import { useMoney } from '../../hooks/useMoney'
import { HIDDEN_AMOUNT } from './dashboardUtils'

/**
 * Formateo de montos del Resumen respetando la preferencia "Mostrar montos" (showAmounts).
 *   const { text, signedText, hidden } = useDashboardMoney()
 *   text(1200) → 'S/ 1,200.00' o '••••'
 */
export function useDashboardMoney() {
  const { showAmounts } = usePreferences()
  const { money, signedMoney, symbol } = useMoney()
  return useMemo(
    () => ({
      hidden: !showAmounts,
      symbol,
      text: (value) => (showAmounts ? money(value) : HIDDEN_AMOUNT),
      signedText: (value) => (showAmounts ? signedMoney(value) : HIDDEN_AMOUNT),
    }),
    [showAmounts, money, signedMoney, symbol],
  )
}
