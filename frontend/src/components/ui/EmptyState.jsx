/**
 * Estado vacío.
 *   variant="card"   → tarjeta punteada con título, descripción y acción (listas vacías de una pantalla)
 *   variant="inline" → texto suave dentro de una tarjeta existente
 */
export default function EmptyState({ icon: Icon, title, description, action, variant = 'card', className = '' }) {
  if (variant === 'inline') {
    return (
      <div className={`rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 ${className}`}>
        {title && <p className="font-semibold text-slate-700">{title}</p>}
        {description && <p className={title ? 'mt-1' : ''}>{description}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    )
  }

  return (
    <div className={`rounded-[28px] border border-dashed border-slate-300 bg-white p-6 text-center ${className}`}>
      {Icon && (
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      {title && <h3 className="text-lg font-bold text-slate-900">{title}</h3>}
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
