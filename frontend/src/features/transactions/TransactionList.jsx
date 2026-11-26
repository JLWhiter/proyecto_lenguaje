import { ChevronRight, Landmark, Pencil, Trash2 } from 'lucide-react'
import { IconButton, Modal } from '../../components/ui'
import { formatLongDay } from './dates'
import { Amount } from './Money'
import { amountTone, directionIcon, MOVEMENT_ICONS, movementTone } from './movementStyle'
import { useVisibleMoney } from './useVisibleMoney'

export const KIND_LABELS = {
  TRANSFER: 'Transferencia',
  DEPOSIT: 'Depósito',
  ADJUSTMENT: 'Ajuste de saldo',
  OPENING: 'Saldo inicial',
}

const KIND_STYLES = {
  TRANSFER: 'bg-sky-50 text-sky-700 ring-sky-200',
  DEPOSIT: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ADJUSTMENT: 'bg-amber-50 text-amber-800 ring-amber-200',
  OPENING: 'bg-slate-100 text-slate-700 ring-slate-200',
}

/** Ícono del movimiento según `icon`; si no se reconoce, uno genérico según sea ingreso o gasto. */
export function MovementIcon({ item, className = 'h-10 w-10 sm:h-11 sm:w-11' }) {
  const Icon = MOVEMENT_ICONS[item.icon] || (item.kind === 'OPENING' ? Landmark : directionIcon(item))
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-2xl ${movementTone(item)} ${className}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  )
}

export function KindBadge({ item }) {
  if (!item.kind || item.kind === 'REGULAR') return null
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
        KIND_STYLES[item.kind] ?? 'bg-slate-100 text-slate-700 ring-slate-200'
      }`}
    >
      {KIND_LABELS[item.kind] ?? item.kind_label}
    </span>
  )
}

const same = (a, b) => String(a || '').trim().toLocaleLowerCase('es') === String(b || '').trim().toLocaleLowerCase('es')

function CategoryBadge({ item }) {
  if (!item.categoria) return null
  // En transferencias/depósitos la categoría suele repetir la clase ("Transferencia"): no se duplica.
  if (item.kind && item.kind !== 'REGULAR' && (same(item.categoria, KIND_LABELS[item.kind]) || same(item.categoria, item.kind_label))) return null
  return (
    <span className="inline-flex min-w-0 max-w-full items-center truncate rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
      {item.categoria}
    </span>
  )
}

function MovementRow({ item, busy, highlighted, onOpen, onEdit, onDelete }) {
  const { signedText, speakSigned } = useVisibleMoney()
  return (
    <li
      data-movement-id={item.id}
      className={`flex items-center gap-1 rounded-2xl py-1 transition-colors duration-700 sm:gap-2 ${
        highlighted ? 'bg-amber-50 ring-2 ring-amber-300' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-haspopup="dialog"
        aria-label={`${item.nombre}, ${speakSigned(item.monto)}, ${item.categoria || ''}, ${item.cuenta || item.subtexto || ''}, ${item.hora}. Ver detalle y acciones`}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-1 py-2 text-left sm:gap-3 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-500 sm:px-2"
      >
        <MovementIcon item={item} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-start justify-between gap-2">
            <span className="min-w-0 break-words font-semibold leading-5 text-slate-900">
              {item.nombre}
            </span>
            <span className={`shrink-0 whitespace-nowrap text-[15px] font-bold leading-5 tabular-nums sm:text-base ${amountTone(item.monto)}`}>
              {signedText(item.monto)}
            </span>
          </span>
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="min-w-0 truncate">{item.cuenta || item.subtexto}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{item.hora}</span>
            <CategoryBadge item={item} />
            <KindBadge item={item} />
          </span>
        </span>
        <ChevronRight className="-ml-1 h-4 w-4 shrink-0 text-slate-300 sm:hidden" aria-hidden="true" />
      </button>

      {/* Desde sm: acciones visibles. En móvil se usan desde la hoja de detalle (tap en la fila). */}
      <div className="hidden shrink-0 items-center gap-1 sm:flex">
        {item.editable ? (
          <IconButton label={`Editar ${item.nombre}`} variant="ghost" onClick={() => onEdit(item)}>
            <Pencil className="h-4 w-4" />
          </IconButton>
        ) : (
          <span className="h-10 w-10" aria-hidden="true" />
        )}
        {item.eliminable ? (
          <IconButton
            label={`Eliminar ${item.nombre}`}
            variant="ghost"
            className="hover:bg-red-50! hover:text-red-600!"
            disabled={busy}
            onClick={() => onDelete(item)}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        ) : (
          <span className="h-10 w-10" aria-hidden="true" />
        )}
      </div>
    </li>
  )
}

/**
 * Lista agrupada por día, tal como la entrega el backend (HOY, AYER, 23 NOV 2026…).
 * - Respeta "Ocultar montos" (filas, totales del día y textos para lectores de pantalla).
 * - `highlightId`: movimiento resaltado unos segundos (p. ej. al llegar desde una alerta).
 *   Cada fila lleva `data-movement-id` para poder desplazarse hasta ella.
 */
export default function TransactionList({ groups, onOpen, onEdit, onDelete, busyId, highlightId = null }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section
          key={group.fecha || group.titulo}
          aria-labelledby={`day-${group.fecha}`}
          className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
        >
          <header className="mb-2 flex items-center justify-between gap-3 px-1">
            <h2 id={`day-${group.fecha}`} className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {group.titulo}
            </h2>
            <p className={`text-sm font-bold tabular-nums ${amountTone(group.total)}`}>
              <span className="sr-only">Total del día: </span>
              <Amount value={group.total} signed />
            </p>
          </header>

          <ul className="divide-y divide-slate-100">
            {group.items.map((item) => (
              <MovementRow
                key={item.id}
                item={item}
                busy={busyId === item.id}
                highlighted={highlightId !== null && String(item.id) === String(highlightId)}
                onOpen={onOpen}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

const LOCKED_REASONS = {
  OPENING: 'El saldo inicial se registra al crear la cuenta y no se puede editar ni eliminar. Para corregirlo, actualiza el saldo desde Cuentas.',
  ADJUSTMENT: 'Los ajustes de saldo se generan al corregir el saldo de una cuenta y no se pueden editar ni eliminar desde aquí.',
  TRANSFER:
    'Las transferencias no se editan. Tienen dos movimientos (salida y entrada): si la eliminas se borran ambos, se restauran los saldos y puedes registrarla de nuevo.',
  DEPOSIT: 'Los depósitos no se editan: elimínalo y vuelve a registrarlo.',
}

/** Hoja de detalle con acciones (en móvil es la forma principal de editar/eliminar). */
export function TransactionDetailSheet({ item, onClose, onEdit, onDelete }) {
  const reason = !item.editable ? LOCKED_REASONS[item.kind] : null
  const rows = [
    ['Fecha', formatLongDay(item.occurred_at) || item.fecha],
    ['Hora', item.hora],
    ['Cuenta', item.cuenta || item.subtexto],
    ['Categoría', item.categoria],
    item.kind === 'TRANSFER'
      ? ['Dirección', item.tipo === 'INGRESO' ? 'Entrada a esta cuenta' : 'Salida de esta cuenta']
      : ['Tipo', item.tipo === 'INGRESO' ? 'Ingreso' : 'Gasto'],
    ['Clase', KIND_LABELS[item.kind] ?? 'Movimiento regular'],
    ['Estado', item.estado],
  ].filter(([, value]) => value)

  return (
    <Modal
      title={item.nombre}
      onClose={onClose}
      size="sm"
      footer={
        item.editable || item.eliminable ? (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            {item.eliminable && (
              <button
                type="button"
                onClick={() => onDelete(item)}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50 ${
                  item.editable ? '' : 'col-span-2'
                }`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Eliminar
              </button>
            )}
            {item.editable && (
              <button
                type="button"
                onClick={() => onEdit(item)}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 ${
                  item.eliminable ? '' : 'col-span-2'
                }`}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Editar
              </button>
            )}
          </div>
        ) : null
      }
    >
      <div className="flex items-center gap-3">
        <MovementIcon item={item} />
        <div className="min-w-0">
          <p className={`text-2xl font-bold tabular-nums ${amountTone(item.monto)}`}>
            <Amount value={item.monto} signed />
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <CategoryBadge item={item} />
            <KindBadge item={item} />
          </div>
        </div>
      </div>
      <dl className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 px-3 py-2.5">
            <dt className="shrink-0 text-slate-500">{label}</dt>
            <dd className="min-w-0 break-words text-right font-medium text-slate-800 first-letter:uppercase">{value}</dd>
          </div>
        ))}
      </dl>
      {reason && (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${item.kind === 'TRANSFER' ? 'bg-sky-50 text-sky-800' : 'bg-slate-50 text-slate-600'}`}>
          {reason}
        </p>
      )}
    </Modal>
  )
}
