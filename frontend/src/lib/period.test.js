// Pruebas de los períodos mensuales (AAAA-MM) en hora de Lima.
import { describe, expect, it } from 'vitest'
import {
  currentMonth,
  daysInMonth,
  isValidMonth,
  monthLabel,
  monthName,
  monthPhrase,
  occurredAtForPeriod,
  recentMonths,
  shiftMonth,
} from './period'

describe('isValidMonth', () => {
  it('acepta solo el formato AAAA-MM con mes 01–12', () => {
    expect(isValidMonth('2026-11')).toBe(true)
    expect(isValidMonth('2026-13')).toBe(false)
    expect(isValidMonth('2026-1')).toBe(false)
    expect(isValidMonth(202611)).toBe(false)
  })
})

describe('currentMonth', () => {
  it('usa la hora de Lima: el 1 de diciembre a las 02:00 UTC todavía es noviembre', () => {
    expect(currentMonth(new Date('2026-12-01T02:00:00Z'))).toBe('2026-11')
    expect(currentMonth(new Date('2026-12-01T06:00:00Z'))).toBe('2026-12')
  })
})

describe('shiftMonth', () => {
  it('cruza el cambio de año en ambos sentidos', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2025-12', 1)).toBe('2026-01')
    expect(shiftMonth('2026-05', -17)).toBe('2024-12')
  })
})

describe('nombres de meses', () => {
  it('usa "Setiembre" como en Perú', () => {
    expect(monthName('2026-09')).toBe('Setiembre')
  })

  it('arma etiquetas y frases', () => {
    expect(monthLabel('2026-11')).toBe('Noviembre 2026')
    expect(monthLabel('2026-11', { short: true })).toBe('Nov 2026')
    expect(monthPhrase('2026-11')).toBe('noviembre 2026')
    expect(monthPhrase('2026-11', { year: false })).toBe('noviembre')
    expect(monthLabel('mal')).toBe('')
  })
})

describe('recentMonths', () => {
  it('lista los meses del más reciente al más antiguo', () => {
    expect(recentMonths(3, '2026-02')).toEqual(['2026-02', '2026-01', '2025-12'])
  })
})

describe('daysInMonth', () => {
  it('considera los años bisiestos', () => {
    expect(daysInMonth('2024-02')).toBe(29)
    expect(daysInMonth('2026-02')).toBe(28)
    expect(daysInMonth('2026-11')).toBe(30)
  })
})

describe('occurredAtForPeriod', () => {
  const now = new Date('2026-11-26T15:00:00Z')

  it('en el mes actual usa el momento presente', () => {
    expect(occurredAtForPeriod('2026-11', now)).toBe(now.toISOString())
  })

  it('en otro mes usa el día 24 a mediodía de Lima', () => {
    expect(occurredAtForPeriod('2026-08', now)).toBe('2026-08-24T12:00:00-05:00')
  })
})
