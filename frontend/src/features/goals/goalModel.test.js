// Pruebas de las reglas de Metas de ahorro (frontend). Estados y textos: backend/goals/planning.py.
import { describe, expect, it } from 'vitest'
import { alertActionTarget } from '../alerts/alertModel'
import { alertTarget, goalsLink } from '../dashboard/dashboardUtils'
import {
  addDays,
  barPercent,
  chartPoints,
  estimateInfo,
  expectedMarker,
  formatGoalDate,
  goalFormErrors,
  goalNameKey,
  goalPayload,
  monthsText,
  movementErrors,
  STATUS,
  statusStyles,
  topGoals,
  WITHDRAWAL,
  DEPOSIT,
} from './goalModel'

const TODAY = '2026-11-26'

function goal(overrides = {}) {
  return {
    id: 1,
    nombre: 'Viaje a Cusco',
    descripcion: '',
    icono: 'plane',
    objetivo: 2000,
    ahorrado: 620,
    porcentaje: 31,
    porcentaje_esperado: 71.9,
    estado: STATUS.BEHIND,
    fecha_objetivo: '2027-01-31',
    fecha_estimada: '2027-11-26',
    archivada: false,
    creada: '2026-06-10',
    ...overrides,
  }
}

describe('progreso', () => {
  it('limita la barra a 0–100', () => {
    expect(barPercent(goal({ porcentaje: 125 }))).toBe(100)
    expect(barPercent(goal({ porcentaje: '31.5' }))).toBe(31.5)
    expect(barPercent({})).toBe(0)
  })

  it('muestra la marca esperada solo en metas en curso o atrasadas', () => {
    expect(expectedMarker(goal())).toBe(71.9)
    expect(expectedMarker(goal({ estado: STATUS.IN_PROGRESS, porcentaje_esperado: 0 }))).toBe(0)
    expect(expectedMarker(goal({ estado: STATUS.REACHED }))).toBeNull()
    expect(expectedMarker(goal({ estado: STATUS.OVERDUE }))).toBeNull()
    expect(expectedMarker(goal({ archivada: true }))).toBeNull()
  })

  it('tiene estilos para cada estado y un respaldo', () => {
    for (const status of Object.values(STATUS)) expect(statusStyles(status).Icon).toBeTruthy()
    expect(statusStyles('otro')).toBe(statusStyles(STATUS.IN_PROGRESS))
  })
})

describe('topGoals', () => {
  it('prioriza atrasadas y vencidas, conserva el orden y omite archivadas', () => {
    const goals = [
      goal({ id: 1, estado: STATUS.IN_PROGRESS }),
      goal({ id: 2, estado: STATUS.REACHED }),
      goal({ id: 3, estado: STATUS.BEHIND, archivada: true }),
      goal({ id: 4, estado: STATUS.BEHIND }),
      goal({ id: 5, estado: STATUS.IN_PROGRESS }),
    ]
    expect(topGoals(goals).map((item) => item.id)).toEqual([4, 1])
    expect(topGoals(goals, 4).map((item) => item.id)).toEqual([4, 1, 5, 2])
    expect(topGoals(undefined)).toEqual([])
  })
})

describe('textos', () => {
  it('formatea fechas sin correrse un día', () => {
    expect(formatGoalDate('2027-03-31')).toMatch(/^31 mar\.? 2027$/)
    expect(formatGoalDate('2027-01-01')).toMatch(/^1 ene\.? 2027$/)
    expect(formatGoalDate('31/03/2027')).toBe('')
  })

  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('pluraliza los meses', () => {
    expect(monthsText(1)).toBe('1 mes')
    expect(monthsText(4)).toBe('4 meses')
    expect(monthsText(0)).toBe('0 meses')
  })

  it('explica la fecha estimada', () => {
    expect(estimateInfo(goal()).late).toBe(true)
    expect(estimateInfo(goal()).text).toContain('después de tu fecha objetivo')
    expect(estimateInfo(goal({ fecha_estimada: '2027-01-15' }))).toEqual({ late: false, text: expect.stringMatching(/^A tu ritmo actual llegarías el 15 ene/) })
    expect(estimateInfo(goal({ fecha_estimada: null })).text).toMatch(/Aún no hay un ritmo/)
    expect(estimateInfo(goal({ estado: STATUS.REACHED }))).toBeNull()
  })

  it('arma los puntos del gráfico', () => {
    expect(chartPoints([{ mes: '2026-11', aportado: '-100.00' }])).toEqual([{ mes: '2026-11', label: 'Nov', name: 'Noviembre 2026', value: -100 }])
  })
})

describe('goalFormErrors', () => {
  const valid = { name: 'Laptop', target_amount: '3500', target_date: '2027-03-31', description: '', initial_amount: '' }

  it('acepta un formulario válido', () => {
    expect(goalFormErrors(valid, { today: TODAY })).toEqual({})
    expect(goalFormErrors({ ...valid, initial_amount: '0' }, { today: TODAY })).toEqual({})
  })

  it('valida cada campo', () => {
    const errors = goalFormErrors(
      { name: '  ', target_amount: '0', target_date: TODAY, description: 'x'.repeat(181), initial_amount: '-5' },
      { today: TODAY },
    )
    expect(errors).toEqual({
      name: 'Escribe un nombre para tu meta.',
      target_amount: 'Ingresa un monto mayor a 0.',
      target_date: 'La fecha objetivo debe ser posterior a hoy.',
      description: 'Usa como máximo 180 caracteres.',
      initial_amount: 'El monto no puede ser negativo.',
    })
  })

  it('detecta nombres repetidos sin tildes ni mayúsculas', () => {
    const taken = new Set([goalNameKey('Viaje a Cusco')])
    expect(goalFormErrors({ ...valid, name: 'VIAJE A CÚSCO' }, { today: TODAY, takenNames: taken }).name).toBe(
      'Ya tienes una meta activa con ese nombre.',
    )
  })

  it('al editar, una fecha pasada que no cambió es válida', () => {
    const editing = goal({ fecha_objetivo: '2026-10-31' })
    expect(goalFormErrors({ ...valid, target_date: '2026-10-31' }, { today: TODAY, goal: editing })).toEqual({})
    expect(goalFormErrors({ ...valid, target_date: '2026-11-01' }, { today: TODAY, goal: editing }).target_date).toBeTruthy()
  })
})

describe('goalPayload', () => {
  const values = { name: ' Viaje  a Cusco ', target_amount: '2,000.00', target_date: '2027-01-31', icon: 'plane', description: '', initial_amount: '150' }

  it('al crear incluye el monto inicial solo si es mayor que cero', () => {
    expect(goalPayload(values)).toEqual({
      name: 'Viaje a Cusco',
      target_amount: '2000.00',
      target_date: '2027-01-31',
      icon: 'plane',
      description: '',
      initial_amount: '150',
    })
    expect(goalPayload({ ...values, initial_amount: '' })).not.toHaveProperty('initial_amount')
  })

  it('al editar envía solo lo que cambió', () => {
    expect(goalPayload(values, goal())).toEqual({})
    expect(goalPayload({ ...values, target_amount: '2500' }, goal())).toEqual({ target_amount: '2500' })
  })
})

describe('movementErrors', () => {
  const base = { amount: '100', occurred_at: TODAY, note: '' }
  const context = { kind: DEPOSIT, saved: 620, created: '2026-06-10', today: TODAY }

  it('acepta un aporte válido', () => {
    expect(movementErrors(base, context)).toEqual({})
  })

  it('no permite retirar más de lo ahorrado', () => {
    const withdraw = { ...context, kind: WITHDRAWAL }
    expect(movementErrors({ ...base, amount: '620.01' }, { ...withdraw, formatMoney: (value) => `S/ ${value}` }).amount).toBe(
      'No puedes retirar más de lo ahorrado (S/ 620).',
    )
    expect(movementErrors({ ...base, amount: '620.01' }, withdraw).amount).toBe('No puedes retirar más de lo que llevas ahorrado.')
    expect(movementErrors({ ...base, amount: '620' }, withdraw)).toEqual({})
  })

  it('valida la fecha y la nota', () => {
    expect(movementErrors({ ...base, occurred_at: '2026-11-27' }, context).occurred_at).toBe('La fecha no puede ser posterior a hoy.')
    expect(movementErrors({ ...base, occurred_at: '2026-06-09' }, context).occurred_at).toBe(
      'La fecha no puede ser anterior al día en que creaste la meta.',
    )
    expect(movementErrors({ ...base, occurred_at: '' }, context).occurred_at).toBe('Elige la fecha.')
    expect(movementErrors({ ...base, note: 'x'.repeat(161) }, context).note).toBe('Usa como máximo 160 caracteres.')
  })
})

describe('enlaces a metas', () => {
  it('las alertas de metas abren /app/metas?meta=<id> sin depender del mes', () => {
    expect(alertActionTarget({ type: 'goal', id: 7, label: 'Ver meta' }, '2026-10')).toEqual({ pathname: '/app/metas', search: '?meta=7' })
    expect(alertTarget({ accion_detalle: { type: 'goal', id: 7, label: 'Ver meta' }, periodo: null }, '2026-11')).toEqual({
      pathname: '/app/metas',
      search: '?meta=7',
    })
    expect(goalsLink()).toEqual({ pathname: '/app/metas', search: '' })
  })

  it('las alertas de presupuesto siguen abriendo su mes', () => {
    expect(alertActionTarget({ type: 'budget', id: 3, label: 'Ajustar presupuesto', mes: '2026-11' })).toEqual({
      pathname: '/app/presupuestos',
      search: '?mes=2026-11&presupuesto=3&accion=editar',
    })
  })
})
