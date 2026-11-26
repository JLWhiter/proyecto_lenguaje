// Pruebas del nombre de archivo que llega en la cabecera Content-Disposition.
import { describe, expect, it } from 'vitest'
import { filenameFromDisposition } from './download'

describe('filenameFromDisposition', () => {
  it('lee el nombre entre comillas que envía el backend', () => {
    expect(filenameFromDisposition('attachment; filename="finova-movimientos-2026-11.xlsx"')).toBe(
      'finova-movimientos-2026-11.xlsx',
    )
    expect(filenameFromDisposition('attachment; filename="finova-historial-completo.xlsx"')).toBe(
      'finova-historial-completo.xlsx',
    )
  })

  it('acepta el nombre sin comillas y el formato codificado filename*', () => {
    expect(filenameFromDisposition('attachment; filename=finova.xlsx')).toBe('finova.xlsx')
    expect(filenameFromDisposition("attachment; filename*=UTF-8''finova%20a%C3%B1o.xlsx; filename=\"x.xlsx\"")).toBe(
      'finova año.xlsx',
    )
  })

  it('devuelve solo el nombre, nunca una ruta', () => {
    expect(filenameFromDisposition('attachment; filename="../../etc/finova.xlsx"')).toBe('finova.xlsx')
    expect(filenameFromDisposition('attachment; filename="C:\\descargas\\finova.xlsx"')).toBe('finova.xlsx')
  })

  it('devuelve texto vacío si la cabecera no trae nombre', () => {
    expect(filenameFromDisposition(null)).toBe('')
    expect(filenameFromDisposition('inline')).toBe('')
  })
})
