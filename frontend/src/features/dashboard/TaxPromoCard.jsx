import { Link } from 'react-router-dom'
import { ArrowRight, Calculator } from 'lucide-react'

/**
 * Acceso a la pantalla de Impuestos (estimación del Impuesto a la Renta de quinta categoría).
 * `aside`: va en la columna angosta junto a Transacciones recientes → desde xl se apila en vertical.
 */
export default function TaxPromoCard({ search, aside = false, className = '' }) {
  return (
    <section
      aria-labelledby="tax-promo-title"
      className={`flex min-w-0 flex-col gap-4 rounded-[28px] bg-[#0F172A] p-5 text-white shadow-sm sm:flex-row sm:items-center sm:p-6 ${
        aside ? 'xl:flex-col xl:items-start' : ''
      } ${className}`}
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
        <Calculator className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Impuestos</p>
        <h2 id="tax-promo-title" className="mt-1 text-lg font-bold sm:text-xl">
          Estima tu Impuesto a la Renta
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-300">
          Calcula cuánto pagarías por rentas de quinta categoría con la UIT vigente y los ingresos que registraste.
        </p>
      </div>
      <Link
        to={{ pathname: '/app/impuestos', search }}
        className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 ${
          aside ? 'xl:w-full' : ''
        }`}
      >
        Calcular mi impuesto
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  )
}
