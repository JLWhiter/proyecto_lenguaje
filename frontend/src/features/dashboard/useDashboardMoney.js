// El Resumen usa el mismo formateo con "Ocultar montos" que Movimientos y Alertas.
//   const { text, signedText, hidden } = useDashboardMoney()
//   text(1200) → 'S/ 1,200.00' o '••••'
export { useVisibleMoney as useDashboardMoney } from '../transactions/useVisibleMoney'
