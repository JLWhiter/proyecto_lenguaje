import { apiRequest } from './api'

const API_BASE = import.meta.env.VITE_API_ROOT || '/api/v1'

async function request(path, options = {}) {
  const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
  return apiRequest(path, { method: options.method || 'GET', body, signal: options.signal })
}

export const fallbackData = {
  dashboard: {
    balance_total: 8450.0,
    balance_variacion: '+12.4% vs mes anterior',
    ingresos_mensuales: 5800.0,
    ingresos_variacion: '+8.2%',
    gastos_mensuales: 3250.0,
    gastos_variacion: '-4.1%',
    presupuesto_porcentaje: 81.25,
    presupuesto_limite: 4000.0,
    presupuesto_consumido: 3250.0,
    presupuesto_restante: 750.0,
    evolucion_saldo: [
      { name: 'Dic', value: 5100 },
      { name: 'Ene', value: 5600 },
      { name: 'Feb', value: 6100 },
      { name: 'Mar', value: 7200 },
      { name: 'Abr', value: 7800 },
      { name: 'May', value: 8450 },
    ],
    distribucion_gastos: [
      { name: 'Alimentación', value: 35, color: '#ef4444' },
      { name: 'Vivienda', value: 25, color: '#10b981' },
      { name: 'Transporte', value: 15, color: '#f59e0b' },
      { name: 'Servicios', value: 13, color: '#60a5fa' },
      { name: 'Entretenimiento', value: 12, color: '#4f46e5' },
    ],
    alertas_activas: [
      {
        id: 1,
        tipo: 'warning',
        titulo: 'Desvío de Presupuesto Mensual',
        tiempo: 'Hace 15 min',
        descripcion:
          'Has consumido el 81.25% de tu presupuesto mensual previsto (S/ 3,250.00 de S/ 4,000.00) a falta de 7 días de cierre.',
        accion: 'Ajustar Presupuesto',
      },
      {
        id: 2,
        tipo: 'danger',
        titulo: 'Sobrecosto en Alimentación',
        tiempo: 'Hoy 09:30',
        descripcion:
          'La categoría Alimentación representa el 35% del egreso total del mes (S/ 1,137.50). Supera la cuota sugerida del 25%.',
        accion: 'Ver desglose detallado',
      },
      {
        id: 3,
        tipo: 'info',
        titulo: 'Límite Próximo: Transporte',
        tiempo: 'Ayer',
        descripcion:
          'Tu categoría de Transporte ha alcanzado el 88% de su techo mensual asignado (S/ 487.50 / S/ 550.00).',
        accion: 'Ver detalle',
      },
    ],
    ultimas_transacciones: [
      {
        id: 1,
        nombre: 'Supermercados Metro',
        categoria: 'Alimentación',
        fecha: '24 May',
        cuenta: 'BCP Débito',
        monto: -185.5,
        tipo: 'GASTO',
        estado: 'Completado',
      },
      {
        id: 2,
        nombre: 'Pago de Nómina Tech Corp',
        categoria: 'Salario',
        fecha: '23 May',
        cuenta: 'BBVA Cuenta Sueldo',
        monto: 5800.0,
        tipo: 'INGRESO',
        estado: 'Acreditado',
      },
      {
        id: 3,
        nombre: 'Suscripción Netflix & Spotify',
        categoria: 'Entretenimiento',
        fecha: '22 May',
        cuenta: 'Tarjeta Crédito Interbank',
        monto: -64.9,
        tipo: 'GASTO',
        estado: 'Automático',
      },
      {
        id: 4,
        nombre: 'Gasolina Primax',
        categoria: 'Transporte',
        fecha: '20 May',
        cuenta: 'Yape / BCP',
        monto: -120.0,
        tipo: 'GASTO',
        estado: 'Completado',
      },
    ],
  },
  transactions: {
    total_ingresos: 5800.0,
    total_gastos: 3250.0,
    neto: 2550.0,
    grupos: [
      {
        titulo: 'HOY, 24 DE MAYO',
        total: -114.5,
        items: [
          {
            id: 1,
            nombre: 'Supermercados Wong',
            subtexto: 'BCP Débito',
            categoria: 'Alimentación',
            monto: -84.5,
            hora: '14:32',
            tipo: 'GASTO',
            icon: 'shopping',
          },
          {
            id: 2,
            nombre: 'Uber Ride',
            subtexto: 'Tarjeta Interbank',
            categoria: 'Transporte',
            monto: -30.0,
            hora: '10:15',
            tipo: 'GASTO',
            icon: 'car',
          },
        ],
      },
      {
        titulo: 'AYER, 23 DE MAYO',
        total: 1465.0,
        items: [
          {
            id: 3,
            nombre: 'Consultoría UX - Pago',
            subtexto: 'BCP Débito',
            categoria: 'Honorarios',
            monto: 1500.0,
            hora: '16:40',
            tipo: 'INGRESO',
            icon: 'briefcase',
          },
          {
            id: 4,
            nombre: 'Cafetería Tostado',
            subtexto: 'Yape Móvil',
            categoria: 'Alimentación',
            monto: -35.0,
            hora: '08:20',
            tipo: 'GASTO',
            icon: 'coffee',
          },
        ],
      },
      {
        titulo: '21 DE MAYO',
        total: -480.0,
        items: [
          {
            id: 5,
            nombre: 'Luz del Sur',
            subtexto: 'Interbank Visa',
            categoria: 'Vivienda',
            monto: -180.0,
            hora: 'May 21',
            tipo: 'GASTO',
            icon: 'home',
          },
          {
            id: 6,
            nombre: 'Inkafarma San Borja',
            subtexto: 'Efectivo Billetera',
            categoria: 'Salud',
            monto: -65.0,
            hora: 'May 21',
            tipo: 'GASTO',
            icon: 'health',
          },
        ],
      },
    ],
  },
  budgets: {
    summary: {
      total_consumido: 3250.0,
      total_asignado: 4000.0,
      porcentaje: 81.25,
      restante: 750.0,
      dias_restantes: 7,
    },
    ia_alert: {
      titulo: 'Alerta de Ritmo de Gasto',
      resumen:
        'A este ritmo, tu categoría de Alimentación excederá el límite asignado en aproximadamente 3 días (+S/ 185.00 proyectados).',
      sugerencia: 'Rebalancear Presupuesto',
    },
    filtros: ['Todos 6', 'Normal 3', 'Precaución 2', 'Crítico 1'],
    categorias: [
      {
        id: 1,
        nombre: 'Alimentación',
        descripcion: 'Supermercados, delivery y restaurantes',
        presupuesto: 1200.0,
        gastado: 1137.5,
        restante: 62.5,
        porcentaje: 94.8,
        estado: 'Crítico',
        badge: 'Crítico: Cerca del límite',
        proyeccion: 1385.0,
        detalle: 'Proyección a fin de mes: S/ 1,385.00',
        color: 'red',
        icon: 'shopping',
      },
      {
        id: 2,
        nombre: 'Transporte',
        descripcion: 'Combustible, peajes y apps de taxi',
        presupuesto: 500.0,
        gastado: 440.0,
        restante: 60.0,
        porcentaje: 88.0,
        estado: 'Precaución',
        badge: 'Precaución',
        proyeccion: 515.0,
        detalle: 'Proyección estimada: S/ 515.00',
        color: 'amber',
        icon: 'car',
      },
      {
        id: 3,
        nombre: 'Vivienda & Servicios',
        descripcion: 'Alquiler, luz, agua, internet y mantenimiento',
        presupuesto: 1400.0,
        gastado: 950.0,
        restante: 450.0,
        porcentaje: 67.8,
        estado: 'Normal',
        badge: 'En control',
        proyeccion: 950.0,
        detalle: 'Meta mensual dentro de rango planeado',
        color: 'green',
        icon: 'home',
      },
      {
        id: 4,
        nombre: 'Entretenimiento & Ocio',
        descripcion: 'Cine, streaming y salidas de fin de semana',
        presupuesto: 500.0,
        gastado: 390.0,
        restante: 110.0,
        porcentaje: 78.0,
        estado: 'Precaución',
        badge: 'Precaución',
        proyeccion: 390.0,
        detalle: 'Quedan S/ 15.70 diarios asignables',
        color: 'amber',
        icon: 'gamepad',
      },
      {
        id: 5,
        nombre: 'Salud & Cuidado',
        descripcion: 'Farmacia, consultas médicas y bienestar',
        presupuesto: 400.0,
        gastado: 180.0,
        restante: 220.0,
        porcentaje: 45.0,
        estado: 'Normal',
        badge: 'En control',
        proyeccion: 180.0,
        detalle: 'Excelente balance a fin de mes',
        color: 'green',
        icon: 'health',
      },
    ],
  },
  accounts: {
    patrimonio: 8450.0,
    liquidez: 7750.0,
    efectivo: 700.0,
    accounts: [
      {
        id: 1,
        nombre: 'BCP Débito Soles',
        tipo: 'Cuenta Corriente',
        estado: 'Activa',
        saldo: 4280.0,
        descripcion: '**** 4812',
        badge: 'Activa',
        icon: 'credit',
      },
      {
        id: 2,
        nombre: 'BBVA Ahorros Sueldo',
        tipo: 'Ahorros Automáticos',
        estado: 'Activa',
        saldo: 2850.0,
        descripcion: '**** 9104',
        badge: 'Activa',
        icon: 'piggy',
      },
      {
        id: 3,
        nombre: 'Billetera Digital Yape / Plin',
        tipo: 'Vinculada a teléfono',
        estado: 'Instantánea',
        saldo: 620.0,
        descripcion: '987 - *** - 123',
        badge: 'Instantánea',
        icon: 'phone',
      },
      {
        id: 4,
        nombre: 'Efectivo Disponible en Bóveda',
        tipo: 'Fondo manual de emergencia',
        estado: 'Físico',
        saldo: 700.0,
        descripcion: 'Fondo manual de emergencia',
        badge: 'Físico',
        icon: 'cash',
      },
    ],
  },
  alerts: {
    filters: ['Todas (5)', 'Presupuesto (2)', 'Gastos Inusuales (1)', 'Vencimientos (1)', 'Metas (1)'],
    items: [
      {
        id: 1,
        tipo: 'Presupuesto',
        titulo: 'Límite de presupuesto excedido en Alimentación',
        descripcion: 'Consumo al 94.8% del tope asignado. Solo restan S/ 62.50 para los próximos 8 días.',
        nivel: 'rojo',
        tiempo: 'Hace 2h',
        porcentaje: 94.8,
        badge: 'PRESUPUESTO CRÍTICO',
      },
      {
        id: 2,
        tipo: 'Gastos Inusuales',
        titulo: 'Consumo atípico detectado',
        descripcion: 'Pago de S/ 380.00 en Tiendas Ripley supera tu promedio histórico semanal en compras de comercio minorista.',
        nivel: 'amber',
        tiempo: 'Ayer',
        badge: 'GASTO INUSUAL',
      },
      {
        id: 3,
        tipo: 'Vencimientos',
        titulo: 'Vencimiento Tarjeta Interbank',
        descripcion: 'Pago mínimo sugerido de S/ 480.00 para evitar penalidades e intereses moratorios.',
        nivel: 'indigo',
        tiempo: 'En 3 días',
        badge: 'VENCIMIENTO',
      },
      {
        id: 4,
        tipo: 'Metas',
        titulo: 'Ahorro mensual alcanzó nuevo récord',
        descripcion: 'Has logrado consolidar +S/ 1,200.00 ahorrados en este ciclo, superando tu objetivo por un 20%.',
        nivel: 'green',
        tiempo: 'Hoy',
        badge: 'META SUPERADA',
      },
    ],
  },
}

export const emptyFinanceData = {
  dashboard: {
    balance_total: 0,
    balance_variacion: '0.0% vs mes anterior',
    ingresos_mensuales: 0,
    ingresos_variacion: '0.0%',
    gastos_mensuales: 0,
    gastos_variacion: '0.0%',
    presupuesto_porcentaje: 0,
    presupuesto_limite: 0,
    presupuesto_consumido: 0,
    presupuesto_restante: 0,
    evolucion_saldo: [],
    distribucion_gastos: [],
    alertas_activas: [],
    ultimas_transacciones: [],
  },
  transactions: { total_ingresos: 0, total_gastos: 0, neto: 0, grupos: [] },
  budgets: {
    summary: { total_consumido: 0, total_asignado: 0, porcentaje: 0, restante: 0, dias_restantes: 0 },
    ia_alert: { titulo: '', resumen: '', sugerencia: '' },
    filtros: ['Todos 0'],
    categorias: [],
  },
  accounts: { patrimonio: 0, liquidez: 0, efectivo: 0, accounts: [] },
  alerts: { filters: ['Todas (0)'], items: [] },
}

export const finovaApi = {
  async getDashboard(params = {}) {
    const query = new URLSearchParams({ ...params }).toString()
    return request(`/dashboard/resumen/${query ? `?${query}` : ''}`)
  },
  async getTransactions(params = {}) {
    const query = new URLSearchParams({ ...params }).toString()
    return request(`/transacciones/${query ? `?${query}` : ''}`)
  },
  async createTransaction(payload) {
    return request('/transacciones/', { method: 'POST', body: payload })
  },
  async deleteTransaction(id) {
    return request(`/transacciones/${id}/`, { method: 'DELETE' })
  },
  async transfer(payload) {
    return request('/transacciones/transferir/', { method: 'POST', body: payload })
  },
  async deposit(payload) {
    return request('/transacciones/depositar/', { method: 'POST', body: payload })
  },
  async getBudgets(params = {}) {
    const query = new URLSearchParams({ ...params }).toString()
    return request(`/presupuestos/${query ? `?${query}` : ''}`)
  },
  async createBudget(payload) {
    return request('/presupuestos/', { method: 'POST', body: payload })
  },
  async adjustBudget(id, payload) {
    return request(`/presupuestos/${id}/ajustar/`, { method: 'PATCH', body: payload })
  },
  async deleteBudget(id) {
    return request(`/presupuestos/${id}/ajustar/`, { method: 'DELETE' })
  },
  async rebalanceBudget(payload) {
    return request('/presupuestos/rebalancear/', { method: 'POST', body: payload })
  },
  async getAccounts() {
    const data = await request('/cuentas/')
    return { ...data, accounts: data.accounts ?? data.cuentas ?? [] }
  },
  async createAccount(payload) {
    return request('/cuentas/', { method: 'POST', body: payload })
  },
  async updateAccountBalance(id, payload) {
    return request(`/cuentas/${id}/saldo/`, { method: 'PATCH', body: payload })
  },
  async getAlerts(params = {}) {
    const query = new URLSearchParams({ ...params }).toString()
    return request(`/alertas/${query ? `?${query}` : ''}`)
  },
  async actOnAlert(id, payload) {
    return request(`/alertas/${id}/accion/`, { method: 'POST', body: payload })
  },
  async silenceAllAlerts() {
    return request('/alertas/silenciar-todo/', { method: 'POST', body: {} })
  },
  async exportTransactions() {
    const response = await fetch(`${API_BASE}/transacciones/exportar/`, {
      credentials: 'include',
      headers: { Accept: 'text/csv' },
    })
    if (!response.ok) throw new Error('No se pudo exportar el reporte.')
    return response.blob()
  },
}
