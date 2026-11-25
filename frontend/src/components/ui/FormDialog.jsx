import { useId, useRef, useState } from 'react'
import Modal from './Modal'
import ErrorState from './ErrorState'
import { Skeleton } from './Skeleton'

/**
 * Formulario dentro de un Modal, definido por configuración.
 *
 *   <FormDialog
 *     title="Agregar cuenta"
 *     fields={[
 *       { name: 'name', label: 'Nombre', required: true },
 *       { name: 'balance', label: 'Saldo (S/)', type: 'number', min: 0, step: '0.01' },
 *       { name: 'icon', label: 'Tipo', type: 'select', options: [['credit', 'Banco'], ['cash', 'Efectivo']] },
 *     ]}
 *     initialValues={{ icon: 'credit' }}
 *     validate={(values) => ({})}          // opcional: errores propios { campo: 'mensaje' }
 *     onSubmit={async (values) => { await accountsApi.create(values); onClose() }}
 *     onClose={onClose}
 *   />
 *
 * - Valida `required` / `min` en el cliente y muestra el mensaje bajo cada input.
 * - Si `onSubmit` lanza un ApiError con `fieldErrors` ({ name: 'Ya existe…' }), cada mensaje
 *   aparece bajo su campo; los errores generales o de campos que no están en el formulario
 *   se muestran arriba de los botones.
 * - `loading` / `loadError` muestran un esqueleto o un error mientras cargan las opciones.
 */
export default function FormDialog(props) {
  const { title, description, fields, onClose, loading = false, loadError = null, onRetry } = props

  if (loading || loadError) {
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
            {fields.map((field) => (
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

  return <FormDialogBody {...props} />
}

function FormDialogBody({
  title,
  description,
  fields,
  initialValues = {},
  validate,
  onSubmit,
  onClose,
  submitLabel = 'Guardar',
  busyLabel = 'Guardando…',
  children,
}) {
  const formId = useId()
  const formRef = useRef(null)
  const [values, setValues] = useState(() => buildInitialValues(fields, initialValues))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

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
    const first = fields.find((field) => fieldErrors[field.name])
    if (!first) return
    window.requestAnimationFrame(() => {
      formRef.current?.elements.namedItem(first.name)?.focus()
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return

    const clientErrors = { ...validateFields(fields, values), ...(validate?.(values) || {}) }
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      focusFirstError(clientErrors)
      return
    }

    setBusy(true)
    setErrors({})
    setFormError('')
    try {
      await onSubmit(cleanValues(fields, values))
    } catch (error) {
      const names = new Set(fields.map((field) => field.name))
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
          {/* aria-disabled (no `disabled`) para que el foco no salte al <body> mientras guarda */}
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
        {fields.map((field) => (
          <FormField
            key={field.name}
            id={`${formId}-${field.name}`}
            field={field}
            value={values[field.name] ?? ''}
            error={errors[field.name]}
            onChange={(value) => update(field.name, value)}
          />
        ))}
        {children}
        {formError && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
      </form>
    </Modal>
  )
}

/** Campo de formulario con label, error y ayuda. Inputs en 16 px en móvil (evita el zoom de iOS). */
export function FormField({ id, field, value, error, disabled, onChange }) {
  const describedBy = error ? `${id}-error` : field.hint ? `${id}-hint` : undefined
  const control = `mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-base text-slate-800 outline-none transition focus:ring-4 disabled:opacity-60 sm:text-sm ${
    error
      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/15'
  }`
  const common = {
    id,
    name: field.name,
    value,
    disabled,
    'aria-invalid': error ? 'true' : 'false',
    'aria-describedby': describedBy,
    'aria-required': field.required ? 'true' : undefined,
    onChange: (event) => onChange(event.target.value),
    className: control,
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {field.label}
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
          type={field.type || 'text'}
          inputMode={field.type === 'number' ? 'decimal' : field.inputMode}
          min={field.min}
          step={field.step}
          placeholder={field.placeholder}
          autoComplete={field.autoComplete ?? 'off'}
        />
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : field.hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {field.hint}
        </p>
      ) : null}
    </div>
  )
}

function buildInitialValues(fields, initialValues) {
  const values = {}
  for (const field of fields) {
    const provided = initialValues[field.name]
    if (provided !== undefined && provided !== null) {
      values[field.name] = String(provided)
    } else if (field.type === 'select') {
      values[field.name] = field.options?.[0]?.[0] ?? ''
    } else {
      values[field.name] = ''
    }
  }
  return values
}

function validateFields(fields, values) {
  const errors = {}
  for (const field of fields) {
    const raw = values[field.name]
    const value = typeof raw === 'string' ? raw.trim() : raw
    if (field.required && (value === '' || value === undefined || value === null)) {
      errors[field.name] = field.type === 'select' ? 'Selecciona una opción.' : 'Este campo es obligatorio.'
      continue
    }
    if (field.type === 'number' && value !== '') {
      const number = Number(value)
      if (!Number.isFinite(number)) {
        errors[field.name] = 'Ingresa un número válido.'
      } else if (field.min !== undefined && number < Number(field.min)) {
        errors[field.name] =
          field.minMessage || (Number(field.min) > 0 ? 'Ingresa un monto mayor a 0.' : 'El monto no puede ser negativo.')
      }
    }
  }
  return errors
}

/** Recorta textos y omite opcionales vacíos (el backend aplica sus valores por defecto). */
function cleanValues(fields, values) {
  const result = {}
  for (const field of fields) {
    const raw = values[field.name]
    const value = typeof raw === 'string' ? raw.trim() : raw
    if (value === '' && !field.required && field.type !== 'text') continue
    result[field.name] = value
  }
  return result
}
