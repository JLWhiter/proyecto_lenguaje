import { AlertTriangle, RotateCw } from 'lucide-react'

/** Error al cargar datos, con botón "Reintentar". */
export default function ErrorState({
  title = 'No pudimos cargar esta sección',
  error,
  message,
  onRetry,
  retrying = false,
  className = '',
}) {
  const text = message || error?.message || 'Ocurrió un error inesperado. Inténtalo de nuevo.'
  return (
    <div role="alert" className={`rounded-[28px] border border-red-100 bg-white p-6 text-center shadow-sm ${className}`}>
      <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{text}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          <RotateCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} aria-hidden="true" />
          Reintentar
        </button>
      )}
    </div>
  )
}
