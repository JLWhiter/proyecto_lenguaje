import { CheckIcon } from '../icons'
import { passwordChecks } from '../../lib/validation'

const LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Segura']

export default function PasswordStrength({ password }) {
  const checks = passwordChecks(password)
  const { minLength, hasNumberOrSymbol, strong } = checks
  // Solo números ("12345678") cumple las reglas mínimas, pero el servidor la rechaza por común/numérica.
  const onlyDigits = /^\d+$/.test(password)
  const score = onlyDigits ? Math.min(checks.score, 1) : checks.score
  const label = LABELS[score] ?? ''
  const visible = password.length > 0

  const barColor =
    score >= 2 ? 'bg-[#10B981]' : score === 1 ? 'bg-[#F59E0B]' : 'bg-[#EF7676]'
  const labelColor =
    score >= 2 ? 'text-[#047857]' : score === 1 ? 'text-[#B45309]' : 'text-[#B91C1C]'

  if (!visible) return null

  return (
    <div className="mt-3 space-y-2.5" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 gap-1.5">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                index < Math.max(score, 1) ? barColor : 'bg-[#E8EFEB]'
              }`}
            />
          ))}
        </div>
        <span className={`text-[11px] font-bold ${labelColor}`}>{label}</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-[#64748B]">
        <span className={`inline-flex items-center gap-1.5 ${minLength ? 'text-[#047857]' : ''}`}>
          <span
            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
              minLength ? 'border-[#10B981] bg-[#10B981] text-white' : 'border-[#CBD5E1]'
            }`}
          >
            {minLength && <CheckIcon className="h-2.5 w-2.5" strokeWidth="3" />}
          </span>
          Mínimo 8 caracteres
        </span>
        <span className={`inline-flex items-center gap-1.5 ${hasNumberOrSymbol ? 'text-[#047857]' : ''}`}>
          <span
            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
              hasNumberOrSymbol ? 'border-[#10B981] bg-[#10B981] text-white' : 'border-[#CBD5E1]'
            }`}
          >
            {hasNumberOrSymbol && <CheckIcon className="h-2.5 w-2.5" strokeWidth="3" />}
          </span>
          Un número o símbolo
        </span>
        {strong && (
          <span className="inline-flex items-center gap-1.5 text-[#047857]">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-[#10B981] bg-[#10B981] text-white">
              <CheckIcon className="h-2.5 w-2.5" strokeWidth="3" />
            </span>
            Buena longitud
          </span>
        )}
        {onlyDigits && <span className="text-[#B45309]">Evita usar solo números</span>}
      </div>
    </div>
  )
}
