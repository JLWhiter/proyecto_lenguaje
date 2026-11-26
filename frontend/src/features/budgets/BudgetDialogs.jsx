import { useId, useMemo, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, Info } from 'lucide-react'
import CategoryIcon from '../../components/finance/CategoryIcon'
import { useToast } from '../../components/ui'
import { useInvalidate } from '../../context/FinanceDataContext'
import { useMoney } from '../../hooks/useMoney'
import { budgetsApi } from '../../lib/api/budgets'
import { toNumber } from '../../lib/format'
import {
  amountError,
  BUDGET_ICONS,
  BUDGET_MUTATION_TAGS,
  budgetPayload,
  categoryKey,
  changedBudgetFields,
  formatPct,
  freeMargin,
  guessIcon,
  initialRebalanceValues,
  looseCategoryKey,
  normalizeAmount,
  overMarginError,
  shortfall,
  sourceHintText,
  suggestedAmounts,
  targetHintText,
} from './budgetModel'
import { controlClass, Field, focusFirstError, FormModal, QuickPicks, splitApiErrors } from './FormParts'
import { useExpenseCategories } from './useBudgets'

const BUDGET_FIELDS = ['category', 'limit_amount', 'icon', 'description']
const CATEGORY_MAX = 80
const DESCRIPTION_MAX = 180

/**
 * Crear (sin `budget`) o editar (con `budget`) un presupuesto del mes seleccionado.
 * - Categoría con sugerencias de /categorias/ (solo de gasto) para que coincida con tus movimientos.
 * - Al crear, el ícono se propone según la categoría hasta que eliges uno.
 * - Al editar solo se envían los campos que cambiaron (PATCH parcial).
 * - Errores del backend (p. ej. categoría repetida) aparecen bajo su campo.
 */
export function BudgetFormDialog({ budget = null, period, periodLabel, budgets = [], onClose }) {
  const isEdit = Boolean(budget)
  const invalidate = useInvalidate()
  const toast = useToast()
  const { symbol, money } = useMoney()
  const categories = useExpenseCategories()
  const formId = useId()
  const formRef = useRef(null)
  const [values, setValues] = useState(() => ({
    category: budget?.nombre ?? '',
    limit_amount: budget ? toNumber(budget.presupuesto).toFixed(2) : '',
    icon: budget?.icon ?? 'shopping',
    description: budget?.descripcion ?? '',
  }))
  const [iconTouched, setIconTouched] = useState(isEdit)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const takenKeys = useMemo(
    () => new Set(budgets.filter((item) => item.id !== budget?.id).map((item) => categoryKey(item.nombre))),
    [budgets, budget?.id],
  )
  const suggestions = useMemo(() => categories.names.filter((name) => !takenKeys.has(categoryKey(name))), [categories.names, takenKeys])

  function update(name, value) {
    setValues((current) => {
      const next = { ...current, [name]: value }
      if (name === 'category' && !iconTouched) next.icon = guessIcon(value)
      return next
    })
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
    setFormError('')
  }

  function validate() {
    const result = {}
    const category = values.category.trim()
    if (!category) result.category = 'Escribe o elige una categoría.'
    else if (category.length > CATEGORY_MAX) result.category = `Usa como máximo ${CATEGORY_MAX} caracteres.`
    else if (takenKeys.has(categoryKey(category))) result.category = 'Ya existe un presupuesto para esta categoría en este mes.'
    const limit = amountError(values.limit_amount, { label: 'el límite mensual' })
    if (limit) result.limit_amount = limit
    if (values.description.trim().length > DESCRIPTION_MAX) result.description = `Usa como máximo ${DESCRIPTION_MAX} caracteres.`
    return result
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    const clientErrors = validate()
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      focusFirstError(formRef, BUDGET_FIELDS, clientErrors)
      return
    }

    const payload = budgetPayload(values)
    // Al editar solo se envía lo que cambió; si nada cambió, basta con cerrar.
    const body = isEdit ? changedBudgetFields(payload, budget) : payload
    if (Object.keys(body).length === 0) {
      onClose()
      return
    }

    setBusy(true)
    setErrors({})
    setFormError('')
    try {
      const result = isEdit ? await budgetsApi.update(budget.id, body) : await budgetsApi.create({ ...body, month: period })
      invalidate(BUDGET_MUTATION_TAGS)
      const name = result?.data?.nombre || payload.category
      toast.success(isEdit ? `Actualizaste el presupuesto de ${name}.` : `Creaste el presupuesto de ${name} para ${periodLabel}.`)
      onClose()
    } catch (error) {
      showSaveError(error)
      setBusy(false)
    }
  }

  function showSaveError(error) {
    if (error?.status === 404) {
      invalidate(BUDGET_MUTATION_TAGS)
      setFormError('Este presupuesto ya no existe (quizá lo eliminaste en otra pestaña). Cierra este diálogo para ver la lista actualizada.')
      return
    }
    const { fields, message } = splitApiErrors(error, BUDGET_FIELDS)
    setErrors(fields)
    setFormError(message)
    focusFirstError(formRef, BUDGET_FIELDS, fields)
  }

  // Ayuda de la categoría: ¿coincide con la de tus movimientos?
  const typedKey = categoryKey(values.category)
  const known = typedKey ? categories.names.find((name) => categoryKey(name) === typedKey) : null
  const similar =
    typedKey && !known ? categories.names.find((name) => looseCategoryKey(name) === looseCategoryKey(values.category)) : null
  let categoryHint = 'Usa el mismo nombre que en tus movimientos para que el gasto se sume.'
  if (similar) {
    categoryHint = (
      <span>
        ¿Quisiste decir «{similar}»? Solo se suman los gastos con exactamente la misma categoría.{' '}
        <button
          type="button"
          onClick={() => update('category', similar)}
          className="-my-2 inline-flex min-h-10 items-center font-semibold text-emerald-700 underline-offset-2 hover:underline"
        >
          Usar «{similar}»
        </button>
      </span>
    )
  } else if (known) {
    categoryHint = (
      <span className="inline-flex items-center gap-1.5 text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Coincide con una categoría de tus movimientos.
      </span>
    )
  } else if (typedKey && categories.ready) {
    categoryHint = 'Aún no tienes gastos con esta categoría: se sumarán cuando registres movimientos con ese nombre.'
  }

  const quickPicks = isEdit
    ? []
    : suggestions.slice(0, 6).map((name) => ({ value: name, label: name, active: categoryKey(name) === typedKey }))

  // Ayuda del límite: al editar, compáralo con lo ya gastado.
  const spent = toNumber(budget?.gastado)
  const typedLimit = Number(normalizeAmount(values.limit_amount))
  let limitHint = `Lo máximo que quieres gastar en esta categoría en ${periodLabel}.`
  if (isEdit) {
    limitHint =
      Number.isFinite(typedLimit) && typedLimit > 0 && typedLimit < spent ? (
        <span className="text-amber-700">
          Ya gastaste {money(spent)} en {periodLabel}: con este límite quedará excedido.
        </span>
      ) : (
        `Ya gastaste ${money(spent)} en ${periodLabel}.`
      )
  }

  const ids = {
    category: `${formId}-category`,
    list: `${formId}-category-options`,
    limit: `${formId}-limit`,
    description: `${formId}-description`,
  }

  return (
    <FormModal
      formId={formId}
      formRef={formRef}
      title={isEdit ? 'Editar presupuesto' : 'Nuevo presupuesto'}
      description={
        isEdit
          ? `${budget.nombre} · ${periodLabel}`
          : `Se creará para ${periodLabel}, el mes seleccionado. Para otro mes, cámbialo con las flechas o el selector de período.`
      }
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={busy}
      submitLabel={isEdit ? 'Guardar cambios' : 'Crear presupuesto'}
      formError={formError}
    >
      <Field
        id={ids.category}
        label="Categoría"
        error={errors.category}
        hint={categoryHint}
        extra={<QuickPicks label="Categorías de tus movimientos" options={quickPicks} onPick={(value) => update('category', value)} />}
      >
        {(describedBy) => (
          <>
            <input
              id={ids.category}
              name="category"
              value={values.category}
              onChange={(event) => update('category', event.target.value)}
              list={suggestions.length ? ids.list : undefined}
              maxLength={CATEGORY_MAX + 20}
              placeholder="Ej.: Alimentación"
              autoComplete="off"
              enterKeyHint="next"
              aria-required="true"
              aria-invalid={errors.category ? 'true' : 'false'}
              aria-describedby={describedBy}
              className={controlClass(errors.category)}
            />
            {suggestions.length > 0 && (
              <datalist id={ids.list}>
                {suggestions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            )}
          </>
        )}
      </Field>

      <Field id={ids.limit} label={`Límite mensual (${symbol})`} error={errors.limit_amount} hint={limitHint}>
        {(describedBy) => (
          <input
            id={ids.limit}
            name="limit_amount"
            value={values.limit_amount}
            onChange={(event) => update('limit_amount', event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            aria-required="true"
            aria-invalid={errors.limit_amount ? 'true' : 'false'}
            aria-describedby={describedBy}
            className={`${controlClass(errors.limit_amount)} tabular-nums`}
          />
        )}
      </Field>

      <IconPicker
        name="icon"
        value={values.icon}
        error={errors.icon}
        onChange={(value) => {
          setIconTouched(true)
          update('icon', value)
        }}
      />

      <Field id={ids.description} label="Descripción" optional error={errors.description}>
        {(describedBy) => (
          <input
            id={ids.description}
            name="description"
            value={values.description}
            onChange={(event) => update('description', event.target.value)}
            maxLength={DESCRIPTION_MAX + 20}
            placeholder="Ej.: Supermercado y mercado"
            autoComplete="off"
            aria-invalid={errors.description ? 'true' : 'false'}
            aria-describedby={describedBy}
            className={controlClass(errors.description)}
          />
        )}
      </Field>
    </FormModal>
  )
}

/** Selector de ícono: radios nativos con forma de fichas (flechas del teclado incluidas). */
function IconPicker({ name, value, error, onChange }) {
  const groupId = useId()
  return (
    <fieldset aria-describedby={error ? `${groupId}-error` : undefined}>
      <legend className="text-sm font-semibold text-slate-700">Ícono</legend>
      <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {BUDGET_ICONS.map((option) => {
          const checked = option.value === value
          return (
            <label
              key={option.value}
              className={`relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-center text-xs font-semibold transition focus-within:ring-4 focus-within:ring-emerald-500/20 ${
                checked ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <CategoryIcon name={option.value} className="h-5 w-5" />
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
      {error && (
        <p id={`${groupId}-error`} className="mt-1.5 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  )
}

const REBALANCE_FIELDS = ['source_category', 'target_category', 'amount']

/** El backend responde algunos errores de rebalanceo como `detail`: los ubicamos bajo su campo. */
function routeRebalanceDetail(message) {
  if (/libre|saldo disponible|suficiente/i.test(message)) return 'amount'
  if (/distint/i.test(message)) return 'target_category'
  return null
}

/**
 * Mover parte del límite de un presupuesto a otro dentro del mes seleccionado.
 * Valores iniciales con datos reales (`initial` o `rebalanceDefaults`): origen con más margen libre,
 * destino más comprometido. Valida el monto contra el margen libre antes de enviar.
 */
export function RebalanceDialog({ period, periodLabel, phase, budgets = [], initial = null, onClose }) {
  const invalidate = useInvalidate()
  const toast = useToast()
  const { symbol, money } = useMoney()
  const formId = useId()
  const formRef = useRef(null)
  const [values, setValues] = useState(() => initialRebalanceValues(budgets, phase, initial))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const byName = useMemo(() => new Map(budgets.map((item) => [item.nombre, item])), [budgets])
  const source = byName.get(values.source_category) ?? null
  const target = byName.get(values.target_category) ?? null
  const margin = freeMargin(source)
  const need = shortfall(target, phase)
  const typedAmount = Number(normalizeAmount(values.amount))
  const amountIsValid = !amountError(values.amount) && typedAmount <= margin

  function update(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name] && !(name === 'source_category' && current.amount)) return current
      const next = { ...current }
      delete next[name]
      // El tope del monto depende del origen: al cambiarlo, el error del monto deja de aplicar.
      if (name === 'source_category') delete next.amount
      return next
    })
    setFormError('')
  }

  function validate() {
    const result = {}
    if (!source) result.source_category = 'Elige el presupuesto de origen.'
    if (!target) result.target_category = 'Elige el presupuesto de destino.'
    else if (source && source.id === target.id) result.target_category = 'Elige un presupuesto distinto al de origen.'
    const amount = amountError(values.amount, { label: 'el monto a mover' })
    if (amount) result.amount = amount
    else if (source && typedAmount > margin) result.amount = overMarginError(source, money)
    return result
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    const clientErrors = validate()
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      focusFirstError(formRef, REBALANCE_FIELDS, clientErrors)
      return
    }
    const amount = normalizeAmount(values.amount)
    setBusy(true)
    setErrors({})
    setFormError('')
    try {
      await budgetsApi.rebalance({
        month: period,
        source_category: values.source_category,
        target_category: values.target_category,
        amount,
      })
      invalidate(BUDGET_MUTATION_TAGS)
      toast.success(`Moviste ${money(amount)} de ${values.source_category} a ${values.target_category}.`)
      onClose()
    } catch (error) {
      const { fields, message } = splitApiErrors(error, REBALANCE_FIELDS, routeRebalanceDetail)
      setErrors(fields)
      setFormError(message)
      focusFirstError(formRef, REBALANCE_FIELDS, fields)
      // Los datos pudieron cambiar (otro gasto, otra pestaña): refrescamos márgenes.
      invalidate('budgets')
      setBusy(false)
    }
  }

  const sourceOptions = budgets.map((item) => [item.nombre, `${item.nombre} · ${money(freeMargin(item))} libres`])
  const targetOptions = budgets.map((item) => [item.nombre, `${item.nombre} · ${formatPct(item.porcentaje)} usado`])

  const sourceHint = sourceHintText(source, money)
  const targetHint = targetHintText(target, need, money)
  const pickedAmount = amountIsValid ? typedAmount.toFixed(2) : null
  const picks = suggestedAmounts({ source, target, need, money }).map((pick) => ({ ...pick, active: pickedAmount === pick.value }))

  const showPreview = source && target && source.id !== target.id && amountIsValid
  const noMargin = !showPreview && budgets.every((item) => freeMargin(item) <= 0)

  return (
    <FormModal
      formId={formId}
      formRef={formRef}
      title="Mover saldo entre presupuestos"
      description={`Pasa parte del límite de un presupuesto a otro en ${periodLabel}. Tu total asignado no cambia.`}
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={busy}
      submitLabel="Mover saldo"
      busyLabel="Moviendo…"
      formError={formError}
    >
      <Field id={`${formId}-source`} label="Desde (origen)" error={errors.source_category} hint={sourceHint}>
        {(describedBy) => (
          <select
            id={`${formId}-source`}
            name="source_category"
            value={values.source_category}
            onChange={(event) => update('source_category', event.target.value)}
            aria-invalid={errors.source_category ? 'true' : 'false'}
            aria-describedby={describedBy}
            className={controlClass(errors.source_category)}
          >
            {!source && <option value="">Elige un presupuesto</option>}
            {sourceOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field id={`${formId}-target`} label="Hacia (destino)" error={errors.target_category} hint={targetHint}>
        {(describedBy) => (
          <select
            id={`${formId}-target`}
            name="target_category"
            value={values.target_category}
            onChange={(event) => update('target_category', event.target.value)}
            aria-invalid={errors.target_category ? 'true' : 'false'}
            aria-describedby={describedBy}
            className={controlClass(errors.target_category)}
          >
            {!target && <option value="">Elige un presupuesto</option>}
            {targetOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field
        id={`${formId}-amount`}
        label={`Monto a mover (${symbol})`}
        error={errors.amount}
        hint={source && margin > 0 ? `Máximo ${money(margin)}: lo que ${source.nombre} aún no ha gastado.` : null}
        extra={<QuickPicks label="Montos sugeridos" options={picks} onPick={(value) => update('amount', value)} />}
      >
        {(describedBy) => (
          <input
            id={`${formId}-amount`}
            name="amount"
            value={values.amount}
            onChange={(event) => update('amount', event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            aria-required="true"
            aria-invalid={errors.amount ? 'true' : 'false'}
            aria-describedby={describedBy}
            className={`${controlClass(errors.amount)} tabular-nums`}
          />
        )}
      </Field>

      {showPreview && (
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700" aria-live="polite">
          <p className="font-semibold text-slate-900">Así quedarán los límites</p>
          <PreviewRow name={source.nombre} from={source.presupuesto} to={toNumber(source.presupuesto) - typedAmount} money={money} />
          <PreviewRow name={target.nombre} from={target.presupuesto} to={toNumber(target.presupuesto) + typedAmount} money={money} />
        </div>
      )}
      {noMargin && (
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm leading-6 text-slate-600">
          <Info className="mt-1 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          Ningún presupuesto tiene margen libre este mes. Para cubrir un exceso, sube su límite con «Editar».
        </p>
      )}
    </FormModal>
  )
}

function PreviewRow({ name, from, to, money }) {
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span className="min-w-0 break-words font-medium">{name}:</span>
      <span className="inline-flex items-center gap-1.5 tabular-nums">
        {money(from)}
        <ArrowRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        <span className="font-semibold text-slate-900">{money(to)}</span>
      </span>
    </p>
  )
}
