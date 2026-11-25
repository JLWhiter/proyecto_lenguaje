import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, Coins, Info, Landmark, Wallet } from 'lucide-react'
import { EmptyState, ErrorState, Skeleton, SkeletonCard } from '../../components/ui'
import { usePeriod } from '../../context/PeriodContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useMoney } from '../../hooks/useMoney'
import { formatPercent, toNumber } from '../../lib/format'
import TaxBrackets from './TaxBrackets'
import TaxControls from './TaxControls'
import { TaxBreakdown, TaxHero } from './TaxSummary'
import { UIT_BY_YEAR, soles } from './taxRules'
import { useIncomeTax } from './useIncomeTax'
import { useTaxParams } from './useTaxParams'

const DEFAULT_NOTE = 'Estimación de rentas de quinta categoría. No incluye retenciones, créditos ni otras rentas.'

function TaxSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Calculando impuesto">
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-6 h-11 w-60 max-w-full" />
          <Skeleton className="mt-3 h-4 w-52 max-w-full" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
        <SkeletonCard lines={5} />
      </div>
      <SkeletonCard lines={6} />
      <span className="sr-only">Calculando impuesto…</span>
    </div>
  )
}

function TaxNotes({ note, year, uit, currency }) {
  return (
    <section aria-labelledby="tax-notes-title" className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600">
          <Info className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 id="tax-notes-title" className="text-base font-semibold text-slate-900">
            Sobre esta estimación
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{note}</p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
          <dt className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-slate-800">
            <Landmark className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            {uit ? (
              <span>
                UIT {year}: <span className="tabular-nums">{soles(uit)}</span>
              </span>
            ) : (
              <span>UIT</span>
            )}
          </dt>
          <dd className="mt-1.5 text-sm leading-6 text-slate-600">
            La Unidad Impositiva Tributaria es un valor de referencia que el Estado fija cada año. Las deducciones (7 UIT fijas y hasta 3 UIT
            adicionales) y los límites de cada tramo se expresan en UIT.
          </dd>
        </div>
        <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
          <dt className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Coins className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            Montos en soles (S/)
          </dt>
          <dd className="mt-1.5 text-sm leading-6 text-slate-600">
            El impuesto peruano se calcula en soles.
            {currency && currency !== 'PEN'
              ? ` Aunque tu moneda principal es ${currency}, en esta pantalla todos los montos están en S/.`
              : ' Todos los montos de esta pantalla están en S/.'}
          </dd>
        </div>
      </dl>
    </section>
  )
}

export default function TaxesPage() {
  useDocumentTitle('Impuestos')
  const params = useTaxParams()
  const tax = useIncomeTax(params.query)
  const { currency } = useMoney()
  const { search } = usePeriod()
  const incomeInputRef = useRef(null)
  const [focusIncome, setFocusIncome] = useState(false)

  const data = tax.status === 'ready' ? tax.data : undefined
  const sameYear = data && data.anio === params.year
  const uit = (sameYear ? toNumber(data.uit) : null) || UIT_BY_YEAR[params.year] || null
  const registeredIncome = sameYear && data.fuente === 'movimientos' ? toNumber(data.ingreso_bruto) : null

  // 400 de la API → mensaje bajo el campo correspondiente.
  const apiErrors = tax.status === 'error' && tax.error?.status === 400 ? tax.error.fieldErrors ?? {} : {}
  const errors = {
    year: apiErrors.anio,
    income: params.incomeInputError || apiErrors.ingreso_anual,
    deductions: params.deductionsInputError || apiErrors.deducciones_adicionales,
  }
  const hasFieldError = Boolean(apiErrors.anio || apiErrors.ingreso_anual || apiErrors.deducciones_adicionales)
  const busy = tax.stale || params.pending

  useEffect(() => {
    if (focusIncome && params.simulate) {
      incomeInputRef.current?.focus()
      setFocusIncome(false)
    }
  }, [focusIncome, params.simulate])

  function handleSourceChange(simulate) {
    const registered = data?.fuente === 'movimientos' ? toNumber(data.ingreso_bruto) : 0
    params.setSimulate(simulate, { prefill: simulate && registered > 0 ? registered : undefined })
  }

  function startSimulation() {
    params.setSimulate(true)
    setFocusIncome(true)
  }

  let results
  if (tax.status === 'loading' || (data === null && !params.waitingForIncome)) {
    results = <TaxSkeleton />
  } else if (tax.status === 'error') {
    results = hasFieldError ? (
      <EmptyState
        variant="inline"
        className="border border-red-100 bg-red-50/60"
        title="Revisa los datos del cálculo"
        description="Corrige el campo marcado en rojo para ver la estimación."
      />
    ) : (
      <ErrorState title="No pudimos calcular tu impuesto" error={tax.error} onRetry={tax.reload} />
    )
  } else if (data === null) {
    results = (
      <EmptyState
        icon={Calculator}
        title="Ingresa un ingreso anual para simular"
        description="Escribe cuánto ganarías en el año, antes de impuestos, y verás el impuesto estimado al instante."
      />
    )
  } else if (data.fuente === 'movimientos' && toNumber(data.ingreso_bruto) <= 0) {
    results = (
      <EmptyState
        icon={Wallet}
        title={`No tienes ingresos registrados en ${data.anio}`}
        description="Para estimar tu impuesto solo cuentan los ingresos regulares, como Salario u Honorarios. Los depósitos, las transferencias entre tus cuentas y los ajustes de saldo no son renta. Puedes simular un ingreso anual para ver cuánto pagarías."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={startSimulation}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#10B981] px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-200 hover:bg-[#059669]"
            >
              <Calculator className="h-4 w-4" aria-hidden="true" />
              Simular un ingreso
            </button>
            <Link
              to={{ pathname: '/app/movimientos', search }}
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ir a Movimientos
            </Link>
          </div>
        }
      />
    )
  } else {
    results = (
      <>
        <div className="grid gap-5 xl:grid-cols-2">
          <TaxHero
            result={data}
            status={params.incomeInputError || params.deductionsInputError ? 'Revisa los datos' : busy ? 'Calculando…' : null}
          />
          <TaxBreakdown result={data} requestedDeductions={params.query?.deducciones_adicionales} />
        </div>
        <TaxBrackets result={data} />
      </>
    )
  }

  const announcement = data && !busy ? `Impuesto estimado ${soles(data.impuesto)}, tasa efectiva ${formatPercent(data.tasa_efectiva)}.` : ''

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Tributación</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Impuesto a la Renta</h1>
          <p className="mt-1 text-sm text-slate-500">Estimación anual de rentas de trabajo (quinta categoría)</p>
        </div>
        <span className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:self-auto">
          <Coins className="h-4 w-4" aria-hidden="true" />
          Montos en soles (S/)
        </span>
      </div>

      <TaxControls
        params={params}
        uit={uit}
        registeredIncome={registeredIncome}
        errors={errors}
        incomeInputRef={incomeInputRef}
        onSourceChange={handleSourceChange}
      />

      <div aria-busy={busy || undefined} className={`space-y-5 transition-opacity duration-200 ${busy ? 'opacity-60' : ''}`}>
        {results}
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <TaxNotes note={data?.nota || DEFAULT_NOTE} year={params.year} uit={uit} currency={currency} />
    </div>
  )
}
