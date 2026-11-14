import { useState } from 'react'
import { X } from 'lucide-react'

const FIELD_SETS = {
  transaction: {
    title: 'Nueva transacción',
    fields: [
      { name: 'name', label: 'Descripción', type: 'text', required: true },
      { name: 'category', label: 'Categoría', type: 'text', required: true },
      { name: 'amount', label: 'Monto (S/)', type: 'number', min: '0.01', step: '0.01', required: true },
      { name: 'type', label: 'Tipo', type: 'select', options: [['GASTO', 'Gasto'], ['INGRESO', 'Ingreso']] },
      { name: 'account_id', label: 'Cuenta', type: 'account' },
    ],
  },
  transfer: {
    title: 'Transferir entre cuentas',
    fields: [
      { name: 'source_account_id', label: 'Cuenta de origen', type: 'account' },
      { name: 'destination_account_id', label: 'Cuenta de destino', type: 'account' },
      { name: 'amount', label: 'Monto (S/)', type: 'number', min: '0.01', step: '0.01', required: true },
      { name: 'description', label: 'Descripción', type: 'text' },
    ],
  },
  deposit: {
    title: 'Registrar depósito',
    fields: [
      { name: 'account_id', label: 'Cuenta destino', type: 'account' },
      { name: 'amount', label: 'Monto (S/)', type: 'number', min: '0.01', step: '0.01', required: true },
      { name: 'description', label: 'Descripción', type: 'text' },
    ],
  },
  account: {
    title: 'Agregar cuenta',
    fields: [
      { name: 'name', label: 'Nombre de la cuenta', type: 'text', required: true },
      { name: 'account_type', label: 'Tipo de cuenta', type: 'text', required: true },
      { name: 'description', label: 'Descripción o últimos dígitos', type: 'text' },
      { name: 'balance', label: 'Saldo inicial (S/)', type: 'number', min: '0', step: '0.01' },
      { name: 'icon', label: 'Tipo de cuenta', type: 'select', options: [['credit', 'Cuenta bancaria'], ['piggy', 'Ahorros'], ['phone', 'Billetera digital'], ['cash', 'Efectivo']] },
    ],
  },
  budget: {
    title: 'Crear presupuesto',
    fields: [
      { name: 'category', label: 'Categoría', type: 'text', required: true },
      { name: 'description', label: 'Descripción', type: 'text' },
      { name: 'limit_amount', label: 'Límite mensual (S/)', type: 'number', min: '0.01', step: '0.01', required: true },
      { name: 'icon', label: 'Ícono', type: 'select', options: [['shopping', 'Alimentación'], ['car', 'Transporte'], ['home', 'Vivienda'], ['gamepad', 'Entretenimiento'], ['health', 'Salud']] },
    ],
  },
  'adjust-budget': {
    title: 'Ajustar presupuesto',
    fields: [
      { name: 'limit_amount', label: 'Nuevo límite mensual (S/)', type: 'number', min: '0.01', step: '0.01', required: true },
    ],
  },
  'account-balance': {
    title: 'Actualizar saldo',
    fields: [
      { name: 'balance', label: 'Saldo actual (S/)', type: 'number', min: '0', step: '0.01', required: true },
    ],
  },
  rebalance: {
    title: 'Rebalancear presupuestos',
    fields: [
      { name: 'source_category', label: 'Presupuesto de origen', type: 'budget' },
      { name: 'target_category', label: 'Presupuesto de destino', type: 'budget' },
      { name: 'amount', label: 'Monto a mover (S/)', type: 'number', min: '0.01', step: '0.01', required: true },
    ],
  },
}

export default function FinanceActionDialog({ kind, accounts, budgets, initialValues = {}, error, busy, onClose, onSubmit }) {
  const config = FIELD_SETS[kind]
  const [values, setValues] = useState(() => {
    const defaults = {}
    for (const field of config.fields) {
      if (field.type === 'select') defaults[field.name] = field.options[0][0]
      if (field.type === 'account') {
        defaults[field.name] = field.name === 'destination_account_id'
          ? accounts[1]?.id ?? accounts[0]?.id ?? ''
          : accounts[0]?.id ?? ''
      }
      if (field.type === 'budget') defaults[field.name] = budgets[0]?.nombre ?? ''
    }
    if (kind === 'transaction') defaults.type = 'GASTO'
    if (kind === 'rebalance') {
      defaults.source_category = 'Salud & Cuidado'
      defaults.target_category = 'Alimentación'
      defaults.amount = '150.00'
    }
    if (kind === 'adjust-budget' && initialValues.limit_amount !== undefined) {
      defaults.limit_amount = initialValues.limit_amount
    }
    if (kind === 'account-balance' && initialValues.balance !== undefined) {
      defaults.balance = initialValues.balance
    }
    return { ...defaults, ...initialValues }
  })

  function update(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  function submit(event) {
    event.preventDefault()
    onSubmit(values)
  }

  function renderField(field) {
    const common = {
      id: `finance-${field.name}`,
      name: field.name,
      required: field.required,
      value: values[field.name] ?? '',
      onChange: (event) => update(field.name, event.target.value),
      className: 'mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10',
    }

    if (field.type === 'select' || field.type === 'account' || field.type === 'budget') {
      const options = field.type === 'select'
        ? field.options
        : field.type === 'account'
          ? accounts.map((account) => [String(account.id), `${account.nombre} · S/ ${Number(account.saldo).toFixed(2)}`])
          : budgets.map((budget) => [budget.nombre, budget.nombre])
      return (
        <select {...common}>
          {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      )
    }

    return <input {...common} type={field.type} min={field.min} step={field.step} />
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="finance-dialog-title" className="max-h-[92svh] w-full overflow-y-auto rounded-t-[24px] bg-white p-5 shadow-2xl sm:max-w-lg sm:rounded-[24px] sm:p-6">
        <header className="flex items-center justify-between gap-4">
          <h2 id="finance-dialog-title" className="text-xl font-bold text-slate-900">{config.title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={submit} className="mt-5 space-y-4">
          {config.fields.map((field) => (
            <label key={field.name} htmlFor={`finance-${field.name}`} className="block text-sm font-semibold text-slate-700">
              {field.label}
              {renderField(field)}
            </label>
          ))}
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700">Cancelar</button>
            <button type="submit" disabled={busy} className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
