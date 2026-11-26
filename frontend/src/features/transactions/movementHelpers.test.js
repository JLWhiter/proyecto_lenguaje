// Pruebas de los helpers puros de Movimientos: colores/íconos, textos de la pantalla y validación del formulario.
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { cleanMovementValues, initialMovementValues, resolveFields, validateMovementFields } from './movementForm'
import { amountTone, directionIcon, movementTone } from './movementStyle'
import { deleteRequest, feedStatusText, loadMoreLabel, plural, signTone } from './movementText'

describe('movementStyle', () => {
  it('movementTone según la clase y el sentido', () => {
    expect(movementTone({ kind: 'TRANSFER' })).toBe('bg-sky-50 text-sky-600')
    expect(movementTone({ kind: 'OPENING' })).toBe('bg-amber-50 text-amber-700')
    expect(movementTone({ kind: 'ADJUSTMENT', monto: '5' })).toBe('bg-amber-50 text-amber-700')
    expect(movementTone({ kind: 'REGULAR', tipo: 'INGRESO', monto: '0' })).toBe('bg-emerald-50 text-emerald-600')
    expect(movementTone({ kind: 'REGULAR', tipo: 'GASTO', monto: '-3' })).toBe('bg-red-50 text-red-600')
  })

  it('amountTone y directionIcon', () => {
    expect([amountTone('12.5'), amountTone(-1), amountTone('0')]).toEqual(['text-emerald-600', 'text-red-600', 'text-slate-600'])
    expect(directionIcon({ tipo: 'INGRESO' })).toBe(ArrowDownLeft)
    expect(directionIcon({ tipo: 'GASTO', monto: '-2' })).toBe(ArrowUpRight)
  })
})

describe('movementText', () => {
  const money = (value) => `S/ ${value.toFixed(2)}`

  it('feedStatusText cubre carga, error, vacío y conteo', () => {
    const base = { status: 'ready', stale: false, count: 30, loaded: 30, hasFilters: false, periodPhrase: 'noviembre' }
    expect(feedStatusText({ ...base, status: 'loading' })).toBe('Buscando movimientos…')
    expect(feedStatusText({ ...base, stale: true })).toBe('Buscando movimientos…')
    expect(feedStatusText({ ...base, status: 'error' })).toBe('No se pudieron cargar los movimientos.')
    expect(feedStatusText({ ...base, count: 0 })).toBe('Sin movimientos en noviembre.')
    expect(feedStatusText({ ...base, count: 0, hasFilters: true })).toBe('Ningún movimiento coincide con los filtros.')
    expect(feedStatusText(base)).toBe('30 movimientos')
    expect(feedStatusText({ ...base, count: 1, loaded: 1, hasFilters: true })).toBe('1 movimiento con estos filtros')
    expect(feedStatusText({ ...base, count: 120, loaded: 50 })).toBe('120 movimientos · mostrando 50')
  })

  it('loadMoreLabel, plural y signTone', () => {
    expect(loadMoreLabel({ loadingMore: true })).toBe('Cargando…')
    expect(loadMoreLabel({ moreError: new Error('x') })).toBe('Reintentar')
    expect(loadMoreLabel({ count: 120, loaded: 50 })).toBe('Cargar más (50)')
    expect(loadMoreLabel({ count: 60, loaded: 50 })).toBe('Cargar más (10)')
    expect(plural(2, 'cuenta', 'cuentas')).toBe('2 cuentas')
    expect([signTone(5), signTone(-1), signTone(0)]).toEqual(['emerald', 'red', 'slate'])
  })

  it('deleteRequest explica el efecto según la clase de movimiento', () => {
    expect(deleteRequest({ kind: 'TRANSFER', nombre: 'Ahorro', monto: '-20' }, money).confirmLabel).toBe('Eliminar ambos movimientos')
    expect(deleteRequest({ kind: 'DEPOSIT', nombre: 'Depósito', monto: '20', cuenta: 'Yape' }, money).message).toBe(
      'Se eliminará «Depósito» y se descontarán S/ 20.00 del saldo de Yape. Esta acción no se puede deshacer.',
    )
    expect(deleteRequest({ kind: 'REGULAR', tipo: 'GASTO', nombre: 'Taxi', monto: '-8.5' }, money).message).toBe(
      'Se eliminará «Taxi» y se devolverán S/ 8.50 al saldo de la cuenta. Esta acción no se puede deshacer.',
    )
  })
})

describe('movementForm', () => {
  const fields = [
    { name: 'type', type: 'segmented', options: [['GASTO', 'Gasto'], ['INGRESO', 'Ingreso']] },
    { name: 'name', label: 'Nombre', required: true, maxLength: 5 },
    { name: 'amount', type: 'number', required: true, min: '0.01' },
    { name: 'account_id', type: 'select', required: true, options: [] },
    { name: 'occurred_at', type: 'date', required: true, min: '2026-01-01', max: '2026-11-26' },
    { name: 'category', requiredMessage: 'Elige una categoría.', required: true },
  ]

  it('resolveFields e initialMovementValues', () => {
    expect(resolveFields((values) => [values.a], { a: 1 })).toEqual([1])
    expect(initialMovementValues(fields, { amount: 15, name: null })).toEqual({
      type: 'GASTO',
      name: '',
      amount: '15',
      account_id: '',
      occurred_at: '',
      category: '',
    })
  })

  it('cleanMovementValues acepta coma decimal y quita espacios del monto', () => {
    expect(cleanMovementValues(fields, { name: ' Taxi ', amount: ' 1 5,50 ' })).toMatchObject({ name: 'Taxi', amount: '15.50', type: '' })
  })

  it('validateMovementFields: obligatorios, monto, fechas y largo máximo', () => {
    expect(validateMovementFields(fields, { type: 'GASTO', name: '', amount: '', account_id: '', occurred_at: '', category: '' })).toEqual({
      name: 'Este campo es obligatorio.',
      amount: 'Este campo es obligatorio.',
      account_id: 'Selecciona una opción.',
      occurred_at: 'Elige una fecha.',
      category: 'Elige una categoría.',
    })
    const valid = { type: 'GASTO', name: 'Taxi', amount: '8.50', account_id: '1', occurred_at: '2026-11-20', category: 'Transporte' }
    expect(validateMovementFields(fields, valid)).toEqual({})
    expect(validateMovementFields(fields, { ...valid, name: 'Demasiado largo', amount: '1.234', occurred_at: '2026-12-01' })).toEqual({
      name: 'Máximo 5 caracteres.',
      amount: 'Ingresa un monto válido, con hasta 2 decimales (ej. 15.50).',
      occurred_at: 'La fecha no puede ser posterior a hoy.',
    })
    expect(validateMovementFields(fields, { ...valid, amount: '0', occurred_at: '2025-12-31' })).toMatchObject({
      amount: 'Ingresa un monto mayor a 0.',
      occurred_at: expect.stringMatching(/^La fecha no puede ser anterior al /),
    })
    expect(validateMovementFields(fields, { ...valid, occurred_at: '31/12/2026' })).toEqual({ occurred_at: 'Ingresa una fecha válida.' })
  })
})
