import { useMemo, useState } from 'react'
import { BellOff } from 'lucide-react'
import { EmptyState, ErrorState, FilterChips, PageSkeleton } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import AlertCard, { ALL_ALERTS, alertFilterOptions, filterAlerts } from './AlertCard'
import { useAlertActions, useAlerts } from './useAlerts'

export default function AlertsPage() {
  useDocumentTitle('Alertas')
  const alerts = useAlerts()
  const { act, silenceAll } = useAlertActions()
  const [filter, setFilter] = useState(ALL_ALERTS)
  const [silencing, setSilencing] = useState(false)

  const items = alerts.data?.items ?? []
  const visible = useMemo(() => filterAlerts(items, filter), [items, filter])

  async function handleSilenceAll() {
    setSilencing(true)
    await silenceAll()
    setSilencing(false)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Alertas Activas</h1>
            <p className="mt-2 text-sm text-slate-500">Monitoreo continuo de desvíos y vencimientos</p>
          </div>
          <button
            type="button"
            onClick={handleSilenceAll}
            disabled={silencing || items.length === 0}
            className="min-h-10 text-sm font-semibold text-emerald-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {silencing ? 'Silenciando…' : 'Silenciar todo'}
          </button>
        </div>
        {alerts.status === 'ready' && (
          <FilterChips
            className="mt-5"
            tone="emerald"
            label="Filtrar alertas por categoría"
            options={alertFilterOptions(alerts.data.filters)}
            value={filter}
            onChange={setFilter}
          />
        )}
      </section>

      {alerts.status === 'loading' && <PageSkeleton title={false} stats={0} blocks={3} label="Cargando alertas" />}

      {alerts.status === 'error' && <ErrorState title="No pudimos cargar tus alertas" error={alerts.error} onRetry={alerts.reload} />}

      {alerts.status === 'ready' && (
        <div className="space-y-4">
          {visible.map((alert) => (
            <AlertCard key={alert.id} alert={alert}>
              <button
                type="button"
                onClick={() => act(alert, 'read')}
                className="min-h-10 rounded-xl bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
              >
                Ver detalle
              </button>
              <button
                type="button"
                onClick={() => act(alert, 'dismiss')}
                className="min-h-10 text-sm font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700"
              >
                Marcar como leída
              </button>
            </AlertCard>
          ))}
          {visible.length === 0 && (
            <EmptyState
              icon={BellOff}
              title="Sin alertas"
              description={filter === ALL_ALERTS ? 'No tienes alertas activas en este momento.' : 'No hay alertas en esta categoría.'}
            />
          )}
        </div>
      )}
    </div>
  )
}
