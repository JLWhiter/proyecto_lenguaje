// Pruebas de las reglas del Impuesto a la Renta que usa la pantalla Impuestos.
import { describe, expect, it } from 'vitest'
import { BRACKETS, UIT_BY_YEAR, buildBrackets, parseAmount, parseYear, resultMode, sameAmount, splitDeductions } from './taxRules'

describe('parseAmount', () => {
  it('interpreta montos con separador de miles y símbolo de soles', () => {
    expect(parseAmount('60,000.50')).toEqual({ value: 60000.5, text: '60000.5' })
    expect(parseAmount('S/ 1,200')).toEqual({ value: 1200, text: '1200' })
  })

  it('distingue un campo vacío de uno inválido', () => {
    expect(parseAmount('  ').empty).toBe(true)
    expect(parseAmount('-50').error).toMatch(/negativo/)
    expect(parseAmount('12a').error).toMatch(/solo números/)
    expect(parseAmount('10.555').error).toMatch(/2 decimales/)
    expect(parseAmount('1234567890123').error).toMatch(/demasiado grande/)
  })

  it('sameAmount compara montos escritos de distinta forma', () => {
    expect(sameAmount('60,000', '60000')).toBe(true)
    expect(sameAmount('', '')).toBe(true)
    expect(sameAmount('100', '')).toBe(false)
  })
})

describe('parseYear', () => {
  it('acepta solo años de 4 dígitos', () => {
    expect(parseYear('2025')).toBe(2025)
    expect(parseYear('25')).toBeNull()
    expect(parseYear(undefined)).toBeNull()
  })
})

describe('escala del impuesto', () => {
  it('tiene los 5 tramos del art. 53 de la LIR', () => {
    expect(BRACKETS.map((bracket) => bracket.rate)).toEqual([8, 14, 17, 20, 30])
    expect(BRACKETS.at(-1).to).toBeNull()
  })

  it('usa la UIT oficial de cada año', () => {
    expect(UIT_BY_YEAR[2025]).toBe(5350)
    expect(UIT_BY_YEAR[2026]).toBe(5500)
  })
})

describe('buildBrackets', () => {
  // Renta neta de 10 UIT con UIT = 5,350: llena el 1.er tramo y un tercio del 2.º.
  const result = {
    uit: '5350.00',
    tramos: [
      { desde: '0', hasta: '26750', tasa: '8', base: '26750', impuesto: '2140' },
      { desde: '26750', hasta: '107000', tasa: '14', base: '26750', impuesto: '3745' },
    ],
  }

  it('marca qué tramos se alcanzaron y cuánto se llenaron', () => {
    const brackets = buildBrackets(result)
    expect(brackets).toHaveLength(5)
    expect(brackets[0]).toMatchObject({ reached: true, fill: 1, impuesto: 2140 })
    expect(brackets[1].fill).toBeCloseTo(26750 / 80250)
    expect(brackets[2]).toMatchObject({ reached: false, fill: 0, desde: 20 * 5350 })
  })
})

describe('splitDeductions', () => {
  it('separa la deducción fija de 7 UIT de la adicional', () => {
    const parts = splitDeductions({ uit: '5350', ingreso_bruto: '80000', deducciones: '42450' })
    expect(parts).toMatchObject({ fixed: 37450, additional: 5000, fixedCapped: false, additionalLimit: 16050 })
  })

  it('limita la deducción fija al ingreso cuando es menor a 7 UIT', () => {
    const parts = splitDeductions({ uit: '5350', ingreso_bruto: '20000', deducciones: '20000' })
    expect(parts).toMatchObject({ fixed: 20000, additional: 0, fixedCapped: true })
  })
})

describe('resultMode', () => {
  it('identifica de dónde sale el ingreso', () => {
    expect(resultMode({ fuente: 'manual' })).toBe('simulated')
    expect(resultMode({ fuente: 'movimientos', proyectado: true })).toBe('projected')
    expect(resultMode({ fuente: 'movimientos', anio_en_curso: true })).toBe('partial')
    expect(resultMode({ fuente: 'movimientos', anio_en_curso: false })).toBe('registered')
  })
})
