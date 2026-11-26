// Pruebas de formateo de montos, porcentajes, fechas e iniciales (locale es-PE, hora de Lima).
import { describe, expect, it } from 'vitest'
import {
  HIDDEN_AMOUNT,
  currencySymbol,
  formatDate,
  formatMoney,
  formatPercent,
  formatSignedMoney,
  formatTime,
  initialsOf,
  maskAmountsInText,
  speakAmountsInText,
  toNumber,
} from './format'

// Intl usa espacios no separables; se normalizan para comparar con texto legible.
const plain = (text) => text.replace(/\s/g, ' ')

describe('toNumber', () => {
  it('convierte los decimales en texto que envía el backend', () => {
    expect(toNumber('8450.00')).toBe(8450)
    expect(toNumber(12.5)).toBe(12.5)
  })

  it('devuelve 0 para valores vacíos o no numéricos', () => {
    expect(toNumber('')).toBe(0)
    expect(toNumber(null)).toBe(0)
    expect(toNumber('abc')).toBe(0)
    expect(toNumber(Number.NaN)).toBe(0)
  })
})

describe('formatMoney', () => {
  it('formatea soles con separador de miles y dos decimales', () => {
    expect(plain(formatMoney(1234.5, 'PEN'))).toBe('S/ 1,234.50')
  })

  it('muestra el signo negativo en los gastos', () => {
    expect(plain(formatMoney(-20, 'PEN'))).toMatch(/^-S\/ 20\.00$/)
  })

  it('usa soles si la moneda no existe', () => {
    expect(plain(formatMoney(5, 'XXXX'))).toBe('S/ 5.00')
  })

  it('formatSignedMoney agrega "+" a los ingresos y nada al cero', () => {
    expect(plain(formatSignedMoney(20, 'PEN'))).toBe('+S/ 20.00')
    expect(plain(formatSignedMoney(0, 'PEN'))).toBe('S/ 0.00')
  })

  it('currencySymbol devuelve el símbolo de la moneda', () => {
    expect(currencySymbol('PEN')).toBe('S/')
    expect(currencySymbol('USD')).toBe('$')
  })
})

describe('formatPercent', () => {
  it('respeta los decimales pedidos', () => {
    expect(formatPercent(81.25)).toBe('81.25%')
    expect(formatPercent(1292.63, { digits: 1 })).toBe('1,292.6%')
    expect(formatPercent(75, { digits: 1, minDigits: 0 })).toBe('75%')
  })
})

describe('ocultar montos', () => {
  const text = 'Gastaste S/ 1,234.50 de -$ 20.00 en Comida'

  it('reemplaza todos los montos cuando están ocultos', () => {
    expect(maskAmountsInText(text, true)).toBe(`Gastaste ${HIDDEN_AMOUNT} de ${HIDDEN_AMOUNT} en Comida`)
  })

  it('no cambia el texto cuando los montos están visibles', () => {
    expect(maskAmountsInText(text, false)).toBe(text)
  })

  it('para lectores de pantalla dice "monto oculto"', () => {
    expect(speakAmountsInText('Saldo S/ 10.00', true)).toBe('Saldo monto oculto')
  })
})

describe('fechas en hora de Lima', () => {
  // 2026-11-26 03:30 UTC = 2026-11-25 22:30 en Lima (UTC−5).
  const instant = '2026-11-26T03:30:00Z'

  it('formatDate usa el día de Lima, no el de UTC', () => {
    expect(formatDate(instant)).toBe('25 de noviembre de 2026')
  })

  it('formatTime usa 24 horas', () => {
    expect(formatTime(instant)).toBe('22:30')
  })

  it('devuelve texto vacío para fechas inválidas', () => {
    expect(formatDate('no es fecha')).toBe('')
    expect(formatDate(null)).toBe('')
  })
})

describe('initialsOf', () => {
  it('toma la primera letra del primer y último nombre', () => {
    expect(initialsOf('María Fernanda López')).toBe('ML')
    expect(initialsOf('ana')).toBe('A')
  })

  it('usa el correo cuando no hay nombre', () => {
    expect(initialsOf('', 'zoe@correo.com')).toBe('Z')
    expect(initialsOf('', '')).toBe('?')
  })
})
