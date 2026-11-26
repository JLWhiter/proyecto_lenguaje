import { useId, useRef, useState } from 'react'
import { Modal } from '../../components/ui'
import { FormDialogFooter, FormDialogPlaceholder } from '../../components/ui/FormDialog'
import { firstFieldWithError, splitServerErrors } from '../../components/ui/formModel'
import { cleanMovementValues, initialMovementValues, resolveFields, validateMovementFields } from './movementForm'

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
 * - `options` de un select: `[valor, texto]` o `[valor, texto, nombreAccesible]` (p. ej. con montos ocultos).
 * - `suggestion` (texto): muestra "¿Quisiste decir «…»?" con un botón que reemplaza el valor.
 */
export default function MovementFormDialog(props) {
  const { title, description, fields, initialValues = {}, onClose, loading = false, loadError = null, onRetry } = props

  if (loading || loadError) {
    return (
      <FormDialogPlaceholder
        title={title}
        description={description}
        fields={resolveFields(fields, initialValues)}
        loadError={loadError}
        onRetry={onRetry}
        onClose={onClose}
      />
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
  const [values, setValues] = useState(() => initialMovementValues(resolveFields(fields, initialValues), initialValues))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const list = resolveFields(fields, values)

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
    const first = firstFieldWithError(list, fieldErrors)
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
    const clean = cleanMovementValues(list, values)
    const clientErrors = { ...validateMovementFields(list, clean), ...validate?.(clean) }
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
      const server = splitServerErrors(list, error)
      setErrors(server.fieldErrors)
      setFormError(server.formError)
      focusFirstError(server.fieldErrors)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      footer={<FormDialogFooter formId={formId} busy={busy} submitLabel={submitLabel} busyLabel={busyLabel} onClose={onClose} />}
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

/** Ayuda (si no hay error) y error bajo el campo. */
function FieldFeedback({ id, hint, error }) {
  return (
    <>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </>
  )
}

/** Selector de dos opciones (Ingreso | Gasto) con radios nativos. */
function SegmentedField({ id, field, value, error, describedBy, onChange }) {
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
      <FieldFeedback id={id} hint={field.hint} error={error} />
    </fieldset>
  )
}

/** <select> o <input> con los atributos que este formulario necesita (max, list, disabled…). */
function FieldControl({ id, field, value, error, describedBy, onChange }) {
  const tone = error
    ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
    : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/15'
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

  if (field.type === 'select') {
    const options = field.options ?? []
    return (
      <select {...common}>
        {options.length === 0 && <option value="">{field.emptyLabel || 'Sin opciones disponibles'}</option>}
        {options.map(([optionValue, optionLabel, optionName]) => (
          <option key={optionValue} value={optionValue} aria-label={optionName}>
            {optionLabel}
          </option>
        ))}
      </select>
    )
  }

  const isNumber = field.type === 'number'
  const isDate = field.type === 'date'
  return (
    <input
      {...common}
      type={isNumber ? 'text' : field.type || 'text'}
      inputMode={isNumber ? 'decimal' : field.inputMode}
      min={isDate ? field.min : undefined}
      max={isDate ? field.max : undefined}
      maxLength={field.maxLength}
      placeholder={field.placeholder}
      list={field.suggestions?.length ? `${id}-options` : undefined}
      autoComplete="off"
      enterKeyHint={field.enterKeyHint}
    />
  )
}

/** "¿Quisiste decir «…»?" en una región viva siempre presente (se anuncia cuando aparece). */
function SuggestionNote({ id, suggestion, onChange }) {
  return (
    <div aria-live="polite">
      {suggestion && (
        <p
          id={`${id}-suggestion`}
          className="mt-2 flex flex-wrap items-center gap-x-2 rounded-xl bg-amber-50 py-0.5 pl-3 pr-1 text-sm text-amber-900"
        >
          <span>¿Quisiste decir «{suggestion}»?</span>
          <button
            type="button"
            onClick={() => onChange(suggestion)}
            className="inline-flex min-h-10 items-center rounded-lg px-2 font-semibold text-emerald-700 underline-offset-2 hover:underline"
          >
            Usar «{suggestion}»
          </button>
        </p>
      )}
    </div>
  )
}

/** Chips de valores frecuentes (p. ej. categorías). `min-w-auto` anula el mínimo que el navegador da a <fieldset>. */
function QuickPicks({ field, value, onChange }) {
  const current = value.trim().toLocaleLowerCase('es')
  return (
    <fieldset aria-label={`${field.label}: sugerencias`} className="mt-2 flex min-w-auto flex-wrap gap-1.5">
      {field.quickPicks.map((option) => {
        const active = current === option.toLocaleLowerCase('es')
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
    </fieldset>
  )
}

function Field({ id, field, value, error, onChange }) {
  const describedBy =
    [error ? `${id}-error` : null, field.suggestion ? `${id}-suggestion` : null, field.hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(' ') || undefined

  if (field.type === 'segmented') {
    return <SegmentedField id={id} field={field} value={value} error={error} describedBy={describedBy} onChange={onChange} />
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {field.label}
        {!field.required && field.optionalLabel !== false && <span className="font-normal text-slate-400"> (opcional)</span>}
      </label>
      <FieldControl id={id} field={field} value={value} error={error} describedBy={describedBy} onChange={onChange} />
      {field.suggestions?.length > 0 && (
        <datalist id={`${id}-options`}>
          {field.suggestions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
      {'suggestion' in field && <SuggestionNote id={id} suggestion={field.suggestion} onChange={onChange} />}
      {field.quickPicks?.length > 0 && <QuickPicks field={field} value={value} onChange={onChange} />}
      <FieldFeedback id={id} hint={field.hint} error={error} />
    </div>
  )
}
