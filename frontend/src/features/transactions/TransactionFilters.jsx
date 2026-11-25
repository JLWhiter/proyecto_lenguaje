import { useId, useMemo, useState } from 'react'
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import { FilterChips } from '../../components/ui'
import { useMediaQuery } from '../../hooks/useMediaQuery'

const ALL = 'all'
const TYPE_CHIPS = [
  { key: ALL, label: 'Todos' },
  { key: 'INGRESO', label: 'Ingresos' },
  { key: 'GASTO', label: 'Gastos' },
]
const TYPE_LABELS = { INGRESO: 'Ingresos', GASTO: 'Gastos' }
const TOP_CATEGORIES = 6

const SELECT_SHELL =
  'relative flex min-h-11 items-center gap-2 rounded-xl border bg-slate-50 px-3 text-sm font-medium transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20'

/** Categorías del catálogo para el tipo elegido: las `TOP_CATEGORIES` más usadas como chips y el resto en un select. */
function splitCategories(catalog, tipo, active) {
  const list = (catalog ?? []).filter((category) => !tipo || !category.tipos?.length || category.tipos.includes(tipo))
  const top = list.slice(0, TOP_CATEGORIES).map((category) => category.nombre)
  const rest = list.slice(TOP_CATEGORIES).map((category) => category.nombre)
  const key = (text) => text.toLocaleLowerCase('es')
  const known = [...top, ...rest].some((name) => key(name) === key(active || ''))
  // Un ?categoria= que no está en el catálogo (enlace manual) igual debe verse seleccionado.
  if (active && !known) rest.unshift(active)
  const activeInTop = top.find((name) => key(name) === key(active || '')) ?? null
  return { top, rest, activeInTop }
}

export default function TransactionFilters({ filters, categories, accounts, accountsLoading }) {
  const panelId = useId()
  const searchId = useId()
  const accountId = useId()
  const moreId = useId()
  const [open, setOpen] = useState(false)
  const wide = useMediaQuery('(min-width: 640px)')
  const { tipo, categoria, cuentaId, searchText, setSearchText, commitSearch, setFilter, clearFilters, hasFilters } = filters

  const { top, rest, activeInTop } = useMemo(() => splitCategories(categories, tipo, categoria), [categories, tipo, categoria])
  const categoryChips = [{ key: ALL, label: 'Todas' }, ...top.map((name) => ({ key: name, label: name }))]
  const categoryValue = !categoria ? ALL : activeInTop ?? ''
  const moreActive = Boolean(categoria) && !activeInTop

  const accountKnown = accounts.some((account) => String(account.id) === cuentaId)
  const accountName = accounts.find((account) => String(account.id) === cuentaId)?.nombre

  // Filtros activos fuera de la búsqueda (la búsqueda siempre está visible).
  const panelCount = [tipo, categoria, cuentaId].filter(Boolean).length
  const summary = [
    tipo && { key: 'tipo', label: TYPE_LABELS[tipo] },
    categoria && { key: 'categoria', label: categoria },
    cuentaId && { key: 'cuenta', label: accountName || 'Cuenta seleccionada' },
  ].filter(Boolean)

  return (
    <section aria-label="Filtros de movimientos" className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-stretch gap-2">
        <div className="relative flex min-h-11 min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" aria-hidden="true" />
          <label htmlFor={searchId} className="sr-only">
            Buscar movimientos por descripción o categoría
          </label>
          <input
            id={searchId}
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitSearch()
              }
            }}
            enterKeyHint="search"
            autoComplete="off"
            placeholder={wide ? 'Buscar por descripción o categoría…' : 'Buscar…'}
            className="h-11 w-full min-w-0 rounded-xl border-0 bg-transparent pl-9 pr-11 text-base text-slate-800 outline-none placeholder:text-slate-400 sm:text-sm [&::-webkit-search-cancel-button]:appearance-none"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => {
                setSearchText('')
                commitSearch('')
              }}
              aria-label="Borrar búsqueda"
              className="absolute right-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition md:hidden ${
            panelCount > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filtros
          {panelCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[11px] font-bold text-white">
              <span className="sr-only">(activos: </span>
              {panelCount}
              <span className="sr-only">)</span>
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {/* En móvil el panel se pliega; desde md siempre está visible. */}
      <div id={panelId} className={`${open ? 'block' : 'hidden'} mt-3 space-y-3 md:block`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <FilterChips
            label="Tipo de movimiento"
            options={TYPE_CHIPS}
            value={tipo || ALL}
            onChange={(value) => setFilter('tipo', value === ALL ? '' : value)}
          />

          <div className={`${SELECT_SHELL} md:w-72 ${cuentaId ? 'border-emerald-300 text-emerald-800' : 'border-slate-200 text-slate-700'}`}>
            <label htmlFor={accountId} className="shrink-0">
              Cuenta
            </label>
            <select
              id={accountId}
              value={cuentaId}
              onChange={(event) => setFilter('cuenta', event.target.value)}
              className="h-11 min-w-0 flex-1 cursor-pointer bg-transparent text-right text-base outline-none sm:text-sm"
            >
              <option value="">Todas las cuentas</option>
              {cuentaId && !accountKnown && (
                <option value={cuentaId}>{accountsLoading ? 'Cargando…' : 'Cuenta archivada o no disponible'}</option>
              )}
              {accounts.map((account) => (
                <option key={account.id} value={String(account.id)}>
                  {account.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p id={`${moreId}-label`} className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Categoría
          </p>
          <div role="group" aria-labelledby={`${moreId}-label`} className="flex flex-wrap items-center gap-2">
            {categoryChips.map((chip) => {
              const active = chip.key === categoryValue
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter('categoria', chip.key === ALL ? '' : chip.key)}
                  className={`inline-flex min-h-10 max-w-full items-center rounded-full px-3 py-2 text-sm font-medium transition ${
                    active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span className="truncate">{chip.label}</span>
                </button>
              )
            })}
            {rest.length > 0 && (
              <div
                className={`relative inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-medium transition focus-within:ring-2 focus-within:ring-emerald-500/40 ${
                  moreActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span aria-hidden="true" className="max-w-[12rem] truncate">
                  {moreActive ? categoria : 'Más categorías'}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                <select
                  id={moreId}
                  aria-label="Más categorías"
                  value={moreActive ? categoria : ''}
                  onChange={(event) => setFilter('categoria', event.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full text-base opacity-0"
                >
                  <option value="">{moreActive ? 'Todas las categorías' : 'Elige una categoría…'}</option>
                  {rest.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {hasFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {/* Resumen quitable: útil en móvil cuando el panel está plegado. */}
          {!open &&
            summary.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.key, '')}
                aria-label={`Quitar filtro: ${chip.label}`}
                className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-full bg-emerald-50 px-3 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 md:hidden"
              >
                <span className="truncate">{chip.label}</span>
                <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </button>
            ))}
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Limpiar filtros
          </button>
        </div>
      )}
    </section>
  )
}
