import { forwardRef, useId } from 'react'
import { Calculator, ChevronDown, ListChecks } from 'lucide-react'
import { MAX_ADDITIONAL_DEDUCTION_UIT, TAX_YEARS, soles } from './taxRules'

const SOURCES = [
  { key: 'movimientos', label: 'Mis ingresos registrados', icon: ListChecks },
  { key: 'manual', label: 'Simular un ingreso', icon: Calculator },
]

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
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-slate-400">
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
 * Tarjeta de controles: año, origen del ingreso (registrado / simulado), ingreso anual y deducciones.
 * `errors` trae los errores ya resueltos por campo (validación local o 400 de la API).
 */
export default function TaxControls({ params, uit, registeredIncome, errors, incomeInputRef, onSourceChange }) {
  const baseId = useId()
  const { year, yearFromUrl, simulate } = params
  const yearOptions = yearFromUrl && !TAX_YEARS.includes(yearFromUrl) ? [...TAX_YEARS, yearFromUrl].sort((a, b) => b - a) : TAX_YEARS
  const maxAdditional = uit ? MAX_ADDITIONAL_DEDUCTION_UIT * uit : null
  const source = simulate ? 'manual' : 'movimientos'

  const incomeHint =
    params.incomeDraftValue !== null && params.incomeDraftValue !== undefined
      ? `${soles(params.incomeDraftValue)} al año, antes de impuestos.`
      : 'Suma anual de sueldos, gratificaciones y bonos, en soles.'

  const deductionsWarning =
    maxAdditional && params.deductionsDraftValue > maxAdditional
      ? `Supera el máximo: se considerarán ${soles(maxAdditional)} (3 UIT).`
      : undefined
  const deductionsHint = maxAdditional
    ? `Máximo 3 UIT = ${soles(maxAdditional)}. Gastos sustentados con comprobante (alquiler, honorarios, restaurantes…).`
    : 'Gastos sustentados con comprobante (alquiler, honorarios, restaurantes…). Máximo 3 UIT.'

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

        <fieldset className="min-w-0">
          <legend className="text-sm font-semibold text-slate-700">Ingreso a considerar</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
            {SOURCES.map((option) => {
              const Icon = option.icon
              return (
                <label
                  key={option.key}
                  className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 py-1.5 text-center text-sm font-semibold leading-tight text-slate-600 transition hover:text-slate-900 has-[:checked]:bg-white has-[:checked]:text-emerald-700 has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500/50"
                >
                  <input
                    type="radio"
                    name={`${baseId}-source`}
                    value={option.key}
                    checked={source === option.key}
                    onChange={() => onSourceChange(option.key === 'manual')}
                    className="sr-only"
                  />
                  <Icon aria-hidden="true" className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span>{option.label}</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        {simulate ? (
          <AmountInput
            ref={incomeInputRef}
            id={`${baseId}-income`}
            label="Ingreso bruto anual"
            value={params.incomeDraft}
            onChange={params.setIncomeDraft}
            placeholder="Ej. 60,000"
            error={errors.income}
            hint={incomeHint}
          />
        ) : (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-700">Ingresos registrados en {year}</p>
            <p className="mt-1.5 flex h-12 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-base font-semibold text-slate-800 tabular-nums sm:text-sm">
              {registeredIncome === null || registeredIncome === undefined ? '—' : soles(registeredIncome)}
            </p>
            <FieldMessage
              hint="Solo ingresos regulares (p. ej. Salario). No cuentan depósitos, transferencias entre tus cuentas ni ajustes de saldo."
              error={errors.income}
            />
          </div>
        )}

        <AmountInput
          id={`${baseId}-deductions`}
          label="Deducciones adicionales (opcional)"
          value={params.deductionsDraft}
          onChange={params.setDeductionsDraft}
          placeholder="0.00"
          error={errors.deductions}
          warning={deductionsWarning}
          hint={deductionsHint}
        />
      </div>
    </section>
  )
}
