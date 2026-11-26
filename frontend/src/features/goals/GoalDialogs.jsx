import { useId, useMemo, useRef, useState } from 'react'
import { FormDialog, useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { usePreferences } from '../../context/PreferencesContext'
import { useMoney } from '../../hooks/useMoney'
import { goalsApi } from '../../lib/api/goals'
import { HIDDEN_AMOUNT, toNumber } from '../../lib/format'
import { normalizeAmount } from '../budgets/budgetModel'
import { controlClass, Field, focusFirstError, FormModal, splitApiErrors } from '../budgets/FormParts'
import { todayInLima } from '../transactions/dates'
import {
  addDays,
  DEFAULT_ICON,
  DESCRIPTION_MAX,
  GOAL_ICONS,
  GOAL_MUTATION_TAGS,
  goalFormErrors,
  goalNameKey,
  goalPayload,
  movementErrors,
  NAME_MAX,
  NO_LEDGER_NOTE,
  STATUS,
  WITHDRAWAL,
  WITHDRAWAL_NOTE,
} from './goalModel'

const GOAL_FIELDS = ['name', 'target_amount', 'target_date', 'icon', 'description', 'initial_amount']
const AMOUNT_PLACEHOLDER = '0.00'

function initialGoalValues(goal) {
  return {
    name: goal?.nombre ?? '',
    target_amount: goal ? toNumber(goal.objetivo).toFixed(2) : '',
    target_date: goal?.fecha_objetivo ?? '',
    icon: goal?.icono ?? DEFAULT_ICON,
    description: goal?.descripcion ?? '',
    initial_amount: '',
  }
}

/**
 * Crear (sin `goal`) o editar (con `goal`) una meta. `goals`: las metas activas, para avisar
 * antes de enviar si el nombre ya existe. Al editar solo se envían los campos que cambiaron.
 */
export function GoalFormDialog({ goal = null, goals = [], onClose }) {
  const isEdit = Boolean(goal)
  const invalidate = useInvalidate()
  const toast = useToast()
  const { symbol } = useMoney()
  const formId = useId()
  const formRef = useRef(null)
  const today = todayInLima()
  const [values, setValues] = useState(() => initialGoalValues(goal))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const takenNames = useMemo(
    () => new Set(goals.filter((item) => item.id !== goal?.id && !item.archivada).map((item) => goalNameKey(item.nombre))),
    [goals, goal?.id],
  )

  function update(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
    setFormError('')
  }

  function showErrors(fields, message = '') {
    setErrors(fields)
    setFormError(message)
    focusFirstError(formRef, GOAL_FIELDS, fields)
  }

  async function save(body) {
    setBusy(true)
    showErrors({})
    try {
      const result = isEdit ? await goalsApi.update(goal.id, body) : await goalsApi.create(body)
      invalidate(GOAL_MUTATION_TAGS)
      const name = result?.data?.nombre || body.name || goal?.nombre
      toast.success(isEdit ? `Guardaste los cambios de «${name}».` : `Creaste la meta «${name}».`)
      onClose()
    } catch (error) {
      const { fields, message } = splitApiErrors(error, GOAL_FIELDS)
      showErrors(fields, message)
      setBusy(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    const clientErrors = goalFormErrors(values, { today, takenNames, goal })
    if (Object.keys(clientErrors).length > 0) {
      showErrors(clientErrors)
      return
    }
    const body = goalPayload(values, goal)
    if (isEdit && Object.keys(body).length === 0) {
      onClose()
      return
    }
    save(body).catch(() => setBusy(false))
  }

  const ids = {
    name: `${formId}-name`,
    target: `${formId}-target`,
    date: `${formId}-date`,
    description: `${formId}-description`,
    initial: `${formId}-initial`,
  }

  return (
    <FormModal
      formId={formId}
      formRef={formRef}
      title={isEdit ? 'Editar meta' : 'Nueva meta de ahorro'}
      description={isEdit ? goal.nombre : 'Ponle nombre, monto y fecha a lo que quieres lograr.'}
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={busy}
      submitLabel={isEdit ? 'Guardar cambios' : 'Crear meta'}
      formError={formError}
    >
      <Field id={ids.name} label="Nombre" error={errors.name}>
        {(describedBy) => (
          <input
            id={ids.name}
            name="name"
            value={values.name}
            onChange={(event) => update('name', event.target.value)}
            maxLength={NAME_MAX + 20}
            placeholder="Ej.: Laptop nueva"
            autoComplete="off"
            enterKeyHint="next"
            aria-required="true"
            aria-invalid={errors.name ? 'true' : 'false'}
            aria-describedby={describedBy}
            className={controlClass(errors.name)}
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={ids.target} label={`¿Cuánto quieres juntar? (${symbol})`} error={errors.target_amount}>
          {(describedBy) => (
            <input
              id={ids.target}
              name="target_amount"
              value={values.target_amount}
              onChange={(event) => update('target_amount', event.target.value)}
              inputMode="decimal"
              placeholder={AMOUNT_PLACEHOLDER}
              autoComplete="off"
              aria-required="true"
              aria-invalid={errors.target_amount ? 'true' : 'false'}
              aria-describedby={describedBy}
              className={`${controlClass(errors.target_amount)} tabular-nums`}
            />
          )}
        </Field>

        <Field id={ids.date} label="¿Para cuándo?" error={errors.target_date}>
          {(describedBy) => (
            <input
              id={ids.date}
              name="target_date"
              type="date"
              value={values.target_date}
              min={addDays(today, 1)}
              onChange={(event) => update('target_date', event.target.value)}
              aria-required="true"
              aria-invalid={errors.target_date ? 'true' : 'false'}
              aria-describedby={describedBy}
              className={controlClass(errors.target_date)}
            />
          )}
        </Field>
      </div>

      <GoalIconPicker value={values.icon} error={errors.icon} onChange={(value) => update('icon', value)} />

      <Field id={ids.description} label="Descripción" optional error={errors.description}>
        {(describedBy) => (
          <input
            id={ids.description}
            name="description"
            value={values.description}
            onChange={(event) => update('description', event.target.value)}
            maxLength={DESCRIPTION_MAX + 20}
            placeholder="Ej.: Para estudiar desde casa"
            autoComplete="off"
            aria-invalid={errors.description ? 'true' : 'false'}
            aria-describedby={describedBy}
            className={controlClass(errors.description)}
          />
        )}
      </Field>

      {!isEdit && (
        <Field
          id={ids.initial}
          label={`¿Ya tienes algo separado? (${symbol})`}
          optional
          error={errors.initial_amount}
          hint="Se registra como tu primer aporte. No se descuenta de tus cuentas."
        >
          {(describedBy) => (
            <input
              id={ids.initial}
              name="initial_amount"
              value={values.initial_amount}
              onChange={(event) => update('initial_amount', event.target.value)}
              inputMode="decimal"
              placeholder={AMOUNT_PLACEHOLDER}
              autoComplete="off"
              aria-invalid={errors.initial_amount ? 'true' : 'false'}
              aria-describedby={describedBy}
              className={`${controlClass(errors.initial_amount)} tabular-nums`}
            />
          )}
        </Field>
      )}
    </FormModal>
  )
}

/** Íconos de meta como radios nativos con forma de fichas (las flechas del teclado cambian la opción). */
function GoalIconPicker({ value, error, onChange }) {
  const errorId = useId()
  return (
    <fieldset aria-describedby={error ? errorId : undefined}>
      <legend className="text-sm font-semibold text-slate-700">Ícono</legend>
      <div className="mt-1.5 grid grid-cols-4 gap-2">
        {GOAL_ICONS.map((item) => {
          const { value: option, label, Icon } = item
          const checked = option === value
          const tone = checked ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          return (
            <label
              key={option}
              className={`flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-[11px] font-semibold leading-tight transition focus-within:ring-4 focus-within:ring-emerald-500/20 sm:text-xs ${tone}`}
            >
              <input type="radio" name="icon" value={option} checked={checked} onChange={() => onChange(option)} className="sr-only" />
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="max-w-full break-words">{label}</span>
            </label>
          )
        })}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** Aporte (`kind` APORTE) o retiro (RETIRO) de una meta. No mueve dinero entre cuentas. */
export function MovementDialog({ goal, kind, onClose }) {
  const invalidate = useInvalidate()
  const toast = useToast()
  const { money, symbol } = useMoney()
  const { showAmounts } = usePreferences()
  const today = todayInLima()
  const withdrawing = kind === WITHDRAWAL
  const saved = toNumber(goal.ahorrado)
  const shown = (value) => (showAmounts ? money(value) : HIDDEN_AMOUNT)

  const fields = [
    {
      name: 'amount',
      label: `${withdrawing ? '¿Cuánto retiras?' : '¿Cuánto separas?'} (${symbol})`,
      inputMode: 'decimal',
      placeholder: AMOUNT_PLACEHOLDER,
      required: true,
      hint: withdrawing ? `Tienes ${shown(saved)} en esta meta.` : `Te faltan ${shown(goal.restante)} para tu objetivo.`,
    },
    { name: 'occurred_at', label: 'Fecha', type: 'date', min: goal.creada, required: true },
    { name: 'note', label: 'Nota (opcional)', placeholder: withdrawing ? 'Ej.: Imprevisto del mes' : 'Ej.: Parte de mi gratificación' },
  ]

  async function submit(values) {
    const result = await goalsApi.addMovement(goal.id, {
      tipo: kind,
      amount: normalizeAmount(values.amount),
      occurred_at: values.occurred_at,
      note: values.note ?? '',
    })
    invalidate(GOAL_MUTATION_TAGS)
    if (!withdrawing && result?.data?.estado === STATUS.REACHED) toast.success(`¡Alcanzaste tu meta «${goal.nombre}»!`)
    else toast.success(withdrawing ? `Registraste un retiro de «${goal.nombre}».` : `Registraste un aporte a «${goal.nombre}».`)
    onClose()
  }

  return (
    <FormDialog
      title={withdrawing ? `Retirar de «${goal.nombre}»` : `Aportar a «${goal.nombre}»`}
      description={withdrawing ? WITHDRAWAL_NOTE : NO_LEDGER_NOTE}
      fields={fields}
      initialValues={{ occurred_at: today }}
      validate={(values) =>
        movementErrors(values, { kind, saved, created: goal.creada, today, formatMoney: showAmounts ? money : null })
      }
      onSubmit={submit}
      onClose={onClose}
      submitLabel={withdrawing ? 'Registrar retiro' : 'Registrar aporte'}
      busyLabel="Registrando…"
    />
  )
}
