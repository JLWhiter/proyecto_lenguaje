// Pruebas de las utilidades de Movimientos: sugerencia de categorías y fechas en hora de Lima.
import { describe, expect, it } from 'vitest'
import { looseCategoryKey, similarCategory } from './categoryMatch'
import { dateOfMovement, defaultMovementDate, isValidDate, todayInLima } from './dates'

describe('looseCategoryKey', () => {
  it('ignora tildes, mayúsculas y espacios', () => {
    expect(looseCategoryKey('  Alimentación ')).toBe('alimentacion')
    expect(looseCategoryKey('Comida Rápida')).toBe('comidarapida')
  })
})

describe('similarCategory', () => {
  const names = ['Alimentación', 'Transporte']

  it('sugiere la categoría existente cuando solo cambia la forma de escribirla', () => {
    expect(similarCategory('alimentacion', names)).toBe('Alimentación')
  })

  it('no sugiere nada si coincide exactamente o no se parece', () => {
    expect(similarCategory('Alimentación', names)).toBeNull()
    expect(similarCategory('Salud', names)).toBeNull()
    expect(similarCategory('', names)).toBeNull()
  })
})

describe('fechas de movimientos', () => {
  it('isValidDate exige AAAA-MM-DD', () => {
    expect(isValidDate('2026-11-25')).toBe(true)
    expect(isValidDate('25/11/2026')).toBe(false)
  })

  it('todayInLima y dateOfMovement usan la hora de Lima (UTC−5)', () => {
    expect(todayInLima(new Date('2026-11-26T03:00:00Z'))).toBe('2026-11-25')
    expect(dateOfMovement('2026-11-26T03:00:00Z')).toBe('2026-11-25')
    expect(dateOfMovement('')).toBe('')
  })

  it('defaultMovementDate propone hoy o el último día del mes revisado', () => {
    const now = new Date('2026-11-26T15:00:00Z')
    expect(defaultMovementDate('2026-11', now)).toBe('2026-11-26')
    expect(defaultMovementDate('2026-02', now)).toBe('2026-02-28')
  })
})
