// Comparación de categorías para la sugerencia "¿Quisiste decir «Alimentación»?" del diálogo de movimientos.
// (Misma idea que `looseCategoryKey` de Presupuestos: el backend junta mayúsculas y espacios, pero no tildes.)

/** Clave flexible: sin tildes, sin mayúsculas y sin espacios ('  Alimentacion ' y 'alimentación' → 'alimentacion'). */
export function looseCategoryKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .toLocaleLowerCase('es')
}

/**
 * Categoría existente que se escribe casi igual que `typed` (solo cambian tildes, mayúsculas o espacios),
 * o `null` si lo escrito ya coincide exactamente con una categoría o no se parece a ninguna.
 *   similarCategory('alimentacion', ['Alimentación', 'Transporte']) → 'Alimentación'
 *   similarCategory('Alimentación', ['Alimentación']) → null
 */
export function similarCategory(typed, names) {
  const text = String(typed ?? '').trim()
  const key = looseCategoryKey(text)
  if (!key || !Array.isArray(names)) return null
  if (names.some((name) => name === text)) return null
  return names.find((name) => looseCategoryKey(name) === key) ?? null
}
