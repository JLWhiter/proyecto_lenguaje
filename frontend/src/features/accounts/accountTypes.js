// Tipos de cuenta que ofrece el formulario. El ícono se deriva del tipo: el backend usa
// `icon === 'cash'` para separar el efectivo del resto del patrimonio.
export const ACCOUNT_TYPES = [
  { value: 'Cuenta de ahorros', icon: 'piggy' },
  { value: 'Cuenta corriente', icon: 'credit' },
  { value: 'Billetera digital', icon: 'phone' },
  { value: 'Efectivo', icon: 'cash' },
  { value: 'Otra', icon: 'credit' },
]

export const DEFAULT_ACCOUNT_TYPE = ACCOUNT_TYPES[0].value

const normalize = (value) => String(value ?? '').trim().toLocaleLowerCase('es')

/** Tipo del catálogo que coincide (sin distinguir mayúsculas) o `null`. */
export function findAccountType(type) {
  const key = normalize(type)
  return ACCOUNT_TYPES.find((item) => normalize(item.value) === key) ?? null
}

/** Ícono del backend (credit | piggy | phone | cash) para un tipo de cuenta. */
export function iconForType(type) {
  return findAccountType(type)?.icon ?? 'credit'
}

/** Colores de la ficha del ícono (mismo lenguaje que las tarjetas de Presupuestos). */
export const ICON_TILE_STYLES = {
  piggy: 'bg-emerald-50 text-emerald-600',
  credit: 'bg-sky-50 text-sky-600',
  phone: 'bg-violet-50 text-violet-600',
  cash: 'bg-amber-50 text-amber-600',
}

export function iconTileStyle(icon) {
  return ICON_TILE_STYLES[icon] ?? ICON_TILE_STYLES.credit
}
