// Pruebas de los parámetros, el nombre de respaldo y los errores de la exportación a Excel.
import { describe, expect, it } from 'vitest'
import { exportFilename, exportQuery, parseExportError } from './transactions'

describe('exportQuery', () => {
  it('pide Excel por defecto con los filtros del listado', () => {
    expect(exportQuery({ mes: '2026-11', tipo: 'GASTO', cuenta_id: 3 })).toEqual({
      mes: '2026-11',
      search: undefined,
      tipo: 'GASTO',
      categoria: undefined,
      cuenta_id: 3,
      formato: 'xlsx',
    })
  })

  it('con todo=true pide todo el historial y no envía el mes', () => {
    const query = exportQuery({ mes: '2026-11', todo: true })
    expect(query.todo).toBe(1)
    expect(query.mes).toBeUndefined()
    expect(query.formato).toBe('xlsx')
  })

  it('respeta formato csv', () => {
    expect(exportQuery({ mes: '2026-11', formato: 'csv' }).formato).toBe('csv')
  })
})

describe('exportFilename', () => {
  it('usa el mismo patrón que el backend', () => {
    expect(exportFilename({ mes: '2026-11' })).toBe('finova-movimientos-2026-11.xlsx')
    expect(exportFilename({ todo: true })).toBe('finova-historial-completo.xlsx')
    expect(exportFilename({ mes: '2026-11', formato: 'csv' })).toBe('finova-transacciones-2026-11.csv')
    expect(exportFilename()).toBe('finova-movimientos.xlsx')
  })
})

describe('parseExportError', () => {
  it('lee los errores JSON del Excel', () => {
    expect(parseExportError('{"detail":"Las credenciales de autenticación no se proveyeron."}', 401)).toEqual({
      message: 'Las credenciales de autenticación no se proveyeron.',
      fieldErrors: {},
    })
    expect(parseExportError('{"formato":["Formato no válido. Usa xlsx (Excel) o csv."]}', 400)).toEqual({
      message: 'Formato no válido. Usa xlsx (Excel) o csv.',
      fieldErrors: { formato: 'Formato no válido. Usa xlsx (Excel) o csv.' },
    })
  })

  it('lee los errores "campo,mensaje" del CSV, con comas y comillas', () => {
    const body = '﻿campo,mensaje\r\nmes,"El período debe tener formato AAAA-MM, por ejemplo ""2026-11""."\r\n'
    expect(parseExportError(body, 400)).toEqual({
      message: 'El período debe tener formato AAAA-MM, por ejemplo "2026-11".',
      fieldErrors: { mes: 'El período debe tener formato AAAA-MM, por ejemplo "2026-11".' },
    })
  })

  it('usa un texto de una línea, pero no HTML ni errores 5xx', () => {
    expect(parseExportError('Cuenta no encontrada.', 404).message).toBe('Cuenta no encontrada.')
    expect(parseExportError('<html><body>Server Error</body></html>', 500).message).toBe(
      'El servidor tuvo un problema al generar el archivo. Inténtalo de nuevo en unos minutos.',
    )
    expect(parseExportError('Bad Gateway', 502).message).toMatch(/^El servidor tuvo un problema/)
  })

  it('tiene mensajes en español si el cuerpo está vacío o no es válido', () => {
    expect(parseExportError('', 401).message).toBe('Tu sesión expiró. Inicia sesión nuevamente.')
    expect(parseExportError('{no es json', 400).message).toBe('No se pudo descargar el archivo.')
    expect(parseExportError(null, 403).message).toBe('No se pudo descargar el archivo.')
  })
})
