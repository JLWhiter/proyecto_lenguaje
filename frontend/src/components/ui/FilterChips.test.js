// Pruebas de `parseCountLabel` (contadores de los chips de filtro: "Todas (5)", "Normal 3").
import { describe, expect, it } from 'vitest'
import { parseCountLabel } from './FilterChips'

describe('parseCountLabel', () => {
  it('separa la etiqueta del contador', () => {
    expect(parseCountLabel('Todas (5)')).toEqual({ key: 'Todas', count: 5 })
    expect(parseCountLabel('Normal 3')).toEqual({ key: 'Normal', count: 3 })
    expect(parseCountLabel('Presupuesto (12) ')).toEqual({ key: 'Presupuesto', count: 12 })
  })

  it('sin número al final devuelve el texto y count null', () => {
    expect(parseCountLabel('Metas')).toEqual({ key: 'Metas', count: null })
    expect(parseCountLabel('  Gasto inusual  ')).toEqual({ key: 'Gasto inusual', count: null })
    expect(parseCountLabel('Todas (5))')).toEqual({ key: 'Todas (5))', count: null })
  })

  // Resultados de la implementación anterior (/^(.*?)\s*\(?(\d+)\)?\s*$/): el comportamiento no cambia.
  it.each([
    ['', '', null],
    [' ', '', null],
    ['5', '', 5],
    ['(5)', '', 5],
    ['(5', '', 5],
    ['5)', '', 5],
    ['Todas(5)', 'Todas', 5],
    ['Todas  ( 5)', 'Todas  (', 5],
    ['Todas( 5)', 'Todas(', 5],
    ['a 1 2', 'a 1', 2],
    ['Año 2026', 'Año', 2026],
    ['Ritmo de gasto (0)', 'Ritmo de gasto', 0],
    ['x5)', 'x', 5],
    ['abc)', 'abc)', null],
    ['Todas\n(5)', 'Todas', 5],
    ['a\n12 5', 'a\n12 5', null],
    ['12\n5', '12', 5],
    ['\nTodas 5', 'Todas 5', null],
    ['Balance del mes (3)\t', 'Balance del mes', 3],
    [' (7) ', '', 7],
    [null, 'null', null],
    [undefined, 'undefined', null],
    [42, '', 42],
  ])('%j → { key: %j, count: %j }', (text, key, count) => {
    expect(parseCountLabel(text)).toEqual({ key, count })
  })
})
