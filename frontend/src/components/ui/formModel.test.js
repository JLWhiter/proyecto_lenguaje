// Pruebas de la lógica de los formularios en diálogo: valores iniciales, validación y errores de la API.
import { describe, expect, it } from 'vitest'
import {
  cleanFormValues,
  firstFieldWithError,
  initialFormValues,
  isEmptyValue,
  splitServerErrors,
  validateFormFields,
} from './formModel'

const FIELDS = [{ name: 'name' }, { name: 'amount' }]

describe('splitServerErrors', () => {
  it('pone bajo cada campo los errores de campos presentes', () => {
    expect(splitServerErrors(FIELDS, { fieldErrors: { amount: 'Monto inválido.' }, message: 'Monto inválido.' })).toEqual({
      fieldErrors: { amount: 'Monto inválido.' },
      formError: '',
    })
  })

  it('junta arriba los errores de campos que no están en el formulario', () => {
    expect(splitServerErrors(FIELDS, { fieldErrors: { account_id: 'Saldo insuficiente.', other: 'Otro.' } })).toEqual({
      fieldErrors: {},
      formError: 'Saldo insuficiente. Otro.',
    })
  })

  it('sin errores por campo usa el mensaje general o uno genérico', () => {
    expect(splitServerErrors(FIELDS, { message: 'Sin conexión.' })).toEqual({ fieldErrors: {}, formError: 'Sin conexión.' })
    expect(splitServerErrors(FIELDS, null)).toEqual({ fieldErrors: {}, formError: 'No se pudo completar la operación.' })
  })
})

describe('validateFormFields', () => {
  const fields = [
    { name: 'nombre', required: true },
    { name: 'tipo', type: 'select', required: true },
    { name: 'saldo', type: 'number', min: 0 },
    { name: 'meta', type: 'number', min: 1 },
    { name: 'limite', type: 'number', min: 1, minMessage: 'Debe ser al menos 1.' },
  ]

  it('marca obligatorios vacíos (también solo espacios)', () => {
    expect(validateFormFields(fields, { nombre: '  ', tipo: '', saldo: '', meta: '', limite: '' })).toEqual({
      nombre: 'Este campo es obligatorio.',
      tipo: 'Selecciona una opción.',
    })
  })

  it('valida números y mínimos', () => {
    expect(validateFormFields(fields, { nombre: 'A', tipo: 'x', saldo: 'abc', meta: '0', limite: '0' })).toEqual({
      saldo: 'Ingresa un número válido.',
      meta: 'Ingresa un monto mayor a 0.',
      limite: 'Debe ser al menos 1.',
    })
    expect(validateFormFields(fields, { nombre: 'A', tipo: 'x', saldo: '-1', meta: '5', limite: '2' })).toEqual({
      saldo: 'El monto no puede ser negativo.',
    })
  })
})

describe('valores del formulario', () => {
  it('initialFormValues convierte a texto y elige la primera opción de un select', () => {
    const fields = [{ name: 'a' }, { name: 'b', type: 'select', options: [['x', 'X']] }, { name: 'c', type: 'number' }]
    expect(initialFormValues(fields, { a: 5, c: null })).toEqual({ a: '5', b: 'x', c: '' })
  })

  it('cleanFormValues recorta y omite opcionales vacíos que no son texto', () => {
    const fields = [{ name: 'a', type: 'text' }, { name: 'b', type: 'number' }, { name: 'c', type: 'number', required: true }]
    expect(cleanFormValues(fields, { a: ' x ', b: '', c: ' 3 ' })).toEqual({ a: 'x', c: '3' })
  })

  it('isEmptyValue y firstFieldWithError', () => {
    expect([isEmptyValue(''), isEmptyValue(undefined), isEmptyValue(null), isEmptyValue(0)]).toEqual([true, true, true, false])
    expect(firstFieldWithError(FIELDS, { amount: 'x', name: 'y' })).toBe(FIELDS[0])
    expect(firstFieldWithError(FIELDS, {})).toBeUndefined()
  })
})
