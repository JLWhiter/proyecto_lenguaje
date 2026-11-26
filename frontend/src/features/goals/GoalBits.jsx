// Piezas pequeñas de Metas reutilizadas por la pantalla, el detalle y la tarjeta del Resumen.
import { ProgressBar } from '../../components/ui'
import { barPercent, expectedMarker, goalIcon, percentText, statusStyles } from './goalModel'

/** Ícono de la meta sobre el color de su estado. */
export function GoalIconTile({ goal, size = 'md' }) {
  const Icon = goalIcon(goal.icono)
  const box = size === 'sm' ? 'h-10 w-10 rounded-xl' : 'h-12 w-12 rounded-2xl'
  return (
    <span className={`flex shrink-0 items-center justify-center ${box} ${statusStyles(goal.estado).tile}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  )
}

/** Estado de la meta con ícono + texto (nunca solo color). */
export function StatusBadge({ status, className = '' }) {
  const styles = statusStyles(status)
  const Icon = styles.Icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge} ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {status}
    </span>
  )
}

/**
 * Barra de progreso con la marca de lo que "deberías llevar" hoy (progreso esperado lineal).
 * La marca es decorativa: la leyenda dice el mismo dato en texto.
 */
export function GoalProgress({ goal, legend = true, className = '' }) {
  const styles = statusStyles(goal.estado)
  const marker = expectedMarker(goal)
  return (
    <div className={className}>
      <div className="relative py-1">
        <ProgressBar
          value={barPercent(goal)}
          label={`Progreso de ${goal.nombre}: ${percentText(goal.porcentaje)}`}
          className={`h-2.5 ${styles.track}`}
          barClassName={styles.bar}
        />
        {marker !== null && (
          <span
            aria-hidden="true"
            title={`Deberías llevar ${percentText(marker)}`}
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-slate-700"
            style={{ left: `${marker}%` }}
          />
        )}
      </div>
      {legend && (
        <p className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs text-slate-600">
          <span>
            <span className={`font-semibold tabular-nums ${styles.text}`}>{percentText(goal.porcentaje)}</span> ahorrado
          </span>
          {marker !== null && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-0.5 rounded-full bg-slate-700" />
              {' '}Deberías llevar <span className="tabular-nums">{percentText(goal.porcentaje_esperado)}</span>
            </span>
          )}
        </p>
      )}
    </div>
  )
}
