import { useId, useRef, useState } from 'react'
import { ErrorState, Modal, Skeleton } from '../../components/ui'
import { formatDay, isValidDate } from './dates'

/**
 * Formulario de movimientos dentro de un Modal (variante local de `FormDialog`).
 *
 * El `FormField` compartido no reenvía `max`, `list` ni `disabled`, y aquí hacen falta para:
 * fecha con tope "hoy", sugerencias de categoría (<datalist> + chips) y selector de tipo.
 * Mantiene el mismo contrato: `onSubmit` puede lanzar un ApiError y cada `fieldErrors[campo]`
 * aparece bajo su input; el resto (p. ej. "saldo insuficiente") arriba de los botones.
 *
 * `fields` puede ser un arreglo o una función `(values) => fields` (campos que dependen de otros).
 * Tipos: text · number · select · date · segmented.
 */
export default function MovementFormDialog(props) {
  const { title, description, fields, initialValues = {}, onClose, loading = false, loadError = null, onRetry } = props

  if (loading || loadError) {
    const list = typeof fields === 'function' ? fields(initialValues) : fields
    return (
      <Modal title={title} description={description} onClose={onClose}>
        {loadError ? (
          <ErrorState
            error={loadError}
            title="No pudimos cargar el formulario"
            onRetry={onRetry}
            className="border-0 p-0 shadow-none"
          />
        ) : (
          <div className="space-y-4" role="status" aria-label="Cargando formulario">
            {list.map((field) => (
              <div key={field.name}>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-11 w-full" />
              </div>
            ))}
          </div>
        )}
      </Modal>
    )
  }

  return <FormBody {...props} />
}

function FormBody({
  title,
  description,
  fields,
  initialValues = {},
  validate,
  onSubmit,
  onClose,
  submitLabel = 'Guardar',
  busyLabel = 'Guardando…',
  notice,
}) {
  const formId = useId()
  const formRef = useRef(null)
  const [values, setValues] = useState(() => initialFrom(resolve(fields, initialValues), initialValues))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const list = resolve(fields, values)

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

  function focusFirstError(fieldErrors) {
    const first = list.find((field) => fieldErrors[field.name])
    if (!first) return
    window.requestAnimationFrame(() => {
      const element = formRef.current?.elements.namedItem(first.name)
      const target = element instanceof RadioNodeList ? element[0] : element
      target?.focus?.()
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    const clean = cleanValues(list, values)
    const clientErrors = { ...validateFields(list, clean), ...(validate?.(clean) || {}) }
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      setFormError('')
      focusFirstError(clientErrors)
      return
    }

    setBusy(true)
    setErrors({})
    setFormError('')
    try {
      await onSubmit(clean)
    } catch (error) {
      const names = new Set(list.map((field) => field.name))
      const known = {}
      const unknown = []
      for (const [key, message] of Object.entries(error?.fieldErrors || {})) {
        if (names.has(key)) known[key] = message
        else unknown.push(message)
      }
      setErrors(known)
      setFormError(
        unknown.length > 0
          ? unknown.join(' ')
          : Object.keys(known).length > 0
            ? ''
            : error?.message || 'No se pudo completar la operación.',
      )
      focusFirstError(known)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      description={description}
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
            {busy ? busyLabel : submitLabel}
          </button>
        </div>
      }
    >
      <form id={formId} ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        {notice}
        {list.map((field) => (
          <Field
            key={field.name}
            id={`${formId}-${field.name}`}
            field={field}
            value={values[field.name] ?? ''}
            error={errors[field.name]}
            onChange={(value) => update(field.name, value)}
          />
        ))}
        {formError && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
      </form>
    </Modal>
  )
}

const CONTROL =
  'mt-1.5 h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-base text-slate-800 outline-none transition focus:ring-4 disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm'

function Field({ id, field, value, error, onChange }) {
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [error ? errorId : null, field.hint ? hintId : null].filter(Boolean).join(' ') || undefined
  const tone = error
    ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
    : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/15'

  const feedback = (
    <>
      {field.hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-slate-500">
          {field.hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </>
  )

  if (field.type === 'segmented') {
    return (
      <fieldset aria-describedby={describedBy} disabled={field.disabled}>
        <legend className="block text-sm font-semibold text-slate-700">{field.label}</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
          {field.options.map(([optionValue, optionLabel]) => {
            const checked = value === optionValue
            const activeTone = optionValue === 'INGRESO' ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white text-red-600 shadow-sm'
            return (
              <label
                key={optionValue}
                className={`relative flex min-h-10 cursor-pointer items-center justify-center rounded-lg px-3 text-sm font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500 ${
                  checked ? activeTone : 'text-slate-600 hover:text-slate-900'
                } ${field.disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name={field.name}
                  value={optionValue}
                  checked={checked}
                  onChange={() => onChange(optionValue)}
                  className="sr-only"
                />
                {optionLabel}
              </label>
            )
          })}
        </div>
        {feedback}
      </fieldset>
    )
  }

  const common = {
    id,
    name: field.name,
    value,
    disabled: field.disabled,
    'aria-invalid': error ? 'true' : 'false',
    'aria-describedby': describedBy,
    'aria-required': field.required ? 'true' : undefined,
    onChange: (event) => onChange(event.target.value),
    className: `${CONTROL} ${tone}`,
  }

  const listId = field.suggestions?.length ? `${id}-options` : undefined

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {field.label}
        {!field.required && field.optionalLabel !== false && <span className="font-normal text-slate-400"> (opcional)</span>}
      </label>
      {field.type === 'select' ? (
        <select {...common}>
          {(field.options ?? []).length === 0 && <option value="">{field.emptyLabel || 'Sin opciones disponibles'}</option>}
          {(field.options ?? []).map(([optionValue, optionLabel]) => (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={field.type === 'number' ? 'text' : field.type || 'text'}
          inputMode={field.type === 'number' ? 'decimal' : field.inputMode}
          min={field.type === 'date' ? field.min : undefined}
          max={field.type === 'date' ? field.max : undefined}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          list={listId}
          autoComplete="off"
          enterKeyHint={field.enterKeyHint}
        />
      )}
      {listId && (
        <datalist id={listId}>
          {field.suggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
      {field.quickPicks?.length > 0 && (
        <div role="group" aria-label={`${field.label}: sugerencias`} className="mt-2 flex flex-wrap gap-1.5">
          {field.quickPicks.map((option) => {
            const active = value.trim().toLocaleLowerCase('es') === option.toLocaleLowerCase('es')
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(option)}
                className={`inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium transition ${
                  active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {option}
              </button>
            )
          })}
        </div>
      )}
      {feedback}
    </div>
  )
}

function resolve(fields, values) {
  return typeof fields === 'function' ? fields(values) : fields
}

function initialFrom(fields, initialValues) {
  const values = { ...Object.fromEntries(Object.entries(initialValues).map(([key, value]) => [key, value == null ? '' : String(value)])) }
  for (const field of fields) {
    if (values[field.name] !== undefined && values[field.name] !== '') continue
    if (field.type === 'select' || field.type === 'segmented') values[field.name] = field.options?.[0]?.[0] ?? ''
    else values[field.name] = values[field.name] ?? ''
  }
  return values
}

/** Recorta textos; los montos aceptan coma decimal ("15,50" → "15.50"). */
function cleanValues(fields, values) {
  const result = {}
  for (const field of fields) {
    const raw = values[field.name]
    let value = typeof raw === 'string' ? raw.trim() : raw ?? ''
    if (field.type === 'number' && value) value = value.replace(/\s/g, '').replace(',', '.')
    result[field.name] = value
  }
  return result
}

function validateFields(fields, values) {
  const errors = {}
  for (const field of fields) {
    const value = values[field.name]
    if (field.required && (value === '' || value === undefined || value === null)) {
      errors[field.name] =
        field.requiredMessage ||
        (field.type === 'select' ? 'Selecciona una opción.' : field.type === 'date' ? 'Elige una fecha.' : 'Este campo es obligatorio.')
      continue
    }
    if (value === '') continue
    if (field.type === 'number') {
      const number = Number(value)
      if (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(number)) {
        errors[field.name] = 'Ingresa un monto válido, con hasta 2 decimales (ej. 15.50).'
      } else if (field.min !== undefined && number < Number(field.min)) {
        errors[field.name] = 'Ingresa un monto mayor a 0.'
      }
    }
    if (field.type === 'date') {
      if (!isValidDate(value)) errors[field.name] = 'Ingresa una fecha válida.'
      else if (field.max && value > field.max) errors[field.name] = 'La fecha no puede ser posterior a hoy.'
      else if (field.min && value < field.min) errors[field.name] = `La fecha no puede ser anterior al ${formatDay(field.min)}.`
    }
    if (field.maxLength && value.length > field.maxLength) {
      errors[field.name] = `Máximo ${field.maxLength} caracteres.`
    }
  }
  return errors
}
