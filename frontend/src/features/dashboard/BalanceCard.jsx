import { useId } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightLeft, CircleDollarSign, EyeOff, Eye, Landmark, Wallet } from 'lucide-react'
import { IconButton } from '../../components/ui'
import { usePreferences } from '../../context/PreferencesContext'
import { monthPhrase } from '../../lib/period'
import { Amount, CARD, VariationBadge } from './DashboardBits'
import { previousMonthText } from './dashboardUtils'

const PRIMARY = 'bg-slate-900 text-white hover:bg-slate-800'
const SECONDARY = 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
const BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50'

/** Por qué Transferir/Depositar están deshabilitados, en texto visible (el `title` no se ve en táctil). */
function accountHint(accountCount, hasHistory) {
  if (accountCount === 0) {
    return {
      text: 'Necesitas al menos una cuenta activa para depositar o transferir.',
      link: hasHistory ? 'Crear una cuenta' : 'Crea tu primera cuenta',
    }
  }
  if (accountCount === 1) {
    return {
      text: 'Para transferir necesitas dos cuentas: el dinero sale de una y entra en otra. Hoy tienes una.',
      link: 'Agregar otra cuenta',
    }
  }
  return null
}

/**
 * Saldo principal. Mes actual (o siguiente): saldo total disponible hoy.
 * Mes pasado: saldo al cierre de ese mes, con el saldo actual como referencia.
 */
export default function BalanceCard({
  data,
  period,
  defaultPeriod,
  accountCount,
  accountsLoading,
  hasHistory,
  search,
  onTransfer,
  onDeposit,
}) {
  const { showAmounts, setShowAmounts } = usePreferences()
  const hintId = useId()
  const isPast = period < defaultPeriod
  const hint = accountHint(accountCount, hasHistory)
  const canDeposit = !accountsLoading && accountCount !== 0
  const canTransfer = !accountsLoading && (accountCount === null || accountCount >= 2)

  return (
    <section aria-labelledby="balance-title" className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 id="balance-title" className="min-w-0 text-base font-semibold text-slate-700">
            {isPast ? `Saldo al cierre de ${monthPhrase(period)}` : 'Balance total disponible'}
          </h2>
        </div>
        <IconButton
          label="Ocultar montos"
          aria-pressed={!showAmounts}
          variant="outline"
          onClick={() => setShowAmounts((value) => !value)}
          className="bg-slate-50 text-slate-600"
        >
          {showAmounts ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </IconButton>
      </div>

      <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="min-w-0 break-words text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            <Amount value={isPast ? data.balance_cierre : data.balance_total} />
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <VariationBadge pct={data.balance_variacion_pct} increaseIsGood />
            <span>vs. cierre de {previousMonthText(period)}</span>
          </p>
          {isPast && (
            <p className="mt-2 text-sm text-slate-500">
              Saldo actual: <Amount value={data.balance_total} className="font-semibold text-slate-700" />
            </p>
          )}
          {!showAmounts && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
              <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Montos ocultos en este dispositivo. Usa el ojo para mostrarlos.
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:max-w-xs md:items-end">
          <div className="grid grid-cols-2 gap-2 md:flex">
            <button
              type="button"
              onClick={onTransfer}
              disabled={!canTransfer}
              aria-describedby={hint && !canTransfer ? hintId : undefined}
              className={`${BUTTON} ${PRIMARY}`}
            >
              <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
              Transferir
            </button>
            <button
              type="button"
              onClick={onDeposit}
              disabled={!canDeposit}
              aria-describedby={hint && !canDeposit ? hintId : undefined}
              className={`${BUTTON} ${SECONDARY}`}
            >
              <CircleDollarSign className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Depositar
            </button>
          </div>
          {hint && (
            <p id={hintId} className="text-sm leading-5 text-slate-500 md:text-right">
              {hint.text}{' '}
              <Link
                to={{ pathname: '/app/cuentas', search }}
                className="inline-flex min-h-10 items-center gap-1 font-semibold text-emerald-700 hover:underline"
              >
                <Landmark className="h-4 w-4" aria-hidden="true" />
                {hint.link}
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
