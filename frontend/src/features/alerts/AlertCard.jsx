import { useEffect, useId, useRef, useState } from 'react'
import { Archive, ArrowRight, Clock, Mail, MailOpen, MoreHorizontal, RotateCcw, Undo2, X } from 'lucide-react'
import { IconButton, ProgressBar } from '../../components/ui'
import { formatDateTime, formatPercent } from '../../lib/format'
import { MaskedText } from '../transactions/Money'
import { useVisibleMoney } from '../transactions/useVisibleMoney'
import { ActionSheet, MenuButton } from './AlertMenus'
import { alertTarget, inactiveState, levelOf, ruleOf, SNOOZE_OPTIONS } from './alertModel'

export { ALERT_LEVELS } from './alertModel'

const PRIMARY =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60'
const SECONDARY =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
const GHOST_DANGER =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60'
const GHOST =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60'

/** 82.46 → '82.5%' · 75 → '75%' · 1292.6 → '1,292.6%' (como los textos del backend, con separador de miles). */
function percentText(value) {
  return formatPercent(value, { digits: 1, minDigits: 0 })
}

/**
 * Tarjeta de una alerta del motor.
 * - Nivel con ícono + texto ("Urgente", "Advertencia", …), regla (`tipo`), tiempo y "Sin leer".
 * - Acción principal (`accion.label`) → `onOpen(alert)`; el resto → `onAction(alert, action, { hours })`.
 * - Móvil: acción principal + "Más acciones" (hoja inferior). Desde `sm`: todos los botones visibles.
 * - Vista "Todas": las descartadas/pospuestas muestran su estado y "Restaurar".
 * - "Ocultar montos": los montos del título y la descripción se muestran como "••••".
 */
export default function AlertCard({ alert, busy = false, focusOnMount = false, onOpen, onAction }) {
  const titleId = useId()
  const articleRef = useRef(null)
  const moreRef = useRef(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { speakText } = useVisibleMoney()

  // Tras "Deshacer" la tarjeta vuelve a aparecer: el foco va a su primer botón visible.
  useEffect(() => {
    if (!focusOnMount) return
    const button = [...(articleRef.current?.querySelectorAll('button:not([disabled])') ?? [])].find(
      (element) => element.getClientRects().length > 0,
    )
    button?.focus({ preventScroll: true })
  }, [focusOnMount])

  const level = levelOf(alert.nivel)
  const rule = ruleOf(alert)
  const LevelIcon = level.Icon
  const RuleIcon = rule.Icon
  const target = alertTarget(alert)
  const state = alert.activa === false ? inactiveState(alert) ?? { kind: 'dismissed', label: 'Inactiva' } : null
  const unread = !alert.leida && !state
  const hasPercent = alert.porcentaje !== null && alert.porcentaje !== undefined && Number.isFinite(Number(alert.porcentaje))

  const run = (action, options) => onAction(alert, action, options)
  // Desde la hoja: el foco vuelve a "Más acciones" antes de cerrar, luego se ejecuta la acción.
  const fromSheet = (callback) => () => {
    moreRef.current?.focus({ preventScroll: true })
    setSheetOpen(false)
    callback()
  }

  const readItem = alert.leida
    ? { key: 'unread', label: 'Marcar como no leída', Icon: Mail, onSelect: () => run('unread') }
    : { key: 'read', label: 'Marcar como leída', Icon: MailOpen, onSelect: () => run('read') }
  const ReadIcon = readItem.Icon

  const sheetItems = [
    { ...readItem, onSelect: fromSheet(readItem.onSelect) },
    {
      key: 'snooze',
      label: 'Posponer',
      Icon: Clock,
      options: SNOOZE_OPTIONS.map((option) => ({
        key: String(option.hours),
        label: option.short,
        ariaLabel: `Posponer ${option.label}`,
        onSelect: fromSheet(() => run('snooze', { hours: option.hours })),
      })),
    },
    {
      key: 'dismiss',
      label: 'Descartar',
      description: 'Se quita de tus alertas activas. Puedes restaurarla desde «Todas».',
      Icon: X,
      tone: 'danger',
      onSelect: fromSheet(() => run('dismiss')),
    },
  ]

  return (
    <article
      ref={articleRef}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      className={`rounded-[24px] border-l-4 bg-white p-4 shadow-sm sm:p-5 ${state ? 'border-l-slate-300' : level.border}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${state ? 'bg-slate-100 text-slate-500' : level.icon}`}
        >
          <LevelIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {state && (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-white">
                {state.kind === 'snoozed' ? (
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                <span className="min-w-0 break-words">{state.label}</span>
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${level.chip}`}>{level.label}</span>
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              <RuleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {alert.tipo || rule.label}
            </span>
            <time dateTime={alert.creada ?? undefined} title={formatDateTime(alert.creada)} className="text-xs text-slate-500">
              {alert.tiempo}
            </time>
            {unread && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                <span>Sin leer</span>
              </span>
            )}
          </div>
          <h3 id={titleId} className={`mt-2 break-words text-lg leading-snug text-slate-900 sm:text-xl ${unread ? 'font-bold' : 'font-semibold'}`}>
            <MaskedText>{alert.titulo}</MaskedText>
          </h3>
        </div>
      </div>

      <div className="mt-3 sm:pl-[52px]">
        {alert.descripcion && <p className="break-words text-sm leading-6 text-slate-600">
            <MaskedText>{alert.descripcion}</MaskedText>
          </p>}

        {hasPercent && (
          <div className="mt-4 flex items-center gap-3">
            <ProgressBar
              value={Math.min(Number(alert.porcentaje), 100)}
              label={`Uso del presupuesto: ${percentText(alert.porcentaje)}`}
              className="h-2.5 min-w-0 flex-1 bg-slate-100"
              barClassName={level.bar}
            />
            <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">{percentText(alert.porcentaje)}</span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {state ? (
            <>
              <button type="button" disabled={busy} aria-describedby={titleId} onClick={() => run('restore')} className={SECONDARY}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Restaurar
              </button>
              {target && (
                <button type="button" disabled={busy} aria-describedby={titleId} onClick={() => onOpen(alert)} className={GHOST}>
                  {alert.accion.label}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </>
          ) : (
            <>
              {target && (
                <button
                  type="button"
                  disabled={busy}
                  aria-describedby={titleId}
                  onClick={() => onOpen(alert)}
                  className={`${PRIMARY} min-w-0 flex-1 sm:flex-none`}
                >
                  <span className="min-w-0 break-words">{alert.accion.label}</span>
                  <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </button>
              )}

              {/* `contents`: estos botones fluyen en la misma fila que la acción principal. */}
              <div className="hidden sm:contents">
                <button type="button" disabled={busy} aria-describedby={titleId} onClick={readItem.onSelect} className={SECONDARY}>
                  <ReadIcon className="h-4 w-4" aria-hidden="true" />
                  {readItem.label}
                </button>
                <MenuButton
                  label="Posponer"
                  icon={Clock}
                  menuLabel={`Posponer: ${speakText(alert.titulo)}`}
                  disabled={busy}
                  className={SECONDARY}
                  items={SNOOZE_OPTIONS.map((option) => ({
                    key: String(option.hours),
                    label: option.label,
                    onSelect: () => run('snooze', { hours: option.hours }),
                  }))}
                />
                <button type="button" disabled={busy} aria-describedby={titleId} onClick={() => run('dismiss')} className={GHOST_DANGER}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Descartar
                </button>
              </div>

              {target ? (
                <IconButton
                  ref={moreRef}
                  label="Más acciones"
                  variant="outline"
                  shape="square"
                  disabled={busy}
                  aria-haspopup="dialog"
                  aria-expanded={sheetOpen}
                  aria-describedby={titleId}
                  onClick={() => setSheetOpen(true)}
                  className="sm:hidden"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </IconButton>
              ) : (
                <button
                  ref={moreRef}
                  type="button"
                  disabled={busy}
                  aria-haspopup="dialog"
                  aria-expanded={sheetOpen}
                  aria-describedby={titleId}
                  onClick={() => setSheetOpen(true)}
                  className={`${SECONDARY} sm:hidden`}
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  Más acciones
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {sheetOpen && (
        <ActionSheet
          title={<MaskedText>{alert.titulo}</MaskedText>}
          description={`${level.label} · ${alert.tipo || rule.label}`}
          items={sheetItems}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </article>
  )
}

const UNDO_TIMEOUT = 8000

/**
 * Fila que reemplaza a una alerta recién descartada o pospuesta, con "Deshacer".
 * (El aviso global no admite botones, así que el deshacer vive en la propia lista.)
 * Se cierra sola a los 8 s salvo que el foco o el mouse estén encima.
 */
export function AlertUndoRow({ entry, busy = false, onUndo, onClose }) {
  const rowRef = useRef(null)
  const buttonRef = useRef(null)
  const messageId = useId()
  const onCloseRef = useRef(onClose)
  const [hold, setHold] = useState(false)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  // El botón que disparó la acción desapareció con la tarjeta: el foco pasa a "Deshacer".
  useEffect(() => {
    const active = document.activeElement
    if (!active || active === document.body) buttonRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (hold || busy) return undefined
    const timer = window.setTimeout(() => onCloseRef.current(), UNDO_TIMEOUT)
    return () => window.clearTimeout(timer)
  }, [hold, busy])

  const Icon = entry.kind === 'snooze' ? Clock : Archive

  return (
    <div
      ref={rowRef}
      onFocus={() => setHold(true)}
      onBlur={(event) => {
        if (!rowRef.current?.contains(event.relatedTarget)) setHold(false)
      }}
      onPointerEnter={(event) => event.pointerType === 'mouse' && setHold(true)}
      onPointerLeave={(event) => event.pointerType === 'mouse' && setHold(false)}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[24px] border border-dashed border-slate-300 bg-white px-4 py-3"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p id={messageId} className="min-w-0 flex-1 basis-48 text-sm">
        <span className="block font-semibold text-slate-900">{entry.message}</span>
        <span className="block break-words text-slate-500">
          <MaskedText>{entry.alert.titulo}</MaskedText>
        </span>
      </p>
      <div className="ml-auto flex items-center gap-1">
        <button
          ref={buttonRef}
          type="button"
          onClick={onUndo}
          disabled={busy}
          aria-describedby={messageId}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60"
        >
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          {busy ? 'Restaurando…' : 'Deshacer'}
        </button>
        <IconButton label="Cerrar aviso" variant="ghost" onClick={onClose} disabled={busy}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  )
}
