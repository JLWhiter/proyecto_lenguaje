/** Bloque gris animado. `<Skeleton className="h-6 w-40" />` */
export function Skeleton({ className = '' }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-xl bg-slate-200/80 ${className}`} />
}

/** Tarjeta de carga con el mismo contorno que las tarjetas reales. */
export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={`rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <Skeleton className="h-5 w-40" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className={`h-4 ${index % 2 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  )
}

/**
 * Esqueleto genérico de pantalla: encabezado + fila de tarjetas + bloques.
 *   <PageSkeleton stats={3} blocks={2} />
 */
export function PageSkeleton({ stats = 3, blocks = 2, title = true, label = 'Cargando…' }) {
  return (
    <div className="space-y-6" role="status" aria-label={label}>
      {title && (
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-64 max-w-full" />
        </div>
      )}
      {stats > 0 && (
        <div className={`grid gap-4 ${stats >= 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}>
          {Array.from({ length: stats }, (_, index) => (
            <div key={index} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-4 h-7 w-36" />
            </div>
          ))}
        </div>
      )}
      {Array.from({ length: blocks }, (_, index) => (
        <SkeletonCard key={index} lines={4} />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  )
}
