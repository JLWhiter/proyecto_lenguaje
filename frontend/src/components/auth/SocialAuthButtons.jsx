import { AppleIcon, GoogleIcon, InfoIcon } from '../icons'

export default function SocialAuthButtons({ mode = 'login' }) {
  const action = mode === 'register' ? 'regístrate' : 'continúa'

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Google OAuth aún no está configurado"
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#475569] opacity-60 disabled:cursor-not-allowed"
        >
          <GoogleIcon className="h-[18px] w-[18px]" />
          Google
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Apple OAuth aún no está configurado"
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white text-[13px] font-semibold text-[#475569] opacity-60 disabled:cursor-not-allowed"
        >
          <AppleIcon className="h-[18px] w-[18px]" />
          Apple
        </button>
      </div>
      <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-[#94A3B8]">
        <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {action.charAt(0).toUpperCase() + action.slice(1)} con Google o Apple estará disponible cuando se
          configuren las credenciales OAuth. No se simula ningún acceso.
        </span>
      </p>
    </div>
  )
}
