import { FormDialog, useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { usePeriod } from '../../context/PeriodContext'
import { useMoney } from '../../hooks/useMoney'
import { budgetsApi } from '../../lib/api/budgets'
import { useBudgets } from './useBudgets'

const BUDGET_TAGS = ['budgets', 'dashboard']

/** Nuevo presupuesto para el período seleccionado. */
export function BudgetDialog({ onClose }) {
  const { period, label } = usePeriod()
  const invalidate = useInvalidate()
  const toast = useToast()
  const { symbol } = useMoney()

  return (
    <FormDialog
      title="Crear presupuesto"
      description={`Período: ${label}`}
      fields={[
        { name: 'category', label: 'Categoría', required: true },
        { name: 'description', label: 'Descripción' },
        { name: 'limit_amount', label: `Límite mensual (${symbol})`, type: 'number', min: '0.01', step: '0.01', required: true },
        {
          name: 'icon',
          label: 'Ícono',
          type: 'select',
          options: [
            ['shopping', 'Alimentación'],
            ['car', 'Transporte'],
            ['home', 'Vivienda'],
            ['gamepad', 'Entretenimiento'],
            ['health', 'Salud'],
          ],
        },
      ]}
      onSubmit={async (values) => {
        const result = await budgetsApi.create({ ...values, month: period })
        invalidate(BUDGET_TAGS)
        toast.success(result?.message || 'Presupuesto creado.')
        onClose()
      }}
      onClose={onClose}
    />
  )
}

/** Cambia el límite de un presupuesto existente. */
export function AdjustBudgetDialog({ budget, onClose }) {
  const invalidate = useInvalidate()
  const toast = useToast()
  const { symbol } = useMoney()

  return (
    <FormDialog
      title="Ajustar presupuesto"
      description={budget.nombre}
      fields={[
        { name: 'limit_amount', label: `Nuevo límite mensual (${symbol})`, type: 'number', min: '0.01', step: '0.01', required: true },
      ]}
      initialValues={{ limit_amount: budget.presupuesto }}
      onSubmit={async (values) => {
        const result = await budgetsApi.adjust(budget.id, values)
        invalidate(BUDGET_TAGS)
        toast.success(result?.message || 'Presupuesto actualizado.')
        onClose()
      }}
      onClose={onClose}
    />
  )
}

/** Mueve saldo disponible de un presupuesto a otro dentro del período seleccionado. */
export function RebalanceDialog({ onClose }) {
  const { period } = usePeriod()
  const budgets = useBudgets(period)
  const invalidate = useInvalidate()
  const toast = useToast()
  const { symbol } = useMoney()

  const names = (budgets.data?.categorias ?? []).map((budget) => budget.nombre)
  const options = names.map((name) => [name, name])
  // Sugerencia previa (Salud → Alimentación) solo si esas categorías existen en el período.
  const source = names.includes('Salud & Cuidado') ? 'Salud & Cuidado' : names[0]
  const target = names.includes('Alimentación') ? 'Alimentación' : names.find((name) => name !== source) ?? names[0]

  return (
    <FormDialog
      title="Rebalancear presupuestos"
      loading={budgets.status === 'loading'}
      loadError={budgets.status === 'error' ? budgets.error : null}
      onRetry={budgets.reload}
      fields={[
        { name: 'source_category', label: 'Presupuesto de origen', type: 'select', options, required: true },
        { name: 'target_category', label: 'Presupuesto de destino', type: 'select', options, required: true },
        { name: 'amount', label: `Monto a mover (${symbol})`, type: 'number', min: '0.01', step: '0.01', required: true },
      ]}
      initialValues={{ source_category: source, target_category: target, amount: '150.00' }}
      validate={(values) =>
        values.source_category && values.source_category === values.target_category
          ? { target_category: 'Elige un presupuesto distinto al de origen.' }
          : {}
      }
      onSubmit={async (values) => {
        const result = await budgetsApi.rebalance({ ...values, month: period })
        invalidate(BUDGET_TAGS)
        toast.success(result?.message || 'Presupuesto rebalanceado.')
        onClose()
      }}
      onClose={onClose}
    />
  )
}
