import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, BellOff, CalendarDays, CheckCircle2, ListFilter, RotateCw } from 'lucide-react'
import { EmptyState, ErrorState, FilterChips, Skeleton, useConfirm, useToast } from '../../components/ui'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import AlertCard, { AlertUndoRow } from './AlertCard'
import {
  ACTIVE_ALERTS,
  ALL_ALERTS,
  ALL_STATES,
  alertFilterOptions,
  alertTarget,
  groupByPeriod,
  leftListMessage,
  matchesFilter,
  mergeAlertItems,
  plural,
  SILENCE_HOURS,
  silenceAllMessage,
  untilText,
  withPatch,
} from './alertModel'
import { useAlertActions, useAlerts } from './useAlerts'

const VIEWS = [
  { key: ACTIVE_ALERTS, label: 'Activas', count: (counts) => counts.activas },
  { key: ALL_STATES, label: 'Todas', count: (counts) => counts.total },
]

const NO_ITEMS = []
const NO_PATCHES = {}

const OUTLINE_BUTTON =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

/** Los conteos son globales (iguales en "Activas" y "Todas"): se conservan mientras carga la otra vista. */
function useKnownCounts(data) {
  const [knownCounts, setKnownCounts] = useState(null)
  if (data?.counts && data.counts !== knownCounts) setKnownCounts(data.counts)
  return data?.counts ?? knownCounts
}

/** Respuesta de la última acción aplicada encima de los datos, hasta que llega la recarga del servidor. */
function useAlertPatches(data) {
  const [patch, setPatch] = useState({ base: null, items: NO_PATCHES, inserts: NO_PATCHES })
  const dataRef = useRef(data)
  useLayoutEffect(() => {
    dataRef.current = data
  })

  /** Aplica la alerta devuelta por la API hasta la próxima recarga; `insertAt` la vuelve a poner en la lista. */
  function applyPatch(item, { insertAt } = {}) {
    if (!item?.id) return
    setPatch((current) => withPatch(current, dataRef.current, item, insertAt))
  }

  const current = patch.base === data
  return { patches: current ? patch.items : NO_PATCHES, inserts: current ? patch.inserts : NO_PATCHES, applyPatch }
}

/** Alertas con una acción en curso: `[busy, setItemBusy(id, value)]`. */
function useBusyIds() {
  const [busy, setBusy] = useState({})
  function setItemBusy(id, value) {
    setBusy((current) => {
      const next = { ...current }
      if (value) next[id] = true
      else delete next[id]
      return next
    })
  }
  return [busy, setItemBusy]
}

/** Región viva: `n` alterna un espacio final para que se repita el anuncio aunque el texto sea el mismo. */
function useAnnouncer() {
  const [announcement, setAnnouncement] = useState({ text: '', n: 0 })
  function announce(text) {
    if (text) setAnnouncement((current) => ({ text, n: current.n + 1 }))
  }
  return [announcement, announce]
}

export default function AlertsPage() {
  useDocumentTitle('Alertas')
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const [estado, setEstado] = useState(ACTIVE_ALERTS)
  const [filter, setFilter] = useState(ALL_ALERTS)
  const alerts = useAlerts({ estado })
  const { act, undo, silenceAll } = useAlertActions()

  const [busy, setItemBusy] = useBusyIds()
  const [undoEntry, setUndoEntry] = useState(null)
  const [focusId, setFocusId] = useState(null)
  const [silencing, setSilencing] = useState(false)
  const [announcement, announce] = useAnnouncer()

  const data = alerts.data
  const counts = useKnownCounts(data)
  const { patches, inserts, applyPatch } = useAlertPatches(data)
  const serverItems = data?.items ?? NO_ITEMS

  const items = useMemo(
    () => mergeAlertItems({ serverItems, patches, inserts, estado, undoEntry }),
    [serverItems, patches, inserts, estado, undoEntry],
  )

  const options = useMemo(() => alertFilterOptions(data?.filters), [data?.filters])
  const activeFilter = options.some((option) => option.key === filter) ? filter : ALL_ALERTS
  const activeOption = options.find((option) => option.key === activeFilter)
  const visible = useMemo(() => items.filter((alert) => matchesFilter(alert, activeFilter)), [items, activeFilter])
  const groups = useMemo(() => groupByPeriod(visible), [visible])

  function changeEstado(next) {
    if (next === estado) return
    setEstado(next)
    setUndoEntry(null)
    setFocusId(null)
  }

  async function handleAction(alert, action, options = {}) {
    const leavesActiveList = estado === ACTIVE_ALERTS && (action === 'dismiss' || action === 'snooze')
    const index = Math.max(0, items.findIndex((item) => item.id === alert.id))
    setFocusId(null)
    setItemBusy(alert.id, true)
    const result = await act(alert, action, { ...options, silent: true })
    setItemBusy(alert.id, false)
    if (!result) return
    applyPatch(result.data)

    if (leavesActiveList) {
      const message = leftListMessage(action, untilText(result.data?.pospuesta_hasta))
      setUndoEntry({ alert, kind: action, message, index })
      announce(`${message}. Puedes deshacerlo.`)
    } else if (action === 'read' || action === 'unread') {
      announce(result.message)
    } else {
      toast.success(result.message)
    }
  }

  async function handleUndo() {
    const entry = undoEntry
    if (!entry) return
    setItemBusy(entry.alert.id, true)
    const result = await undo(entry.alert)
    setItemBusy(entry.alert.id, false)
    if (!result) return
    applyPatch(result.data, { insertAt: entry.index })
    setUndoEntry((current) => (current?.alert.id === entry.alert.id ? null : current))
    setFocusId(entry.alert.id)
  }

  function closeUndo(id) {
    setUndoEntry((current) => (current?.alert.id === id ? null : current))
  }

  function handleOpen(alert) {
    const target = alertTarget(alert)
    if (!target) return
    if (!alert.leida) act(alert, 'read', { silent: true })
    navigate(target)
  }

  async function handleSilenceAll() {
    const ok = await confirm({
      title: '¿Silenciar todas las alertas?',
      message: silenceAllMessage(counts?.activas ?? 0),
      confirmLabel: `Silenciar ${SILENCE_HOURS} h`,
    })
    if (!ok) return
    setSilencing(true)
    setUndoEntry(null)
    await silenceAll()
    setSilencing(false)
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="alerts-title" className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="alerts-title" className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Centro de Alertas
            </h1>
            <p className="mt-1 text-sm text-slate-500">Avisos de tus presupuestos, ritmo de gasto, gastos inusuales y balance del mes.</p>
          </div>
          <button
            type="button"
            onClick={handleSilenceAll}
            disabled={silencing || !counts || counts.activas === 0}
            className={OUTLINE_BUTTON}
          >
            <BellOff className="h-4 w-4" aria-hidden="true" />
            {silencing ? 'Silenciando…' : 'Silenciar todo'}
          </button>
        </div>

        <AlertCounts counts={counts} estado={estado} />

        <div className="mt-5 space-y-4">
          <ViewToggle counts={counts} estado={estado} onChange={changeEstado} />
          <TypeFilter loaded={Boolean(data)} loading={alerts.status === 'loading'} options={options} value={activeFilter} onChange={setFilter} />
        </div>
      </section>

      <p className="sr-only" aria-live="polite">
        {announcement.text}
        {announcement.n % 2 ? ' ' : ''}
      </p>

      {alerts.status === 'loading' && <AlertsSkeleton />}

      {alerts.status === 'error' && <ErrorState title="No pudimos cargar tus alertas" error={alerts.error} onRetry={alerts.reload} />}

      {alerts.status === 'ready' && (
        <>
          {alerts.error && <StaleBanner onRetry={alerts.reload} />}
          <AlertResults
            estado={estado}
            items={items}
            groups={groups}
            total={counts?.total ?? 0}
            typeName={activeOption?.name}
            undoEntry={undoEntry}
            busy={busy}
            focusId={focusId}
            handlers={{
              open: handleOpen,
              action: handleAction,
              undo: handleUndo,
              closeUndo,
              showAll: () => changeEstado(ALL_STATES),
              showAllTypes: () => setFilter(ALL_ALERTS),
            }}
          />
        </>
      )}
    </div>
  )
}

/** "3 activas · 2 sin leer (· 9 en total)" o su esqueleto mientras no hay conteos. */
function AlertCounts({ counts, estado }) {
  if (!counts) return <Skeleton className="mt-3 h-5 w-40" />
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-slate-700">
      <span>{plural(counts.activas, 'activa', 'activas')}</span>
      <span aria-hidden="true" className="text-slate-300">
        ·
      </span>
      <span className={counts.no_leidas > 0 ? 'text-emerald-700' : ''}>{counts.no_leidas} sin leer</span>
      {estado === ALL_STATES && (
        <>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>{counts.total} en total</span>
        </>
      )}
    </p>
  )
}

/** Activas | Todas. <fieldset> = grupo nativo; `min-w-auto` anula el mínimo "min-content" que le da el navegador. */
function ViewToggle({ counts, estado, onChange }) {
  return (
    <fieldset aria-label="Qué alertas mostrar" className="grid min-w-auto grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 sm:inline-grid">
      {VIEWS.map((view) => {
        const active = view.key === estado
        const count = counts ? view.count(counts) : null
        return (
          <button
            key={view.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(view.key)}
            className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {view.label}
            {count !== null && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                  active ? 'bg-emerald-100 text-emerald-800' : 'bg-white/80 text-slate-600'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </fieldset>
  )
}

/** Chips por tipo de alerta (cuando hay datos) o su esqueleto mientras carga. */
function TypeFilter({ loaded, loading, options, value, onChange }) {
  if (loaded) {
    return <FilterChips tone="emerald" label="Filtrar por tipo de alerta" options={options} value={value} onChange={onChange} />
  }
  if (!loading) return null
  return (
    <div className="flex flex-wrap gap-2" aria-hidden="true">
      {['w-24', 'w-32', 'w-36', 'w-32'].map((width, index) => (
        <Skeleton key={index} className={`h-10 rounded-full ${width}`} />
      ))}
    </div>
  )
}

function StaleBanner({ onRetry }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span className="inline-flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
        No pudimos actualizar las alertas; lo que ves puede estar desactualizado.
      </span>
      <button type="button" onClick={onRetry} className={OUTLINE_BUTTON}>
        <RotateCw className="h-4 w-4" aria-hidden="true" />
        Reintentar
      </button>
    </div>
  )
}

/**
 * Lista agrupada por período, o el estado vacío que corresponda.
 * `handlers`: `{ open, action, undo, closeUndo, showAll, showAllTypes }`.
 */
function AlertResults({ estado, items, groups, total, typeName, undoEntry, busy, focusId, handlers }) {
  if (items.length === 0) return <AllClear estado={estado} total={total} onShowAll={handlers.showAll} />
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={ListFilter}
        title="No hay alertas de este tipo"
        description={`No tienes alertas ${estado === ACTIVE_ALERTS ? 'activas ' : ''}de «${typeName ?? 'este tipo'}».`}
        action={
          <button type="button" onClick={handlers.showAllTypes} className={OUTLINE_BUTTON}>
            Ver todos los tipos
          </button>
        }
      />
    )
  }

  const showPeriodHeadings = groups.length > 1 || !groups[0].current
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`alerts-period-${group.key}`}>
          <h2
            id={`alerts-period-${group.key}`}
            className={showPeriodHeadings ? 'mb-3 flex flex-wrap items-center gap-2 px-1 text-base font-bold text-slate-800' : 'sr-only'}
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            {group.label}
            <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-xs font-semibold text-slate-600">{group.note}</span>
          </h2>
          <ul className="space-y-4">
            {group.items.map((alert) => (
              <li key={alert.id}>
                {estado === ACTIVE_ALERTS && undoEntry?.alert.id === alert.id ? (
                  <AlertUndoRow
                    entry={undoEntry}
                    busy={Boolean(busy[alert.id])}
                    onUndo={handlers.undo}
                    onClose={() => handlers.closeUndo(alert.id)}
                  />
                ) : (
                  <AlertCard
                    alert={alert}
                    busy={Boolean(busy[alert.id])}
                    focusOnMount={focusId === alert.id}
                    onOpen={handlers.open}
                    onAction={handlers.action}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function AllClear({ estado, total, onShowAll }) {
  const onlyActive = estado === ACTIVE_ALERTS
  return (
    <div className="rounded-[28px] border border-emerald-100 bg-emerald-50/70 p-6 text-center sm:p-8">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-bold text-slate-900">Todo en orden</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        {onlyActive
          ? 'No tienes alertas activas. Te avisaremos si un presupuesto se acerca a su límite, si detectamos un gasto inusual o si tu mes va en negativo.'
          : 'Aún no se generó ninguna alerta. Te avisaremos si un presupuesto se acerca a su límite, si detectamos un gasto inusual o si tu mes va en negativo.'}
      </p>
      {onlyActive && total > 0 && (
        <button type="button" onClick={onShowAll} className={`${OUTLINE_BUTTON} mt-4`}>
          Ver descartadas y pospuestas
        </button>
      )}
    </div>
  )
}

function AlertsSkeleton() {
  return (
    // <output> = región de estado nativa (role="status"); `block` porque <output> es inline.
    <output className="block space-y-4" aria-label="Cargando alertas">
      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-[24px] border-l-4 border-l-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-6 w-3/4" />
            </div>
          </div>
          <div className="mt-3 space-y-2 sm:pl-[52px]">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-4 h-10 w-44" />
          </div>
        </div>
      ))}
      <span className="sr-only">Cargando alertas</span>
    </output>
  )
}
