import { FormDialog, useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { usePeriod } from '../../context/PeriodContext'
import { useMoney } from '../../hooks/useMoney'
import { transactionsApi } from '../../lib/api/transactions'
import { occurredAtForPeriod } from '../../lib/period'
import { accountOptions, useAccounts } from '../accounts/useAccounts'
import { MONEY_MOVEMENT_TAGS } from './useTransactions'

/** Estado de carga de la lista de cuentas para los <select> de los diálogos. */
function useAccountSelect() {
  const accounts = useAccounts()
  const { money, symbol } = useMoney()
  const list = accounts.data?.accounts ?? []
  return {
    list,
    options: accountOptions(list, money),
    symbol,
    loading: accounts.status === 'loading',
    loadError: accounts.status === 'error' ? accounts.error : null,
    onRetry: accounts.reload,
  }
}

/** Nueva transacción (ingreso o gasto). `initialValues` permite precargar campos (p. ej. desde una alerta). */
export function TransactionDialog({ initialValues = {}, onClose }) {
  const { period } = usePeriod()
  const invalidate = useInvalidate()
  const toast = useToast()
  const accounts = useAccountSelect()

  return (
    <FormDialog
      title="Nueva transacción"
      loading={accounts.loading}
      loadError={accounts.loadError}
      onRetry={accounts.onRetry}
      fields={[
        { name: 'name', label: 'Descripción', required: true },
        { name: 'category', label: 'Categoría', required: true },
        { name: 'amount', label: `Monto (${accounts.symbol})`, type: 'number', min: '0.01', step: '0.01', required: true },
        { name: 'type', label: 'Tipo', type: 'select', options: [['GASTO', 'Gasto'], ['INGRESO', 'Ingreso']] },
        { name: 'account_id', label: 'Cuenta', type: 'select', options: accounts.options, required: true },
      ]}
      initialValues={{ type: 'GASTO', account_id: accounts.options[0]?.[0], ...initialValues }}
      onSubmit={async (values) => {
        const result = await transactionsApi.create({ ...values, occurred_at: occurredAtForPeriod(period) })
        invalidate(MONEY_MOVEMENT_TAGS)
        toast.success(result?.message || 'Transacción registrada.')
        onClose()
      }}
      onClose={onClose}
    />
  )
}

/** Transferencia entre dos cuentas propias. */
export function TransferDialog({ initialValues = {}, onClose }) {
  const invalidate = useInvalidate()
  const toast = useToast()
  const accounts = useAccountSelect()
  const [first, second] = accounts.options

  return (
    <FormDialog
      title="Transferir entre cuentas"
      loading={accounts.loading}
      loadError={accounts.loadError}
      onRetry={accounts.onRetry}
      fields={[
        { name: 'source_account_id', label: 'Cuenta de origen', type: 'select', options: accounts.options, required: true },
        { name: 'destination_account_id', label: 'Cuenta de destino', type: 'select', options: accounts.options, required: true },
        { name: 'amount', label: `Monto (${accounts.symbol})`, type: 'number', min: '0.01', step: '0.01', required: true },
        { name: 'description', label: 'Descripción' },
      ]}
      initialValues={{
        source_account_id: first?.[0],
        destination_account_id: (second ?? first)?.[0],
        ...initialValues,
      }}
      validate={(values) =>
        values.source_account_id && values.source_account_id === values.destination_account_id
          ? { destination_account_id: 'Elige una cuenta distinta a la de origen.' }
          : {}
      }
      onSubmit={async (values) => {
        const result = await transactionsApi.transfer(values)
        invalidate(MONEY_MOVEMENT_TAGS)
        toast.success(result?.message || 'Transferencia realizada.')
        onClose()
      }}
      onClose={onClose}
    />
  )
}

/** Depósito a una cuenta. */
export function DepositDialog({ initialValues = {}, onClose }) {
  const invalidate = useInvalidate()
  const toast = useToast()
  const accounts = useAccountSelect()

  return (
    <FormDialog
      title="Registrar depósito"
      loading={accounts.loading}
      loadError={accounts.loadError}
      onRetry={accounts.onRetry}
      fields={[
        { name: 'account_id', label: 'Cuenta destino', type: 'select', options: accounts.options, required: true },
        { name: 'amount', label: `Monto (${accounts.symbol})`, type: 'number', min: '0.01', step: '0.01', required: true },
        { name: 'description', label: 'Descripción' },
      ]}
      initialValues={{ account_id: accounts.options[0]?.[0], ...initialValues }}
      onSubmit={async (values) => {
        const result = await transactionsApi.deposit(values)
        invalidate(MONEY_MOVEMENT_TAGS)
        toast.success(result?.message || 'Depósito realizado.')
        onClose()
      }}
      onClose={onClose}
    />
  )
}
