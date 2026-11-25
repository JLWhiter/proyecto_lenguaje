import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Landmark } from 'lucide-react'
import { Modal, useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { usePeriod } from '../../context/PeriodContext'
import { transactionsApi } from '../../lib/api/transactions'
import { toNumber } from '../../lib/format'
import { monthPhrase } from '../../lib/period'
import { accountOptions, useAccounts } from '../accounts/useAccounts'
import { dateOfMovement, defaultMovementDate, occurredAtFromDate, todayInLima } from './dates'
import MovementFormDialog from './MovementFormDialog'
import { similarCategory } from './categoryMatch'
import { MONEY_MOVEMENT_TAGS, useCategories } from './useTransactions'
import { useVisibleMoney } from './useVisibleMoney'

const TYPE_OPTIONS = [
  ['GASTO', 'Gasto'],
  ['INGRESO', 'Ingreso'],
]
const QUICK_PICKS = 5

/**
 * Estado de carga de la lista de cuentas (solo activas) para los <select> de los diálogos.
 * Opciones `[id, 'BCP Cuenta Sueldo · S/ 13,542.61']`; con "Ocultar montos": `'… · ••••'` y,
 * como tercer elemento, el nombre accesible ('BCP Cuenta Sueldo, monto oculto').
 */
function useAccountSelect() {
  const accounts = useAccounts()
  const { text, hidden, symbol } = useVisibleMoney()
  const list = useMemo(() => (accounts.data?.accounts ?? []).filter((account) => !account.archivada), [accounts.data])
  const options = useMemo(() => {
    const base = accountOptions(list, text)
    if (!hidden) return base
    return base.map(([value, label], index) => [value, label, `${list[index].nombre}, monto oculto`])
  }, [list, text, hidden])
  return {
    list,
    options,
    symbol,
    ready: accounts.status === 'ready',
    loading: accounts.status === 'loading',
    loadError: accounts.status === 'error' ? accounts.error : null,
    onRetry: accounts.reload,
  }
}

/**
 * Nombres de categoría para un tipo (INGRESO/GASTO), ordenados por uso, y la categoría existente que se
 * parece a lo escrito (solo cambian tildes, mayúsculas o espacios). Si falla la carga, no hay sugerencias.
 */
function useCategoryNames() {
  const categories = useCategories()
  const list = categories.data?.categorias ?? []
  const namesFor = (type) =>
    list
      .filter((category) => !type || !category.tipos?.length || category.tipos.includes(type))
      .map((category) => category.nombre)
  return {
    namesFor,
    // Primero entre las del mismo tipo; si no, en todo el catálogo.
    similarTo: (typed, type) => similarCategory(typed, namesFor(type)) ?? similarCategory(typed, namesFor()),
  }
}

/** occurred_at a enviar: nada si es hoy (el backend usa "ahora"); si no, ese día con la hora actual de Lima. */
function occurredAtForNew(date) {
  if (!date || date === todayInLima()) return undefined
  return occurredAtFromDate(date)
}

/** Aviso si el movimiento quedó fuera del mes que se está viendo (no aparecerá en la lista). */
function periodNote(date, period) {
  const month = (date || todayInLima()).slice(0, 7)
  return month !== period ? ` Quedó en ${monthPhrase(month)}.` : ''
}

/** Diálogo informativo cuando no hay cuentas suficientes para la operación. */
function NeedAccountsDialog({ title, message, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cerrar
          </button>
          <Link
            to="/app/cuentas"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Landmark className="h-4 w-4" aria-hidden="true" />
            Ir a Cuentas
          </Link>
        </div>
      }
    >
      <p className="text-sm leading-6 text-slate-600">{message}</p>
    </Modal>
  )
}

/**
 * Nueva transacción (ingreso o gasto) o edición de una existente.
 *   <TransactionDialog onClose={…} />                         → nueva
 *   <TransactionDialog initialValues={{ category: '…' }} />    → nueva con campos precargados
 *   <TransactionDialog transaction={mov} onClose={…} />        → editar (PATCH; solo movimientos REGULAR)
 */
export function TransactionDialog({ initialValues = {}, transaction, onClose, onSaved }) {
  const { period } = usePeriod()
  const invalidate = useInvalidate()
  const toast = useToast()
  const accounts = useAccountSelect()
  const categories = useCategoryNames()
  const editing = Boolean(transaction)
  const today = todayInLima()

  const original = useMemo(
    () =>
      transaction
        ? {
            type: transaction.tipo,
            name: transaction.nombre,
            amount: Math.abs(toNumber(transaction.monto)).toFixed(2),
            occurred_at: dateOfMovement(transaction.occurred_at),
            category: transaction.categoria,
            account_id: transaction.cuenta_id != null ? String(transaction.cuenta_id) : '',
          }
        : null,
    [transaction],
  )

  // Al editar, la cuenta original puede estar archivada: se muestra igual para no cambiarla sin querer.
  const accountChoices = useMemo(() => {
    if (!original?.account_id || accounts.options.some(([value]) => value === original.account_id)) return accounts.options
    return [...accounts.options, [original.account_id, `${transaction.cuenta || 'Cuenta'} (archivada)`]]
  }, [accounts.options, original, transaction])

  if (!editing && accounts.ready && accounts.list.length === 0) {
    return (
      <NeedAccountsDialog
        title="Primero crea una cuenta"
        message="Para registrar ingresos o gastos necesitas al menos una cuenta (efectivo, banco o billetera digital)."
        onClose={onClose}
      />
    )
  }

  const fields = (values) => {
    const type = values.type || original?.type
    const names = categories.namesFor(type)
    return [
      {
        name: 'type',
        label: 'Tipo',
        type: 'segmented',
        options: TYPE_OPTIONS,
        disabled: editing,
        hint: editing ? 'El tipo no se puede cambiar. Si te equivocaste, elimina el movimiento y regístralo de nuevo.' : undefined,
      },
      { name: 'name', label: 'Descripción', required: true, maxLength: 160, placeholder: 'Ej. Menú del día' },
      { name: 'amount', label: `Monto (${accounts.symbol})`, type: 'number', min: '0.01', required: true, placeholder: '0.00' },
      { name: 'occurred_at', label: 'Fecha', type: 'date', required: true, max: today },
      {
        name: 'category',
        label: 'Categoría',
        required: true,
        maxLength: 80,
        placeholder: 'Escribe o elige una categoría',
        suggestions: names,
        quickPicks: names.slice(0, QUICK_PICKS),
        // "alimentacion" → «¿Quisiste decir «Alimentación»?» con un botón para usarla.
        suggestion: categories.similarTo(values.category, type),
      },
      { name: 'account_id', label: 'Cuenta', type: 'select', options: accountChoices, required: true },
    ]
  }

  async function submit(values) {
    if (editing) {
      const changes = {}
      if (values.name !== original.name) changes.name = values.name
      if (values.category.toLocaleLowerCase('es') !== original.category.toLocaleLowerCase('es')) changes.category = values.category
      if (Number(values.amount) !== Number(original.amount)) changes.amount = values.amount
      if (values.account_id !== original.account_id) changes.account_id = Number(values.account_id)
      if (values.occurred_at !== original.occurred_at) {
        changes.occurred_at = occurredAtFromDate(values.occurred_at, { keepTimeOf: transaction.occurred_at })
      }
      if (Object.keys(changes).length === 0) {
        toast.info('No hiciste cambios.')
        onClose()
        return
      }
      const result = await transactionsApi.update(transaction.id, changes)
      invalidate(MONEY_MOVEMENT_TAGS)
      toast.success(`${result?.message || 'Movimiento actualizado.'}${periodNote(values.occurred_at, period)}`)
      onSaved?.(result?.data)
      onClose()
      return
    }

    const result = await transactionsApi.create({
      name: values.name,
      category: values.category,
      amount: values.amount,
      type: values.type,
      account_id: Number(values.account_id),
      occurred_at: occurredAtForNew(values.occurred_at),
    })
    invalidate(MONEY_MOVEMENT_TAGS)
    toast.success(`${result?.message || 'Transacción registrada.'}${periodNote(values.occurred_at, period)}`)
    onSaved?.(result?.data)
    onClose()
  }

  return (
    <MovementFormDialog
      title={editing ? 'Editar movimiento' : 'Nueva transacción'}
      loading={accounts.loading}
      loadError={accounts.loadError}
      onRetry={accounts.onRetry}
      fields={fields}
      initialValues={
        original ?? {
          type: 'GASTO',
          account_id: accounts.options[0]?.[0],
          occurred_at: defaultMovementDate(period),
          ...initialValues,
        }
      }
      submitLabel={editing ? 'Guardar cambios' : 'Registrar'}
      onSubmit={submit}
      onClose={onClose}
    />
  )
}

/** Transferencia entre dos cuentas propias. */
export function TransferDialog({ initialValues = {}, onClose }) {
  const { period } = usePeriod()
  const invalidate = useInvalidate()
  const toast = useToast()
  const accounts = useAccountSelect()
  const today = todayInLima()

  if (accounts.ready && accounts.list.length < 2) {
    return (
      <NeedAccountsDialog
        title="Necesitas dos cuentas"
        message={
          accounts.list.length === 0
            ? 'Para transferir necesitas al menos dos cuentas activas y todavía no tienes ninguna.'
            : 'Para transferir necesitas al menos dos cuentas activas: el dinero sale de una y entra en otra. Hoy tienes solo una.'
        }
        onClose={onClose}
      />
    )
  }

  const source = initialValues.source_account_id ?? accounts.options[0]?.[0]
  const destination = accounts.options.find(([value]) => value !== String(source))?.[0]

  return (
    <MovementFormDialog
      title="Transferir entre cuentas"
      description="Se registran dos movimientos: la salida y la entrada."
      loading={accounts.loading}
      loadError={accounts.loadError}
      onRetry={accounts.onRetry}
      fields={[
        { name: 'source_account_id', label: 'Cuenta de origen', type: 'select', options: accounts.options, required: true },
        { name: 'destination_account_id', label: 'Cuenta de destino', type: 'select', options: accounts.options, required: true },
        { name: 'amount', label: `Monto (${accounts.symbol})`, type: 'number', min: '0.01', required: true, placeholder: '0.00' },
        { name: 'occurred_at', label: 'Fecha', type: 'date', max: today, hint: 'Si la dejas vacía se usa la fecha y hora actuales.' },
        { name: 'description', label: 'Descripción', maxLength: 160, placeholder: 'Ej. Recarga de Yape' },
      ]}
      initialValues={{
        destination_account_id: destination,
        occurred_at: defaultMovementDate(period),
        ...initialValues,
        source_account_id: source != null ? String(source) : '',
      }}
      validate={(values) =>
        values.source_account_id && values.source_account_id === values.destination_account_id
          ? { destination_account_id: 'Elige una cuenta distinta a la de origen.' }
          : {}
      }
      submitLabel="Transferir"
      onSubmit={async (values) => {
        const result = await transactionsApi.transfer({
          source_account_id: Number(values.source_account_id),
          destination_account_id: Number(values.destination_account_id),
          amount: values.amount,
          description: values.description,
          occurred_at: occurredAtForNew(values.occurred_at),
        })
        invalidate(MONEY_MOVEMENT_TAGS)
        toast.success(`${result?.message || 'Transferencia realizada.'}${periodNote(values.occurred_at, period)}`)
        onClose()
      }}
      onClose={onClose}
    />
  )
}

/** Depósito a una cuenta. */
export function DepositDialog({ initialValues = {}, onClose }) {
  const { period } = usePeriod()
  const invalidate = useInvalidate()
  const toast = useToast()
  const accounts = useAccountSelect()
  const today = todayInLima()

  if (accounts.ready && accounts.list.length === 0) {
    return (
      <NeedAccountsDialog
        title="Primero crea una cuenta"
        message="Para registrar un depósito necesitas al menos una cuenta activa."
        onClose={onClose}
      />
    )
  }

  return (
    <MovementFormDialog
      title="Registrar depósito"
      loading={accounts.loading}
      loadError={accounts.loadError}
      onRetry={accounts.onRetry}
      fields={[
        { name: 'account_id', label: 'Cuenta destino', type: 'select', options: accounts.options, required: true },
        { name: 'amount', label: `Monto (${accounts.symbol})`, type: 'number', min: '0.01', required: true, placeholder: '0.00' },
        { name: 'occurred_at', label: 'Fecha', type: 'date', max: today, hint: 'Si la dejas vacía se usa la fecha y hora actuales.' },
        { name: 'description', label: 'Descripción', maxLength: 160, placeholder: 'Ej. Depósito en ventanilla' },
      ]}
      initialValues={{ account_id: accounts.options[0]?.[0], occurred_at: defaultMovementDate(period), ...initialValues }}
      submitLabel="Depositar"
      onSubmit={async (values) => {
        const result = await transactionsApi.deposit({
          account_id: Number(values.account_id),
          amount: values.amount,
          description: values.description,
          occurred_at: occurredAtForNew(values.occurred_at),
        })
        invalidate(MONEY_MOVEMENT_TAGS)
        toast.success(`${result?.message || 'Depósito realizado.'}${periodNote(values.occurred_at, period)}`)
        onClose()
      }}
      onClose={onClose}
    />
  )
}
