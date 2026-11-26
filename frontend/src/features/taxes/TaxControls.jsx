import { forwardRef, useId } from 'react'
import { CalendarRange, Calculator, ChevronDown, ListChecks } from 'lucide-react'
import TaxAmount, { useAmountsHidden } from './TaxAmount'
import { MAX_ADDITIONAL_DEDUCTION_UIT, TAX_YEARS, monthsCount, soles } from './taxRules'

const SOURCES = [
  { key: 'movimientos', label: 'Mis ingresos registrados', icon: ListChecks },
  { key: 'manual', label: 'Simular un ingreso', icon: Calculator },
]

/** Opción de un control segmentado (radio nativo oculto + etiqueta con forma de ficha). */
const SEGMENT_OPTION =
  'flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 py-1.5 text-center text-sm font-semibold leading-tight text-slate-600 transition hover:text-slate-900 has-[:checked]:bg-white has-[:checked]:text-emerald-700 has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:text-slate-400 has-[:disabled]:hover:text-slate-400'

function controlClass(error) {
  return `h-12 w-full rounded-xl border bg-white text-base text-slate-800 outline-none transition focus:ring-4 sm:text-sm ${
    error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/15'
  }`
}

function FieldMessage({ id, error, warning, hint }) {
  if (error) {
    return (
      <p id={id} className="mt-1.5 text-sm font-medium text-red-600">
        {error}
      </p>
    )
  }
  if (warning) {
    return (
      <p id={id} className="mt-1.5 text-sm font-medium text-amber-700">
        {warning}
      </p>
    )
  }
  if (hint) {
    return (
      <p id={id} className="mt-1.5 text-xs leading-5 text-slate-500">
        {hint}
      </p>
    )
  }
  return null
}

/** Input de monto en soles con prefijo "S/" (texto + teclado decimal: acepta 60000 o 60,000.50). */
const AmountInput = forwardRef(function AmountInput({ id, label, value, onChange, error, warning, hint, placeholder }, ref) {
  const messageId = `${id}-message`
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="relative mt-1.5">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-500">
          S/
        </span>
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error || warning || hint ? messageId : undefined}
          className={`${controlClass(error)} pl-10 pr-3 tabular-nums placeholder:text-slate-400`}
        />
      </div>
      <FieldMessage id={messageId} error={error} warning={warning} hint={hint} />
    </div>
  )
})

/**
 * Año en curso con "Mis ingresos registrados": cuánto lleva registrado y si se proyecta el año completo
 * (opción por defecto) o se usa solo lo registrado. La elección vive en la URL (`?proyectar=`).
 */
function YearProgress({ year, progress, project, onProjectChange }) {
  const baseId = useId()
  const hidden = useAmountsHidden()
  const months = progress.months
  const canProject = progress.projected !== null

  return (
    <div className="min-w-0 rounded-2xl border border-sky-100 bg-sky-50/70 p-3 sm:p-4 md:col-span-2">
      <p className="flex items-start gap-2 text-sm leading-6 text-slate-700">
        <CalendarRange className="mt-1 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
        <span className="min-w-0">
          <span className="font-semibold text-slate-900">Año en curso:</span> llevas{' '}
          <TaxAmount value={progress.recorded} className="font-semibold text-slate-900" />
          {months ? ` en ${monthsCount(months)} con ingresos.` : ' registrados hasta hoy.'}
          {canProject ? ' El año aún no termina: elige cómo estimarlo.' : ' El año aún no termina: es un dato parcial.'}
        </span>
      </p>

      {canProject && (
        <fieldset className="mt-3 min-w-0">
          <legend className="sr-only">Ingreso a usar para {year}</legend>
          <div className="grid gap-1 rounded-2xl bg-slate-100 p-1 sm:grid-cols-2">
            <label className={SEGMENT_OPTION}>
              <input
                type="radio"
                name={`${baseId}-project`}
                value="proyectar"
                checked={project}
                onChange={() => onProjectChange(true)}
                className="sr-only"
              />
              <span>
                Proyectar el año completo
                {!hidden && (
                  <>
                    {' '}
                    <span className="whitespace-nowrap tabular-nums">({soles(progress.projected)})</span>
                  </>
                )}
              </span>
            </label>
            <label className={SEGMENT_OPTION}>
              <input
                type="radio"
                name={`${baseId}-project`}
                value="registrado"
                checked={!project}
                onChange={() => onProjectChange(false)}
                className="sr-only"
              />
              <span>Solo lo registrado</span>
            </label>
          </div>
        </fieldset>
      )}
    </div>
  )
}

/** Ayuda del ingreso simulado: el monto entendido (si se ve) o qué sumar. */
function incomeHintText(draftValue, hidden) {
  if (!hidden && draftValue !== null && draftValue !== undefined) return `${soles(draftValue)} al año, antes de impuestos.`
  return 'Suma anual de sueldos, gratificaciones y bonos, en soles.'
}

/** Aviso (si supera el tope de 3 UIT) y ayuda de las deducciones adicionales. */
function deductionsMessages(maxAdditional, draftValue, hidden) {
  let warning
  if (maxAdditional && draftValue > maxAdditional) {
    warning = hidden ? 'Supera el máximo: se considerarán 3 UIT.' : `Supera el máximo: se considerarán ${soles(maxAdditional)} (3 UIT).`
  }
  const hint =
    maxAdditional && !hidden
      ? `Máximo 3 UIT = ${soles(maxAdditional)}. Gastos sustentados con comprobante (alquiler, honorarios, restaurantes…).`
      : 'Gastos sustentados con comprobante (alquiler, honorarios, restaurantes…). Máximo 3 UIT.'
  return { warning, hint }
}

/** Etiqueta y ayuda del ingreso con "Mis ingresos registrados": año cerrado, año en curso proyectado o hasta hoy. */
function registeredCopy(year, progress, projected) {
  if (progress && projected) {
    return {
      label: 'Ingreso anual proyectado',
      hint: 'Lo que llevas registrado llevado a 12 meses al mismo ritmo. Solo ingresos regulares (p. ej. Salario).',
    }
  }
  if (progress) {
    return {
      label: 'Ingresos registrados hasta hoy',
      hint: 'Solo lo cobrado hasta hoy (ingresos regulares, p. ej. Salario). Como el año no termina, el impuesto final puede ser mayor.',
    }
  }
  return {
    label: `Ingresos registrados en ${year}`,
    hint: 'Solo ingresos regulares (p. ej. Salario). No cuentan depósitos, transferencias entre tus cuentas ni ajustes de saldo.',
  }
}

/** Selector "Ingreso a considerar": registrados o simulado ("registrados" se bloquea con `lockedReason`). */
function SourcePicker({ baseId, source, lockedReason, onSourceChange }) {
  const lockedId = `${baseId}-source-locked`
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-slate-700">Ingreso a considerar</legend>
      <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
        {SOURCES.map((option) => {
          const Icon = option.icon
          const locked = Boolean(lockedReason) && option.key === 'movimientos'
          return (
            <label key={option.key} className={SEGMENT_OPTION}>
              <input
                type="radio"
                name={`${baseId}-source`}
                value={option.key}
                checked={source === option.key}
                disabled={locked}
                aria-describedby={locked ? lockedId : undefined}
                onChange={() => onSourceChange(option.key === 'manual')}
                className="sr-only"
              />
              <Icon aria-hidden="true" className="hidden h-4 w-4 shrink-0 sm:block" />
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
      {lockedReason && (
        <p id={lockedId} className="mt-1.5 text-xs leading-5 text-slate-600">
          {lockedReason}
        </p>
      )}
    </fieldset>
  )
}

/** Ingreso con "Mis ingresos registrados" (solo lectura): proyectado o registrado según la opción elegida. */
function RegisteredIncome({ label, hint, value, error }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-1.5 flex h-12 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-semibold text-slate-800 tabular-nums sm:text-sm">
        {value === null || value === undefined ? '—' : <TaxAmount value={value} />}
      </p>
      <FieldMessage hint={hint} error={error} />
    </div>
  )
}

/**
 * Tarjeta de controles: año, origen del ingreso (registrado / simulado), ingreso anual y deducciones.
 * - `errors` trae los errores ya resueltos por campo (validación local o 400 de la API).
 * - `registeredIncome`: monto a mostrar con "Mis ingresos registrados" (proyectado o registrado).
 * - `progress`: { recorded, months, projected } en el año en curso; null en años cerrados o al simular.
 * - `lockedReason`: por qué "Mis ingresos registrados" no está disponible (moneda distinta de PEN).
 */
export default function TaxControls({ params, uit, registeredIncome, progress, lockedReason, errors, incomeInputRef, onSourceChange }) {
  const baseId = useId()
  const hidden = useAmountsHidden()
  const { year, yearFromUrl, simulate } = params
  const yearOptions = yearFromUrl && !TAX_YEARS.includes(yearFromUrl) ? [...TAX_YEARS, yearFromUrl].sort((a, b) => b - a) : TAX_YEARS
  const maxAdditional = uit ? MAX_ADDITIONAL_DEDUCTION_UIT * uit : null
  const source = simulate ? 'manual' : 'movimientos'
  const projected = Boolean(progress && progress.projected !== null && params.project)
  const deductions = deductionsMessages(maxAdditional, params.deductionsDraftValue, hidden)
  const registered = registeredCopy(year, progress, projected)

  return (
    <section aria-label="Datos para el cálculo" className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-4 md:grid-cols-2 md:gap-5">
        <div className="min-w-0">
          <label htmlFor={`${baseId}-year`} className="block text-sm font-semibold text-slate-700">
            Año fiscal
          </label>
          <div className="relative mt-1.5">
            <select
              id={`${baseId}-year`}
              value={year}
              onChange={(event) => params.setYear(event.target.value)}
              aria-invalid={errors.year ? 'true' : 'false'}
              aria-describedby={errors.year ? `${baseId}-year-message` : undefined}
              className={`${controlClass(errors.year)} cursor-pointer appearance-none pl-3 pr-10 tabular-nums`}
            >
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          </div>
          <FieldMessage id={`${baseId}-year-message`} error={errors.year} />
        </div>

        <SourcePicker baseId={baseId} source={source} lockedReason={lockedReason} onSourceChange={onSourceChange} />

        {!simulate && progress && progress.recorded > 0 && (
          <YearProgress year={year} progress={progress} project={params.project} onProjectChange={params.setProject} />
        )}

        {simulate ? (
          <AmountInput
            ref={incomeInputRef}
            id={`${baseId}-income`}
            label="Ingreso bruto anual"
            value={params.incomeDraft}
            onChange={params.setIncomeDraft}
            placeholder="Ej. 60,000"
            error={errors.income}
            hint={incomeHintText(params.incomeDraftValue, hidden)}
          />
        ) : (
          <RegisteredIncome label={registered.label} hint={registered.hint} value={registeredIncome} error={errors.income} />
        )}

        <AmountInput
          id={`${baseId}-deductions`}
          label="Deducciones adicionales (opcional)"
          value={params.deductionsDraft}
          onChange={params.setDeductionsDraft}
          placeholder="0.00"
          error={errors.deductions}
          warning={deductions.warning}
          hint={deductions.hint}
        />
      </div>
    </section>
  )
}
