import { Link } from 'react-router-dom'
import { Check, Landmark, Lock, Plus, Receipt, Sparkles, Target } from 'lucide-react'

const PRIMARY_LINK =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700'
const SECONDARY_LINK =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'

const STATUS = {
  done: { box: 'border-emerald-200 bg-emerald-50/60', badge: 'bg-emerald-600 text-white', sr: 'completado' },
  current: { box: 'border-emerald-300 bg-white ring-2 ring-emerald-500/20', badge: 'bg-emerald-600 text-white', sr: 'siguiente paso' },
  todo: { box: 'border-slate-200 bg-white', badge: 'bg-slate-100 text-slate-700', sr: 'pendiente' },
  locked: { box: 'border-dashed border-slate-200 bg-slate-50', badge: 'bg-slate-200 text-slate-500', sr: 'disponible después del paso 1' },
}

function Step({ number, status, icon: Icon, title, children, action, note }) {
  const style = STATUS[status]
  return (
    // Móvil: tarjeta vertical. Tablet: fila (número · texto · acción). xl: 3 columnas.
    <li
      className={`flex min-w-0 flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:gap-4 xl:flex-col xl:items-stretch xl:gap-3 ${style.box}`}
    >
      <div className="flex shrink-0 items-center gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${style.badge}`} aria-hidden="true">
          {status === 'done' ? <Check className="h-4 w-4" /> : number}
        </span>
        <Icon className={`h-5 w-5 ${status === 'locked' ? 'text-slate-400' : 'text-emerald-600'}`} aria-hidden="true" />
      </div>
      <div className="min-w-0 md:flex-1">
        <h3 className="font-semibold text-slate-900">
          <span className="sr-only">
            Paso {number} de 3 ({style.sr}):{' '}
          </span>
          {title}
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">{children}</p>
      </div>
      <div className="md:shrink-0 xl:mt-auto">
        {action}
        {note && (
          <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
            <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
            {note}
          </p>
        )}
      </div>
    </li>
  )
}

/** Primeros pasos para un usuario sin cuentas (en lugar de un resumen lleno de ceros). */
export default function OnboardingCard({ hasBudget, search }) {
  return (
    <section aria-labelledby="onboarding-title" className="rounded-[28px] border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Primeros pasos</p>
          <h2 id="onboarding-title" className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
            Empieza a usar Finova en 3 pasos
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Todavía no tienes cuentas, por eso tu resumen está vacío. Cuando completes estos pasos verás aquí tu balance, tus gastos por
            categoría y tus alertas.
          </p>
        </div>
      </div>

      <ol className="mt-5 grid gap-3 xl:grid-cols-3">
        <Step
          number={1}
          status="current"
          icon={Landmark}
          title="Crea tu primera cuenta"
          action={
            <Link to={{ pathname: '/app/cuentas', search }} className={`${PRIMARY_LINK} w-full md:w-auto xl:w-full`}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Crea tu primera cuenta
            </Link>
          }
        >
          Efectivo, cuenta bancaria o billetera digital (Yape, Plin). Indica cuánto tienes hoy y será tu saldo inicial.
        </Step>
        <Step number={2} status="locked" icon={Receipt} title="Registra un movimiento" note="Disponible después del paso 1">
          Anota un gasto o un ingreso para ver tu balance, tus gráficos y tus movimientos recientes.
        </Step>
        <Step
          number={3}
          status={hasBudget ? 'done' : 'todo'}
          icon={Target}
          title="Crea un presupuesto"
          action={
            hasBudget ? (
              <Link to={{ pathname: '/app/presupuestos', search }} className={`${SECONDARY_LINK} w-full md:w-auto xl:w-full`}>
                Ver presupuestos
              </Link>
            ) : (
              <Link to={{ pathname: '/app/presupuestos', search }} className={`${SECONDARY_LINK} w-full md:w-auto xl:w-full`}>
                <Target className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Crear presupuesto
              </Link>
            )
          }
        >
          Pon un límite mensual por categoría y te avisaremos antes de que te pases.
        </Step>
      </ol>
    </section>
  )
}
