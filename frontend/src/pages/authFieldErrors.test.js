// Pruebas de los mensajes de validación de las pantallas de acceso.
import { describe, expect, it } from 'vitest'
import { confirmPasswordError, emailError, newPasswordError, pickFieldErrors } from './authFieldErrors'

describe('emailError', () => {
  it('no muestra nada hasta que el campo se toca', () => {
    expect(emailError('', false)).toBe('')
    expect(emailError('malo', false)).toBe('')
  })

  it('pide el correo o uno válido', () => {
    expect(emailError('   ', true)).toBe('Ingresa tu correo electrónico.')
    expect(emailError('correo-malo', true)).toBe('Ingresa un correo electrónico válido.')
    expect(emailError(' ana@example.com ', true)).toBe('')
  })
})

describe('newPasswordError', () => {
  it('exige 8 caracteres con un número o símbolo', () => {
    expect(newPasswordError('', false)).toBe('')
    expect(newPasswordError('', true)).toBe('Crea una contraseña.')
    expect(newPasswordError('abcdefgh', true)).toBe('Usa al menos 8 caracteres e incluye un número o símbolo.')
    expect(newPasswordError('abc1', true)).toBe('Usa al menos 8 caracteres e incluye un número o símbolo.')
    expect(newPasswordError('Clave-Segura', true)).toBe('')
  })
})

describe('confirmPasswordError', () => {
  it('pide repetir la misma contraseña', () => {
    expect(confirmPasswordError('Clave-1234', '', false)).toBe('')
    expect(confirmPasswordError('Clave-1234', '', true)).toBe('Confirma tu contraseña.')
    expect(confirmPasswordError('Clave-1234', 'Clave-1235', true)).toBe('Las contraseñas no coinciden.')
    expect(confirmPasswordError('Clave-1234', 'Clave-1234', true)).toBe('')
  })
})

describe('pickFieldErrors', () => {
  it('se queda solo con los campos del formulario', () => {
    expect(pickFieldErrors({ password: 'Muy corta', uid: 'Inválido' }, ['password', 'password_confirm'])).toEqual({ password: 'Muy corta' })
    expect(pickFieldErrors({}, ['password'])).toEqual({})
  })
})
