import { Clock } from 'lucide-react'
import { AlertCircleIcon, CheckCircleIcon, InfoIcon } from '../icons'

const tones = {
  error: {
    wrapper: 'border-red-200 bg-red-50/80 text-[#9F3A3A]',
    icon: 'text-[#D35F5F]',
    Icon: AlertCircleIcon,
  },
  // Límite de intentos (429) u otras esperas: no es un error del usuario, solo debe esperar.
  warning: {
    wrapper: 'border-amber-200 bg-amber-50/80 text-[#8A4B0F]',
    icon: 'text-[#D97706]',
    Icon: Clock,
  },
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50/80 text-[#065F46]',
    icon: 'text-[#059669]',
    Icon: CheckCircleIcon,
  },
  info: {
    wrapper: 'border-sky-200 bg-sky-50/80 text-[#0C4A6E]',
    icon: 'text-[#0284C7]',
    Icon: InfoIcon,
  },
}

export default function Alert({ tone = 'info', title = null, children, className = '' }) {
  const style = tones[tone] ?? tones.info
  const Icon = style.Icon
  // Error y espera: role="alert" (se anuncian de inmediato). Éxito e info: <output>, la región de estado nativa.
  const urgent = tone === 'error' || tone === 'warning'
  const Live = urgent ? 'div' : 'output'

  return (
    <Live
      role={urgent ? 'alert' : undefined}
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed ${style.wrapper} ${className}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.icon}`} aria-hidden="true" />
      <div className="min-w-0 break-words">
        {title && <p className="font-bold">{title}</p>}
        {children}
      </div>
    </Live>
  )
}
