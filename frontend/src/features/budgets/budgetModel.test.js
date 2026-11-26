// Pruebas de las reglas de Presupuestos. Los umbrales deben coincidir con backend/core/budgets.py.
import { describe, expect, it } from 'vitest'
import {
  amountError,
  budgetPayload,
  changedBudgetFields,
  copyableCount,
  copyBlockedReason,
  emptyMonthDescription,
  freeMargin,
  guessIcon,
  initialRebalanceValues,
  normalizeAmount,
  overMarginError,
  overspent,
  periodPhase,
  rebalanceDefaults,
  shortfall,
  skippedCopyText,
  sourceHintText,
  stateForPercentage,
  stateOf,
  suggestedAmounts,
  targetHintText,
} from './budgetModel'

/** Formateador de prueba: 12.5 → 'S/ 12.50'. */
const money = (value) => `S/ ${Number(value).toFixed(2)}`

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
    // Se compara el texto: 0.30 − 0.10 con flotantes daría 0.19999999999999998.
    expect(String(freeMargin({ presupuesto: '0.30', gastado: '0.10' }))).toBe('0.2')
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

describe('rebalanceDefaults', () => {
  const budgets = [
    { nombre: 'Ocio', presupuesto: '300', gastado: '100', porcentaje: 33, proyeccion: '150' },
    { nombre: 'Comida', presupuesto: '500', gastado: '450', porcentaje: 90, proyeccion: '600' },
  ]

  it('propone mover lo que le falta al más comprometido, limitado al margen del origen', () => {
    expect(rebalanceDefaults(budgets, 'current')).toEqual({ source: 'Ocio', target: 'Comida', amount: '100.00' })
    expect(rebalanceDefaults(budgets, 'current', { source: 'Comida' })).toEqual({ source: 'Comida', target: 'Ocio', amount: '' })
  })

  it('sin margen o sin faltante no propone monto', () => {
    expect(rebalanceDefaults(budgets, 'past').amount).toBe('')
    expect(rebalanceDefaults([budgets[0]], 'current')).toEqual({ source: 'Ocio', target: '', amount: '' })
  })
})

describe('guessIcon', () => {
  it.each([
    ['Transporte', 'car'],
    ['Alquiler', 'home'],
    ['Entretenimiento', 'gamepad'],
    ['Farmacia', 'health'],
    ['Alimentación', 'shopping'],
    ['', 'shopping'],
  ])('%s → %s', (category, icon) => {
    expect(guessIcon(category)).toBe(icon)
  })
})

describe('montos escritos', () => {
  it('normalizeAmount acepta comas de miles o coma decimal', () => {
    expect(normalizeAmount(' 1,234.50 ')).toBe('1234.50')
    expect(normalizeAmount('1,234,567.5')).toBe('1234567.5')
    expect(normalizeAmount('15,5')).toBe('15.5')
  })

  it('amountError valida números positivos con hasta 2 decimales', () => {
    expect(amountError('250')).toBe('')
    expect(amountError('')).toBe('Ingresa el monto.')
    expect(amountError('0')).toBe('Ingresa un monto mayor a 0.')
    expect(amountError('1e3')).toBe('Ingresa un número válido, por ejemplo 250.00.')
    expect(amountError('0x10')).toBe('Ingresa un número válido, por ejemplo 250.00.')
    expect(amountError('1.234')).toBe('Usa como máximo 2 decimales.')
    expect(amountError('99999999999')).toBe('El monto es demasiado grande.')
  })
})

describe('copiar del mes anterior', () => {
  const previous = [{ nombre: 'Comida' }, { nombre: 'Ocio' }, { nombre: 'Salud' }]

  it('copyableCount cuenta las categorías que aún no existen (sin distinguir mayúsculas ni espacios)', () => {
    expect(copyableCount(previous, [{ nombre: ' comida ' }])).toBe(2)
    expect(copyableCount(previous, previous)).toBe(0)
    expect(copyableCount(null, [])).toBeNull()
  })

  it('copyBlockedReason explica por qué no hay nada que copiar', () => {
    const labels = { previousLabel: 'Octubre 2026', periodLabel: 'Noviembre 2026' }
    expect(copyBlockedReason({ copyable: 2, previousCount: 3, ...labels })).toBeNull()
    expect(copyBlockedReason({ copyable: null, previousCount: null, ...labels })).toBeNull()
    expect(copyBlockedReason({ copyable: 0, previousCount: 0, ...labels })).toBe('Nada que copiar: Octubre 2026 no tiene presupuestos.')
    expect(copyBlockedReason({ copyable: 0, previousCount: 3, ...labels })).toBe(
      'Nada que copiar: ya tienes en Noviembre 2026 todas las categorías de Octubre 2026.',
    )
  })

  it('emptyMonthDescription depende de lo que tenía el mes anterior', () => {
    expect(emptyMonthDescription(1, 'Octubre 2026')).toBe(
      'En Octubre 2026 tenías 1 presupuesto. Cópialos para empezar con los mismos límites o crea uno nuevo.',
    )
    expect(emptyMonthDescription(4, 'Octubre 2026')).toMatch(/^En Octubre 2026 tenías 4 presupuestos\./)
    expect(emptyMonthDescription(0, 'Octubre 2026')).toBe(
      'Octubre 2026 tampoco tiene presupuestos. Crea uno por categoría para controlar cuánto gastas.',
    )
    expect(emptyMonthDescription(null, 'Octubre 2026')).toBe(
      'Crea un presupuesto por categoría para controlar cuánto gastas, o copia los del mes anterior.',
    )
  })

  it('skippedCopyText avisa de las categorías omitidas', () => {
    expect(skippedCopyText(0)).toBe('')
    expect(skippedCopyText(1)).toBe(' Se omitió 1 que ya existía en este mes.')
    expect(skippedCopyText(3)).toBe(' Se omitieron 3 que ya existían en este mes.')
  })
})

describe('formulario de presupuesto', () => {
  const budget = { id: 7, nombre: 'Comida', presupuesto: '500.00', icon: 'shopping', descripcion: null }

  it('budgetPayload limpia espacios y normaliza el monto', () => {
    expect(budgetPayload({ category: '  Comida   rápida ', limit_amount: '1,200.50', icon: 'home', description: ' x ' })).toEqual({
      category: 'Comida rápida',
      limit_amount: '1200.50',
      icon: 'home',
      description: 'x',
    })
  })

  it('changedBudgetFields envía solo lo que cambió', () => {
    const same = { category: 'Comida', limit_amount: '500', icon: 'shopping', description: '' }
    expect(changedBudgetFields(same, budget)).toEqual({})
    expect(changedBudgetFields({ ...same, limit_amount: '450.5', description: 'Mercado' }, budget)).toEqual({
      limit_amount: '450.5',
      description: 'Mercado',
    })
  })
})

describe('mover saldo', () => {
  const ocio = { id: 1, nombre: 'Ocio', presupuesto: '300', gastado: '100', porcentaje: 33 }
  const comida = { id: 2, nombre: 'Comida', presupuesto: '500', gastado: '550', porcentaje: 110 }
  const ropa = { id: 3, nombre: 'Ropa', presupuesto: '200', gastado: '200', porcentaje: 100 }

  it('initialRebalanceValues respeta el monto de `initial` o usa el calculado', () => {
    expect(initialRebalanceValues([ocio, comida], 'past', { amount: '25' })).toEqual({
      source_category: 'Ocio',
      target_category: 'Comida',
      amount: '25.00',
    })
    expect(initialRebalanceValues([ocio, comida], 'past', null).amount).toBe('50.00')
    expect(initialRebalanceValues([ocio, comida], 'past', { amount: '' }).amount).toBe('50.00')
  })

  it('sourceHintText y targetHintText describen origen y destino', () => {
    expect(sourceHintText(null, money)).toBeNull()
    expect(sourceHintText(ocio, money)).toBe('Margen libre: S/ 200.00 (límite S/ 300.00, gastado S/ 100.00).')
    expect(sourceHintText(ropa, money)).toBe('Sin margen libre: ya gastó S/ 200.00 de S/ 200.00.')
    expect(targetHintText(null, 0, money)).toBeNull()
    expect(targetHintText(comida, 80, money)).toBe('Gastado S/ 550.00 de S/ 500.00. Ya se pasó por S/ 50.00 · al ritmo actual le faltarán S/ 80.00.')
    expect(targetHintText(comida, 50, money)).toBe('Gastado S/ 550.00 de S/ 500.00. Ya se pasó por S/ 50.00.')
    expect(targetHintText(ocio, 20, money)).toBe('Gastado S/ 100.00 de S/ 300.00. Al ritmo actual le faltarán S/ 20.00.')
    expect(targetHintText(ocio, 0, money)).toBe('Gastado S/ 100.00 de S/ 300.00 (33%).')
  })

  it('overMarginError explica el tope del origen', () => {
    expect(overMarginError(ocio, money)).toBe('Ocio solo tiene S/ 200.00 libres. Ingresa ese monto o uno menor.')
    expect(overMarginError(ropa, money)).toBe('Ropa no tiene margen libre: ya gastó todo su límite. Elige otro origen.')
  })

  it('suggestedAmounts propone cubrir el exceso, lo que falta y todo el margen, sin repetir', () => {
    expect(suggestedAmounts({ source: ocio, target: comida, need: 80, money })).toEqual([
      { key: 'exceeded', value: '50.00', label: 'Cubrir el exceso (S/ 50.00)' },
      { key: 'need', value: '80.00', label: 'Cubrir hasta fin de mes (S/ 80.00)' },
      { key: 'all', value: '200.00', label: 'Todo el margen (S/ 200.00)' },
    ])
    expect(suggestedAmounts({ source: ocio, target: ropa, need: 500, money })).toEqual([
      { key: 'need', value: '200.00', label: 'Todo lo posible (S/ 200.00)' },
    ])
    expect(suggestedAmounts({ source: ropa, target: comida, need: 80, money })).toEqual([])
    expect(suggestedAmounts({ source: ocio, target: ocio, need: 0, money })).toEqual([])
  })
})
