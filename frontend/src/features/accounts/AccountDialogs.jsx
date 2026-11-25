import { useId, useMemo, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { FormDialog, FormField, Modal, useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { useMoney } from '../../hooks/useMoney'
import { accountsApi } from '../../lib/api/accounts'
import { toNumber } from '../../lib/format'
import { ACCOUNT_TYPES, DEFAULT_ACCOUNT_TYPE, findAccountType, iconForType } from './accountTypes'
import { ACCOUNT_MUTATION_TAGS, useAccounts } from './useAccounts'

const MAX_AMOUNT = 9_999_999_999.99
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

/** Error de un monto ≥ 0 con hasta 2 decimales, o '' si es válido. */
function amountError(raw, { required = false } = {}) {
  const value = String(raw ?? '').trim()
  if (!value) return required ? 'Ingresa el saldo.' : ''
  const number = Number(value)
  if (!Number.isFinite(number)) return 'Ingresa un número válido.'
  if (number < 0) return 'El saldo no puede ser negativo.'
  if (!AMOUNT_PATTERN.test(value)) return 'Usa como máximo 2 decimales.'
  if (number > MAX_AMOUNT) return 'El monto es demasiado grande.'
  return ''
}

function Note({ children }) {
  return (
    <div className="flex gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-600">
      <Info className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/**
 * Alta (sin `account`) o edición (con `account`) de una cuenta.
 * El ícono se deriva del tipo; el saldo solo se define al crear (luego se usa "Actualizar saldo").
 * Errores del backend como "Ya existe una cuenta con ese nombre." aparecen bajo su campo.
 */
export function AccountFormDialog({ account = null, onClose }) {
  const invalidate = useInvalidate()
  const toast = useToast()
  const { symbol } = useMoney()
  const activeAccounts = useAccounts().data?.accounts
  const isEdit = Boolean(account)

  // El backend también reserva los nombres de cuentas archivadas (no visibles en la lista).
  // Si el nombre repetido no está entre las activas, lo aclaramos para que no parezca un error.
  function explainDuplicate(error, name) {
    if (!error?.fieldErrors?.name || !Array.isArray(activeAccounts)) return error
    const key = String(name ?? '').trim().toLocaleLowerCase('es')
    const visible = activeAccounts.some(
      (item) => item.id !== account?.id && String(item.nombre).trim().toLocaleLowerCase('es') === key,
    )
    if (!visible) {
      error.fieldErrors = {
        ...error.fieldErrors,
        name: 'Ya tienes una cuenta archivada con ese nombre (conserva su historial). Elige otro nombre.',
      }
    }
    return error
  }

  // En edición conservamos un tipo antiguo que no esté en el catálogo para no cambiarlo sin querer.
  const initialType = isEdit ? (findAccountType(account.tipo)?.value ?? account.tipo ?? DEFAULT_ACCOUNT_TYPE) : DEFAULT_ACCOUNT_TYPE
  const typeOptions = useMemo(() => {
    const options = ACCOUNT_TYPES.map((item) => [item.value, item.value])
    if (!options.some(([value]) => value === initialType)) options.push([initialType, initialType])
    return options
  }, [initialType])

  const fields = [
    { name: 'name', label: 'Nombre de la cuenta', required: true, placeholder: 'Ej.: Cuenta sueldo' },
    {
      name: 'account_type',
      label: 'Tipo de cuenta',
      type: 'select',
      options: typeOptions,
      required: true,
      hint: 'El tipo define el ícono y si el saldo cuenta como efectivo.',
    },
    {
      name: 'description',
      label: 'Descripción (opcional)',
      // type 'text' explícito: así un texto vaciado se envía como '' y se borra al editar.
      type: 'text',
      placeholder: 'Ej.: •••• 4812',
      hint: 'Por ejemplo, los últimos 4 dígitos o tu número de celular.',
    },
    ...(isEdit
      ? []
      : [
          {
            name: 'balance',
            label: `Saldo inicial (${symbol})`,
            type: 'number',
            min: '0',
            step: '0.01',
            placeholder: '0.00',
            hint: 'Se registra como un movimiento «Saldo inicial». Déjalo vacío si empieza en 0.',
          },
        ]),
  ]

  return (
    <FormDialog
      title={isEdit ? 'Editar cuenta' : 'Nueva cuenta'}
      description={isEdit ? account.nombre : 'Registra una cuenta bancaria, billetera digital o efectivo.'}
      fields={fields}
      initialValues={
        isEdit
          ? { name: account.nombre, account_type: initialType, description: account.descripcion ?? '' }
          : { account_type: DEFAULT_ACCOUNT_TYPE }
      }
      submitLabel={isEdit ? 'Guardar cambios' : 'Crear cuenta'}
      validate={(values) => {
        const errors = {}
        if (String(values.name ?? '').trim().length > 120) errors.name = 'Usa como máximo 120 caracteres.'
        if (String(values.description ?? '').trim().length > 160) errors.description = 'Usa como máximo 160 caracteres.'
        const balanceError = isEdit ? '' : amountError(values.balance)
        if (balanceError) errors.balance = balanceError
        return errors
      }}
      onSubmit={async (values) => {
        if (isEdit) {
          const changes = {}
          if (values.name !== account.nombre) changes.name = values.name
          if (values.account_type !== initialType) {
            changes.account_type = values.account_type
            changes.icon = iconForType(values.account_type)
          }
          if ((values.description ?? '') !== (account.descripcion ?? '')) changes.description = values.description ?? ''
          if (Object.keys(changes).length === 0) {
            toast.info('No hiciste cambios.')
            onClose()
            return
          }
          const result = await accountsApi.update(account.id, changes).catch((error) => {
            throw explainDuplicate(error, changes.name)
          })
          invalidate(ACCOUNT_MUTATION_TAGS)
          toast.success(result?.message || 'Cuenta actualizada.')
          onClose()
          return
        }

        const payload = {
          name: values.name,
          account_type: values.account_type,
          description: values.description ?? '',
          icon: iconForType(values.account_type),
        }
        if (values.balance !== undefined && values.balance !== '') payload.balance = Number(values.balance).toFixed(2)
        const result = await accountsApi.create(payload).catch((error) => {
          throw explainDuplicate(error, payload.name)
        })
        invalidate(ACCOUNT_MUTATION_TAGS)
        toast.success(result?.data?.nombre ? `Cuenta «${result.data.nombre}» creada.` : result?.message || 'Cuenta creada.')
        onClose()
      }}
      onClose={onClose}
    >
      <Note>
        {isEdit
          ? 'Para cambiar el saldo usa «Actualizar saldo»: así la diferencia queda registrada en tu historial.'
          : 'Finova no se conecta a tu banco: tú registras la cuenta y su saldo. Luego el saldo cambia con los movimientos que anotes.'}
      </Note>
    </FormDialog>
  )
}

/** Compatibilidad: el alta de cuenta como diálogo independiente. */
export function AccountDialog({ onClose }) {
  return <AccountFormDialog onClose={onClose} />
}

/**
 * Corrige el saldo de una cuenta al valor real. El backend registra la diferencia como un
 * movimiento "Ajuste de saldo"; aquí mostramos esa diferencia antes de guardar.
 */
export function AccountBalanceDialog({ account, onClose }) {
  const invalidate = useInvalidate()
  const toast = useToast()
  const { money, signedMoney, symbol } = useMoney()
  const formId = useId()
  const formRef = useRef(null)
  const current = toNumber(account.saldo)
  const [value, setValue] = useState(() => current.toFixed(2))
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const validationError = amountError(value, { required: true })
  const difference = validationError ? null : Math.round((Number(value) - current) * 100) / 100

  function focusInput() {
    window.requestAnimationFrame(() => formRef.current?.elements.namedItem('balance')?.focus())
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    if (validationError) {
      setError(validationError)
      focusInput()
      return
    }
    if (difference === 0) {
      toast.info('El saldo no cambió; no se registró ningún ajuste.')
      onClose()
      return
    }
    setBusy(true)
    setError('')
    setFormError('')
    try {
      const result = await accountsApi.updateBalance(account.id, { balance: Number(value).toFixed(2) })
      invalidate(ACCOUNT_MUTATION_TAGS)
      const movement = result?.movimiento
      toast.success(
        movement
          ? `Saldo actualizado. Se registró un «Ajuste de saldo» de ${signedMoney(movement.monto)}.`
          : result?.message || 'Saldo actualizado.',
      )
      onClose()
    } catch (apiError) {
      const fieldError = apiError?.fieldErrors?.balance
      setError(fieldError || '')
      setFormError(fieldError ? '' : apiError?.message || 'No se pudo actualizar el saldo.')
      if (fieldError) focusInput()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Actualizar saldo"
      description={`${account.nombre} · saldo registrado: ${money(current)}`}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            aria-disabled={busy || undefined}
            className="h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 aria-disabled:cursor-wait aria-disabled:opacity-60"
          >
            {busy ? 'Guardando…' : 'Actualizar saldo'}
          </button>
        </div>
      }
    >
      <form id={formId} ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormField
          id={`${formId}-balance`}
          field={{ name: 'balance', label: `Saldo real de la cuenta (${symbol})`, type: 'number', min: '0', step: '0.01', required: true }}
          value={value}
          error={error}
          onChange={(next) => {
            setValue(next)
            setError('')
            setFormError('')
          }}
        />

        <div aria-live="polite" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-6">
          {difference === null ? (
            <p className="text-slate-500">Ingresa el saldo que ves en tu banco, billetera o bolsillo.</p>
          ) : difference === 0 ? (
            <p className="text-slate-600">Es el mismo saldo registrado: no se creará ningún movimiento.</p>
          ) : (
            <p className="text-slate-700">
              Se registrará un movimiento <strong className="font-semibold">«Ajuste de saldo»</strong> de{' '}
              <strong className={`font-bold tabular-nums ${difference > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {signedMoney(difference)}
              </strong>{' '}
              en esta cuenta.
            </p>
          )}
        </div>

        <Note>
          Úsalo cuando el saldo real no coincide con Finova. Si la diferencia viene de una compra o un ingreso concreto,
          mejor regístralo como transacción para que aparezca en su categoría.
        </Note>

        {formError && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
      </form>
    </Modal>
  )
}
