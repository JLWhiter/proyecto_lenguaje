// Pruebas de los helpers del Resumen: fechas relativas de movimientos y porcentajes del backend.
import { describe, expect, it } from 'vitest'
import { movementsLink, movementWhen, parsePercentText, variationInfo } from './dashboardUtils'

describe('movementWhen', () => {
  const now = new Date('2026-11-26T15:00:00Z') // 10:00 en Lima

  it('usa "Hoy" y "Ayer" en hora de Lima', () => {
    expect(movementWhen('2026-11-26T13:30:00Z', now)).toBe('Hoy, 08:30')
    expect(movementWhen('2026-11-26T03:00:00Z', now)).toBe('Ayer, 22:00')
  })

  it('otros días muestran la fecha corta; sin fecha válida, texto vacío', () => {
    expect(movementWhen('2026-11-20T16:00:00Z', now)).toMatch(/^20 nov\.?, 11:00$/)
    expect(movementWhen('', now)).toBe('')
    expect(movementWhen('no-es-fecha', now)).toBe('')
  })
})

describe('porcentajes', () => {
  it('parsePercentText quita %, separadores de miles y espacios', () => {
    expect(parsePercentText('+1,292.6%')).toBeCloseTo(1292.6, 6)
    expect(parsePercentText(' -12.5 % ')).toBeCloseTo(-12.5, 6)
    expect(parsePercentText('')).toBeNull()
    expect(parsePercentText('n/a')).toBeNull()
  })

  it('variationInfo elige tono según si subir es bueno', () => {
    expect(variationInfo('+10%').tone).toBe('good')
    expect(variationInfo(10, { increaseIsGood: false }).tone).toBe('bad')
    expect(variationInfo(0).text).toBe('0.0%')
    expect(variationInfo(null).text).toBe('—')
  })
})

describe('movementsLink', () => {
  it('arma la ruta de Movimientos con el mes y los filtros no vacíos', () => {
    expect(movementsLink('2026-11', { tipo: 'GASTO', categoria: '' })).toEqual({
      pathname: '/app/movimientos',
      search: '?mes=2026-11&tipo=GASTO',
    })
    expect(movementsLink('x')).toEqual({ pathname: '/app/movimientos', search: '' })
  })
})
