import { Skeleton } from '../../components/ui'

const CARD = 'rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6'

/** Esqueleto con la misma grilla que el Resumen (evita saltos al cargar). */
export default function DashboardSkeleton() {
  return (
    // <output> = región de estado nativa (role="status"); `block` porque <output> es inline.
    <output className="block space-y-5" aria-label="Cargando resumen">
      <div className={CARD}>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-5 h-10 w-64 max-w-full" />
        <Skeleton className="mt-4 h-6 w-40" />
        <div className="mt-5 grid grid-cols-2 gap-2 md:flex md:justify-end">
          <Skeleton className="h-11 md:w-32" />
          <Skeleton className="h-11 md:w-32" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className={`rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 ${index === 2 ? 'sm:col-span-2 xl:col-span-1' : ''}`}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-5 h-8 w-40" />
            <Skeleton className="mt-4 h-5 w-28" />
          </div>
        ))}
      </div>
      <div className={CARD}>
        <Skeleton className="h-6 w-56 max-w-full" />
        <Skeleton className="mt-5 h-24 w-full rounded-2xl" />
        <Skeleton className="mt-3 h-24 w-full rounded-2xl" />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className={CARD}>
          <Skeleton className="h-6 w-44" />
          <Skeleton className="mt-6 h-56 w-full rounded-2xl" />
        </div>
        <div className={CARD}>
          <Skeleton className="h-6 w-44" />
          <Skeleton className="mx-auto mt-6 h-52 w-52 rounded-full" />
        </div>
      </div>
      <span className="sr-only">Cargando resumen…</span>
    </output>
  )
}
