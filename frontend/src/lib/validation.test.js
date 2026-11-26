// Pruebas de las validaciones de los formularios de acceso (correo y contraseña).
import { describe, expect, it } from 'vitest'
import { firstError, isStrongPassword, isValidEmail, passwordChecks } from './validation'

describe('isValidEmail', () => {
  it.each(['ana@utp.edu.pe', '  usuario@correo.com  ', 'a.b+c@dominio.org'])('acepta %s', (email) => {
    expect(isValidEmail(email)).toBe(true)
  })

  it.each(['', 'sin-arroba.com', 'ana@dominio', 'ana @correo.com', 'ana@correo.c'])('rechaza "%s"', (email) => {
    expect(isValidEmail(email)).toBe(false)
  })
})

describe('passwordChecks', () => {
  it('una contraseña vacía no tiene etiqueta', () => {
    expect(passwordChecks('').label).toBe('')
  })

  it('clasifica la fuerza de la contraseña', () => {
    expect(passwordChecks('abc').label).toBe('Muy débil')
    expect(passwordChecks('abcdefgh').label).toBe('Débil')
    expect(passwordChecks('abcdefg1').label).toBe('Segura')
  })

  it('marca como fuerte una contraseña larga con mayúsculas, minúsculas y números', () => {
    const checks = passwordChecks('ClaveSegura2026')
    expect(checks).toMatchObject({ minLength: true, hasNumberOrSymbol: true, hasMixedCase: true, strong: true, score: 3 })
  })
})

describe('isStrongPassword', () => {
  it('exige 8 caracteres y al menos un número o símbolo', () => {
    expect(isStrongPassword('abcdefgh')).toBe(false)
    expect(isStrongPassword('abc#1')).toBe(false)
    expect(isStrongPassword('abcdefg#')).toBe(true)
  })
})

describe('firstError', () => {
  it('devuelve el primer mensaje de error de la API', () => {
    expect(firstError(['Correo inválido.', 'Otro'])).toBe('Correo inválido.')
    expect(firstError('Mensaje')).toBe('Mensaje')
    expect(firstError([])).toBe('')
    expect(firstError(null)).toBe('')
  })
})
