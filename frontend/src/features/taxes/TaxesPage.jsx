import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, Coins, Info, Landmark, Wallet } from 'lucide-react'
import { EmptyState, ErrorState, Skeleton, SkeletonCard } from '../../components/ui'
import { usePeriod } from '../../context/PeriodContext'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { useMoney } from '../../hooks/useMoney'
import { formatPercent, toNumber } from '../../lib/format'
import TaxAmount, { HIDDEN_AMOUNT, useAmountsHidden } from './TaxAmount'
import TaxBrackets from './TaxBrackets'
import TaxControls from './TaxControls'
import { TaxBreakdown, TaxHero } from './TaxSummary'
import { TAX_CURRENCY, UIT_BY_YEAR, soles, yearProgress } from './taxRules'
import { useIncomeTax } from './useIncomeTax'
import { useTaxParams } from './useTaxParams'

const DEFAULT_NOTE = 'Estimación de rentas de quinta categoría. No incluye retenciones, créditos ni otras rentas.'

/** Oculta montos dentro de un texto de la API ("S/ 1,234.50" → "••••") cuando el usuario ocultó los montos. */
function maskAmounts(text) {
  return String(text ?? '').replace(/-?(?:S\/|US\$|\$|€)\s?\d[\d,]*(?:\.\d+)?/g, HIDDEN_AMOUNT)
}

function TaxSkeleton() {
  return (
    <output aria-label="Calculando impuesto" className="block space-y-5">
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
    </output>
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
                UIT {year}: <TaxAmount value={uit} />
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
            {currency && currency !== TAX_CURRENCY
              ? ` Aunque tu moneda principal es ${currency}, en esta pantalla todos los montos están en S/.`
              : ' Todos los montos de esta pantalla están en S/.'}
          </dd>
        </div>
      </dl>
    </section>
  )
}

/** Recuerda la última proyección del año que dio la API (por si una respuesta con `?proyectar=0` no la trae). */
function useKnownProjection(result) {
  const [known, setKnown] = useState(null)
  const value = result?.ingreso_proyectado
  if (result && value !== null && value !== undefined) {
    const amount = toNumber(value)
    if (known?.year !== result.anio || known.amount !== amount) setKnown({ year: result.anio, amount })
  }
  return result && known?.year === result.anio ? known.amount : null
}

/**
 * Errores por campo ya resueltos: la validación local o el 400 de la API.
 * `hasFieldError`: la API rechazó algún campo (se muestra "Revisa los datos" en vez del error general).
 */
function fieldErrorsFor(tax, params) {
  const apiErrors = tax.status === 'error' && tax.error?.status === 400 ? (tax.error.fieldErrors ?? {}) : {}
  return {
    errors: {
      year: apiErrors.anio,
      income: params.incomeInputError || apiErrors.ingreso_anual,
      deductions: params.deductionsInputError || apiErrors.deducciones_adicionales,
    },
    hasFieldError: Boolean(apiErrors.anio || apiErrors.ingreso_anual || apiErrors.deducciones_adicionales),
  }
}

/** Con "Mis ingresos registrados": la proyección o lo registrado según la opción elegida (al instante, sin esperar la API). */
function registeredIncomeFor(registeredData, progress, project) {
  if (progress) return progress.projected !== null && project ? progress.projected : progress.recorded
  return registeredData ? toNumber(registeredData.ingreso_bruto) : null
}

/** Estado junto al impuesto estimado: datos por corregir o recálculo en curso. */
function heroStatus(params, busy) {
  if (params.incomeInputError || params.deductionsInputError) return 'Revisa los datos'
  return busy ? 'Calculando…' : null
}

/** Texto para lectores de pantalla cuando termina un cálculo ('' mientras calcula o sin datos). */
function resultAnnouncement(data, busy, hidden) {
  if (!data || busy) return ''
  if (hidden) return `Impuesto estimado actualizado (montos ocultos), tasa efectiva ${formatPercent(data.tasa_efectiva)}.`
  return `Impuesto estimado ${soles(data.impuesto)}, tasa efectiva ${formatPercent(data.tasa_efectiva)}.`
}

/** Sin ingresos registrados en el año: ofrece simular un ingreso o ir a Movimientos. */
function NoIncomeState({ year, search, onSimulate }) {
  return (
    <EmptyState
      icon={Wallet}
      title={`No tienes ingresos registrados en ${year}`}
      description="Para estimar tu impuesto solo cuentan los ingresos regulares, como Salario u Honorarios. Los depósitos, las transferencias entre tus cuentas y los ajustes de saldo no son renta. Puedes simular un ingreso anual para ver cuánto pagarías."
      action={
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onSimulate}
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
}

/** Resultado del cálculo según el estado: esqueleto, errores, estados vacíos o el desglose completo. */
function TaxResults({ tax, data, params, hasFieldError, busy, search, onSimulate }) {
  if (tax.status === 'loading' || (data === null && !params.waitingForIncome)) return <TaxSkeleton />
  if (tax.status === 'error') {
    if (hasFieldError) {
      return (
        <EmptyState
          variant="inline"
          className="border border-red-100 bg-red-50/60"
          title="Revisa los datos del cálculo"
          description="Corrige el campo marcado en rojo para ver la estimación."
        />
      )
    }
    return <ErrorState title="No pudimos calcular tu impuesto" error={tax.error} onRetry={tax.reload} />
  }
  if (data === null) {
    return (
      <EmptyState
        icon={Calculator}
        title="Ingresa un ingreso anual para simular"
        description="Escribe cuánto ganarías en el año, en soles y antes de impuestos, y verás el impuesto estimado al instante."
      />
    )
  }
  if (data.fuente === 'movimientos' && toNumber(data.ingreso_bruto) <= 0) {
    return <NoIncomeState year={data.anio} search={search} onSimulate={onSimulate} />
  }
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-2">
        <TaxHero result={data} status={heroStatus(params, busy)} />
        <TaxBreakdown result={data} requestedDeductions={params.query?.deducciones_adicionales} />
      </div>
      <TaxBrackets result={data} />
    </>
  )
}

export default function TaxesPage() {
  useDocumentTitle('Impuestos')
  const { currency } = useMoney()
  // Con USD/EUR los movimientos no están en soles: solo se puede simular un ingreso en soles.
  const foreignCurrency = currency !== TAX_CURRENCY
  const params = useTaxParams({ forceSimulate: foreignCurrency })
  const tax = useIncomeTax(params.query)
  const hidden = useAmountsHidden()
  const { search } = usePeriod()
  const incomeInputRef = useRef(null)
  const [focusIncome, setFocusIncome] = useState(false)

  const data = tax.status === 'ready' ? tax.data : undefined
  const sameYear = data?.anio === params.year
  const uit = (sameYear ? toNumber(data.uit) : null) || UIT_BY_YEAR[params.year] || null
  const registeredData = sameYear && data.fuente === 'movimientos' ? data : null
  const knownProjection = useKnownProjection(registeredData)
  const progress = registeredData && params.projectable ? yearProgress(registeredData, knownProjection) : null
  const registeredIncome = registeredIncomeFor(registeredData, progress, params.project)

  // 400 de la API → mensaje bajo el campo correspondiente.
  const { errors, hasFieldError } = fieldErrorsFor(tax, params)
  const busy = tax.stale || params.pending

  useEffect(() => {
    if (focusIncome && params.simulate) {
      incomeInputRef.current?.focus()
      setFocusIncome(false)
    }
  }, [focusIncome, params.simulate])

  function handleSourceChange(simulate) {
    if (!simulate && params.simulateLocked) return
    const registered = data?.fuente === 'movimientos' ? toNumber(data.ingreso_bruto) : 0
    params.setSimulate(simulate, { prefill: simulate && registered > 0 ? registered : undefined })
  }

  function startSimulation() {
    params.setSimulate(true)
    setFocusIncome(true)
  }

  const note = data?.nota || DEFAULT_NOTE

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

      {foreignCurrency && (
        <div role="note" className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          <Info className="mt-1 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
          <p className="min-w-0">
            <span className="font-semibold">Tus movimientos están en {currency}.</span> El Impuesto a la Renta peruano se calcula en soles: usa «Simular
            un ingreso» con tu ingreso anual en soles.
          </p>
        </div>
      )}

      <TaxControls
        params={params}
        uit={uit}
        registeredIncome={registeredIncome}
        progress={progress}
        lockedReason={
          foreignCurrency ? `«Mis ingresos registrados» no está disponible: tus movimientos están en ${currency}, no en soles.` : null
        }
        errors={errors}
        incomeInputRef={incomeInputRef}
        onSourceChange={handleSourceChange}
      />

      <div aria-busy={busy || undefined} className={`space-y-5 transition-opacity duration-200 ${busy ? 'opacity-60' : ''}`}>
        <TaxResults
          tax={tax}
          data={data}
          params={params}
          hasFieldError={hasFieldError}
          busy={busy}
          search={search}
          onSimulate={startSimulation}
        />
      </div>

      <p className="sr-only" aria-live="polite">
        {resultAnnouncement(data, busy, hidden)}
      </p>

      <TaxNotes note={hidden ? maskAmounts(note) : note} year={params.year} uit={uit} currency={currency} />
    </div>
  )
}
