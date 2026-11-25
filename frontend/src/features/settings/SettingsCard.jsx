/**
 * Tarjeta de una sección de Configuración: ícono + título + descripción y el contenido.
 * Es `flex-col` para que, en la grilla de 2 columnas, los botones finales (`mt-auto`) queden alineados.
 */
export default function SettingsCard({ id, icon: Icon, title, description, children, className = '' }) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={`flex min-w-0 flex-col rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <header className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 id={`${id}-title`} className="text-lg font-bold leading-tight text-slate-900">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm leading-snug text-slate-500">{description}</p>}
        </div>
      </header>
      <div className="mt-5 flex flex-1 flex-col">{children}</div>
    </section>
  )
}

/** Clases de los botones de la pantalla (mínimo 44 px de alto). */
export const buttonStyles = {
  primary:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50',
  outline:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50',
  danger:
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/20 disabled:cursor-wait disabled:opacity-60',
}
