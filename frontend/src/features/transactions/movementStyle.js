// Íconos y colores de un movimiento (lista de Movimientos y "Transacciones recientes" del Resumen).
import {
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Car,
  Gamepad2,
  HeartPulse,
  House,
  Landmark,
  ShoppingCart,
  SlidersHorizontal,
} from 'lucide-react'
import { toNumber } from '../../lib/format'

// Íconos que envía el backend en `icon` (shopping, car, home, health, gamepad, briefcase, income, transfer, adjust, opening).
export const MOVEMENT_ICONS = {
  shopping: ShoppingCart,
  car: Car,
  home: House,
  health: HeartPulse,
  gamepad: Gamepad2,
  briefcase: BriefcaseBusiness,
  income: ArrowDownLeft,
  transfer: ArrowRightLeft,
  adjust: SlidersHorizontal,
  opening: Landmark,
}

export function isIncomeMovement(item) {
  return item.tipo === 'INGRESO' || toNumber(item.monto) > 0
}

/** Ícono genérico: flecha de entrada (ingreso) o de salida (gasto). */
export function directionIcon(item) {
  return isIncomeMovement(item) ? ArrowDownLeft : ArrowUpRight
}

/** Fondo y color del ícono: transferencia (celeste), ajuste/saldo inicial (ámbar), ingreso (verde) o gasto (rojo). */
export function movementTone(item) {
  if (item.kind === 'TRANSFER') return 'bg-sky-50 text-sky-600'
  if (item.kind === 'ADJUSTMENT' || item.kind === 'OPENING') return 'bg-amber-50 text-amber-700'
  return isIncomeMovement(item) ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
}

/** Color de un monto con signo: verde (> 0), rojo (< 0) o gris (0). */
export function amountTone(value) {
  const number = toNumber(value)
  if (number > 0) return 'text-emerald-600'
  return number < 0 ? 'text-red-600' : 'text-slate-600'
}
