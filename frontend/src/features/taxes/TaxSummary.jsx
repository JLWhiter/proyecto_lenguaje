import { CalendarClock, CheckCircle2, Percent, Receipt } from 'lucide-react'
import { formatPercent, toNumber } from '../../lib/format'
import { FIXED_DEDUCTION_UIT, soles, splitDeductions } from './taxRules'

/**
 * Tarjeta principal: impuesto anual, tasa efectiva y retención mensual aproximada.
 * `status` ('Calculando…', 'Revisa los datos') reemplaza la etiqueta de origen mientras el resultado no está al día.
 */
export function TaxHero({ result, status }) {
  const tax = toNumber(result.impuesto)
  const gross = toNumber(result.ingreso_bruto)
  const net = toNumber(result.renta_neta)
  const uit = toNumber(result.uit)
  const simulated = result.fuente === 'manual'

  return (
    <section aria-labelledby="tax-hero-title" className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Receipt className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 id="tax-hero-title" className="text-base font-semibold text-slate-700">
            Impuesto estimado {result.anio}
          </h2>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            status ? 'bg-slate-100 text-slate-600' : simulated ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {status || (simulated ? 'Simulación' : 'Con tus ingresos registrados')}
        </span>
      </div>

      <p className="mt-5 break-words text-4xl font-extrabold tracking-tight text-slate-900 tabular-nums md:text-5xl">{soles(tax)}</p>
      <p className="mt-2 text-sm text-slate-500">
        Al año, sobre un ingreso bruto de <span className="font-semibold text-slate-700 tabular-nums">{soles(gross)}</span>
      </p>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
          <dt className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <Percent className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            Tasa efectiva
          </dt>
          <dd className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{formatPercent(result.tasa_efectiva)}</dd>
          <dd className="mt-1 text-xs text-slate-500">del ingreso bruto anual</dd>
        </div>
        <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
          <dt className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <CalendarClock className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            Retención mensual aprox.
          </dt>
          <dd className="mt-2 break-words text-2xl font-bold text-slate-900 tabular-nums">{soles(tax / 12)}</dd>
          <dd className="mt-1 text-xs text-slate-500">impuesto anual ÷ 12 meses</dd>
        </div>
      </dl>

      {net <= 0 && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-semibold">No pagarías Impuesto a la Renta en {result.anio}</p>
            <p className="mt-1 leading-6">
              {gross <= FIXED_DEDUCTION_UIT * uit ? (
                <>
                  Tu ingreso anual (<span className="tabular-nums">{soles(gross)}</span>) no supera las 7 UIT (
                  <span className="tabular-nums">{soles(FIXED_DEDUCTION_UIT * uit)}</span>) que se deducen de toda renta de trabajo, así que
                  no queda renta neta sobre la cual pagar.
                </>
              ) : (
                <>Las deducciones cubren todo tu ingreso, así que la renta neta es S/ 0.00 y no hay impuesto.</>
              )}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

function StepRow({ operator, operatorLabel, label, detail, amount, total = false }) {
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 py-3 ${
        total ? 'border-t-2 border-slate-900/80' : 'border-t border-slate-100 first:border-t-0'
      }`}
    >
      <dt className="flex min-w-0 items-baseline gap-2">
        <span aria-hidden="true" className={`w-4 shrink-0 text-center text-base font-bold ${total ? 'text-slate-900' : 'text-slate-400'}`}>
          {operator}
        </span>
        {operatorLabel && <span className="sr-only">{operatorLabel} </span>}
        <span className="min-w-0">
          <span className={`block text-sm ${total ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{label}</span>
          {detail && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{detail}</span>}
        </span>
      </dt>
      <dd className={`whitespace-nowrap text-right tabular-nums ${total ? 'text-base font-bold text-slate-900' : 'text-sm font-semibold text-slate-800'}`}>
        {soles(amount)}
      </dd>
    </div>
  )
}

/** Paso a paso: ingreso bruto − 7 UIT − deducciones adicionales = renta neta → impuesto. */
export function TaxBreakdown({ result, requestedDeductions }) {
  const uit = toNumber(result.uit)
  const gross = toNumber(result.ingreso_bruto)
  const { fixed, fixedLimit, fixedCapped, additional, additionalLimit } = splitDeductions(result)
  const requested = toNumber(requestedDeductions)

  let additionalDetail = `Opcional · máximo 3 UIT (${soles(additionalLimit)})`
  if (requested > 0 && additional <= 0 && fixedCapped) additionalDetail = 'No se aplican: la deducción fija ya cubre todo tu ingreso'
  else if (requested > additionalLimit) additionalDetail = `Se aplicó el tope de 3 UIT (${soles(additionalLimit)})`
  else if (requested > 0 && additional < requested) additionalDetail = 'Limitadas a lo que queda de tu ingreso'

  return (
    <section aria-labelledby="tax-steps-title" className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id="tax-steps-title" className="text-xl font-bold text-slate-900">
        Cómo se calcula
      </h2>
      <p className="mt-1 text-sm text-slate-500">Primero se restan las deducciones; el impuesto se aplica solo a la renta neta.</p>

      <dl className="mt-4">
        <StepRow
          operator=" "
          label="Ingreso bruto anual"
          detail={result.fuente === 'manual' ? 'Monto que ingresaste para simular' : `Tus ingresos regulares de ${result.anio}`}
          amount={gross}
        />
        <StepRow
          operator="−"
          operatorLabel="Menos"
          label={`Deducción fija (${FIXED_DEDUCTION_UIT} UIT)`}
          detail={
            fixedCapped
              ? `Limitada a tu ingreso (7 UIT = ${soles(fixedLimit)})`
              : `${FIXED_DEDUCTION_UIT} × ${soles(uit)}`
          }
          amount={fixed}
        />
        <StepRow operator="−" operatorLabel="Menos" label="Deducciones adicionales" detail={additionalDetail} amount={additional} />
        <StepRow operator="=" operatorLabel="Igual a" label="Renta neta imponible" amount={result.renta_neta} total />
      </dl>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <span className="text-sm font-medium text-emerald-800">Impuesto: suma de cada tramo de la escala</span>
        <span className="whitespace-nowrap text-lg font-bold text-emerald-700 tabular-nums">{soles(result.impuesto)}</span>
      </div>
    </section>
  )
}
