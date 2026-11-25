import { FormDialog, useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { useMoney } from '../../hooks/useMoney'
import { accountsApi } from '../../lib/api/accounts'

const ACCOUNT_TAGS = ['accounts', 'dashboard']

/** Alta de una cuenta. Errores como "Ya existe una cuenta con ese nombre." aparecen bajo el campo. */
export function AccountDialog({ onClose }) {
  const invalidate = useInvalidate()
  const toast = useToast()
  const { symbol } = useMoney()

  return (
    <FormDialog
      title="Agregar cuenta"
      fields={[
        { name: 'name', label: 'Nombre de la cuenta', required: true },
        { name: 'account_type', label: 'Tipo de cuenta', required: true },
        { name: 'description', label: 'Descripción o últimos dígitos' },
        { name: 'balance', label: `Saldo inicial (${symbol})`, type: 'number', min: '0', step: '0.01' },
        {
          name: 'icon',
          label: 'Categoría de la cuenta',
          type: 'select',
          options: [
            ['credit', 'Cuenta bancaria'],
            ['piggy', 'Ahorros'],
            ['phone', 'Billetera digital'],
            ['cash', 'Efectivo'],
          ],
        },
      ]}
      onSubmit={async (values) => {
        const result = await accountsApi.create(values)
        invalidate(ACCOUNT_TAGS)
        toast.success(result?.message || 'Cuenta creada.')
        onClose()
      }}
      onClose={onClose}
    />
  )
}

/** Corrige el saldo actual de una cuenta. */
export function AccountBalanceDialog({ account, onClose }) {
  const invalidate = useInvalidate()
  const toast = useToast()
  const { symbol } = useMoney()

  return (
    <FormDialog
      title="Actualizar saldo"
      description={account.nombre}
      fields={[{ name: 'balance', label: `Saldo actual (${symbol})`, type: 'number', min: '0', step: '0.01', required: true }]}
      initialValues={{ balance: account.saldo }}
      onSubmit={async (values) => {
        const result = await accountsApi.updateBalance(account.id, values)
        invalidate(ACCOUNT_TAGS)
        toast.success(result?.message || 'Saldo actualizado.')
        onClose()
      }}
      onClose={onClose}
    />
  )
}
