import { CheckIcon } from '../icons'
import { passwordChecks } from '../../lib/validation'

const LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Segura']

// Colores de la barra y de la etiqueta según el puntaje (0, 1, ≥ 2).
const STRENGTH_STYLES = {
  weakest: { bar: 'bg-[#EF7676]', label: 'text-[#B91C1C]' },
  weak: { bar: 'bg-[#F59E0B]', label: 'text-[#B45309]' },
  good: { bar: 'bg-[#10B981]', label: 'text-[#047857]' },
}

function strengthStyle(score) {
  if (score >= 2) return STRENGTH_STYLES.good
  return score === 1 ? STRENGTH_STYLES.weak : STRENGTH_STYLES.weakest
}

/** Requisito con su marca: verde con ✓ si se cumple. */
function CheckItem({ ok, children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${ok ? 'text-[#047857]' : ''}`}>
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
          ok ? 'border-[#10B981] bg-[#10B981] text-white' : 'border-[#CBD5E1]'
        }`}
      >
        {ok && <CheckIcon className="h-2.5 w-2.5" strokeWidth="3" />}
      </span>
      {children}
    </span>
  )
}

export default function PasswordStrength({ password }) {
  const checks = passwordChecks(password)
  const { minLength, hasNumberOrSymbol, strong } = checks
  // Solo números ("12345678") cumple las reglas mínimas, pero el servidor la rechaza por común/numérica.
  const onlyDigits = /^\d+$/.test(password)
  const score = onlyDigits ? Math.min(checks.score, 1) : checks.score
  const label = LABELS[score] ?? ''
  const visible = password.length > 0
  const style = strengthStyle(score)

  if (!visible) return null

  return (
    <div className="mt-3 space-y-2.5" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 gap-1.5">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                index < Math.max(score, 1) ? style.bar : 'bg-[#E8EFEB]'
              }`}
            />
          ))}
        </div>
        <span className={`text-[11px] font-bold ${style.label}`}>{label}</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px] text-[#64748B]">
        <CheckItem ok={minLength}>Mínimo 8 caracteres</CheckItem>
        <CheckItem ok={hasNumberOrSymbol}>Un número o símbolo</CheckItem>
        {strong && <CheckItem ok>Buena longitud</CheckItem>}
        {onlyDigits && <span className="text-[#B45309]">Evita usar solo números</span>}
      </div>
    </div>
  )
}
