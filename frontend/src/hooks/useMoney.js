import { useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { currencySymbol, DEFAULT_CURRENCY, formatMoney, formatSignedMoney } from '../lib/format'

/**
 * Formateadores de dinero ligados a la moneda del usuario (PEN / USD / EUR).
 *   const { money, signedMoney, symbol } = useMoney()
 *   money(-20)        → '-S/ 20.00'
 *   signedMoney(150)  → '+S/ 150.00'
 *   symbol            → 'S/'
 */
export function useMoney() {
  const { user } = useAuth()
  const currency = user?.currency || DEFAULT_CURRENCY
  return useMemo(
    () => ({
      currency,
      symbol: currencySymbol(currency),
      money: (value) => formatMoney(value, currency),
      signedMoney: (value) => formatSignedMoney(value, currency),
    }),
    [currency],
  )
}
