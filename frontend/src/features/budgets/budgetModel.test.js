// Pruebas de las reglas de Presupuestos. Los umbrales deben coincidir con backend/core/budgets.py.
import { describe, expect, it } from 'vitest'
import { freeMargin, overspent, periodPhase, shortfall, stateForPercentage, stateOf } from './budgetModel'

describe('stateForPercentage', () => {
  it.each([
    [0, 'Normal'],
    [74.9, 'Normal'],
    [75, 'Precaución'],
    [89.9, 'Precaución'],
    [90, 'Crítico'],
    [100, 'Crítico'],
    [100.01, 'Excedido'],
  ])('%s %% → %s', (percentage, state) => {
    expect(stateForPercentage(percentage)).toBe(state)
  })
})

describe('stateOf', () => {
  it('prioriza el estado que envía el backend', () => {
    expect(stateOf({ estado: 'Excedido', porcentaje: 10 })).toBe('Excedido')
  })

  it('usa el color o el porcentaje si falta el estado', () => {
    expect(stateOf({ color: 'amber' })).toBe('Precaución')
    expect(stateOf({ porcentaje: '95' })).toBe('Crítico')
  })
})

describe('montos de un presupuesto', () => {
  it('freeMargin calcula lo que queda sin errores de punto flotante', () => {
    expect(freeMargin({ presupuesto: '0.30', gastado: '0.10' })).toBe(0.2)
    expect(freeMargin({ presupuesto: '100', gastado: '150' })).toBe(0)
  })

  it('overspent calcula cuánto se excedió', () => {
    expect(overspent({ presupuesto: '100', gastado: '150.25' })).toBe(50.25)
    expect(overspent({ presupuesto: '100', gastado: '80' })).toBe(0)
  })

  it('shortfall usa la proyección solo en el mes en curso', () => {
    const budget = { presupuesto: '500', gastado: '300', proyeccion: '650' }
    expect(shortfall(budget, 'current')).toBe(150)
    expect(shortfall(budget, 'past')).toBe(0)
  })
})

describe('periodPhase', () => {
  it('compara el período con el mes actual', () => {
    expect(periodPhase('2026-10', '2026-11')).toBe('past')
    expect(periodPhase('2026-11', '2026-11')).toBe('current')
    expect(periodPhase('2026-12', '2026-11')).toBe('future')
  })
})
