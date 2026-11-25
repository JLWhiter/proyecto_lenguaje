import { ShieldCheckIcon } from '../icons'

export function SecurityFooter() {
  const items = [
    { title: 'Sesión HttpOnly', detail: 'Cookie protegida del navegador' },
    { title: 'Protección CSRF', detail: 'Peticiones verificadas' },
    { title: 'Hash PBKDF2', detail: 'Contraseñas nunca en texto plano' },
    { title: 'HTTPS en producción', detail: 'TLS según el despliegue' },
  ]

  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.title}
            className="flex items-start gap-2 rounded-xl border border-white/80 bg-white/55 px-3 py-2.5 backdrop-blur-sm"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#D1FAE5] text-[#047857]">
              <ShieldCheckIcon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-bold leading-tight text-[#334155]">{item.title}</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-[#7C8B85]">{item.detail}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[10px] leading-relaxed text-[#8A9A94]">
        Indicadores de protecciones realmente implementadas. El cifrado TLS/HTTPS depende de la configuración
        del servidor de producción.
      </p>
    </div>
  )
}
