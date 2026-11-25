import { Modal } from '../../components/ui'

/**
 * Piezas de formulario de Presupuestos (variante local de `FormDialog`): aquí hacen falta
 * <datalist>, sugerencias rápidas, selector de íconos y ayudas que cambian con lo que escribes,
 * cosas que el `FormField` compartido no admite. Mismo aspecto: inputs de 44 px, 16 px en móvil.
 */

export function controlClass(error) {
  return `mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-base text-slate-800 outline-none transition focus:ring-4 disabled:opacity-60 sm:text-sm ${
    error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/15'
  }`
}

/**
 * Etiqueta + control + error + `extra` (p. ej. sugerencias) + ayuda.
 * `children(describedBy)` recibe el id para aria-describedby. El error va justo bajo el control.
 */
export function Field({ id, label, optional = false, error, hint, extra = null, children }) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
        {optional && <span className="font-normal text-slate-500"> (opcional)</span>}
      </label>
      {children(describedBy)}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {extra}
      {hint && (
        <div id={`${id}-hint`} className="mt-1.5 text-xs leading-5 text-slate-500">
          {hint}
        </div>
      )}
    </div>
  )
}

/** Modal con <form>, error general arriba de los botones y pie Cancelar / Guardar. */
export function FormModal({ formId, formRef, title, description, onClose, onSubmit, busy, submitLabel = 'Guardar', busyLabel = 'Guardando…', formError, children }) {
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
      <form id={formId} ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5">
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

/** Fichas de valores sugeridos (≥ 40 px). */
export function QuickPicks({ label, options, value, onPick }) {
  if (!options.length) return null
  return (
    <div role="group" aria-label={label} className="mt-2 flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = option.active ?? option.value === value
        return (
          <button
            key={option.key ?? option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(option.value)}
            className={`inline-flex min-h-10 max-w-full items-center rounded-full px-3 text-left text-sm font-medium transition ${
              active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span className="min-w-0 break-words">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Separa los errores de un ApiError: los de campos conocidos van bajo su input;
 * el resto (o el `detail`) se devuelve como mensaje general.
 * `routeDetail(message)` puede devolver el nombre del campo al que pertenece un `detail`.
 */
export function splitApiErrors(error, fieldNames, routeDetail) {
  const names = new Set(fieldNames)
  const fields = {}
  const unknown = []
  for (const [key, message] of Object.entries(error?.fieldErrors || {})) {
    if (names.has(key)) fields[key] = message
    else unknown.push(message)
  }
  let message = unknown.join(' ')
  if (Object.keys(fields).length === 0 && !message) {
    const detail = error?.message || 'No se pudo completar la operación.'
    const target = routeDetail?.(detail)
    if (target && names.has(target)) fields[target] = detail
    else message = detail
  }
  return { fields, message }
}

/** Enfoca el primer campo con error (en el orden de `fieldNames`). */
export function focusFirstError(formRef, fieldNames, errors) {
  const first = fieldNames.find((name) => errors[name])
  if (!first) return
  window.requestAnimationFrame(() => {
    const element = formRef.current?.elements.namedItem(first)
    // Un grupo de radios devuelve un RadioNodeList: se enfoca el marcado.
    if (element && typeof element.focus === 'function') element.focus()
    else if (element?.length) (Array.from(element).find((item) => item.checked) ?? element[0])?.focus()
  })
}
