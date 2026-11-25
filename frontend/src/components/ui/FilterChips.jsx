const ACTIVE = {
  dark: 'bg-slate-900 text-white',
  emerald: 'bg-emerald-600 text-white',
}

/**
 * Grupo de chips de filtro. El estado guarda la `key`, no el texto: el texto puede incluir
 * contadores que cambian ("Todas (5)" → "Todas (4)") sin perder la selección.
 *
 *   <FilterChips
 *     label="Filtrar alertas"
 *     options={[{ key: 'all', label: 'Todas (5)' }, { key: 'Metas', label: 'Metas (1)' }]}
 *     value={filter}
 *     onChange={setFilter}
 *   />
 */
export default function FilterChips({ options, value, onChange, label, tone = 'dark', className = '', chipClassName = '' }) {
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap items-center gap-2 ${className}`}>
      {options.map((option) => {
        const active = option.key === value
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.key)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${
              active ? ACTIVE[tone] ?? ACTIVE.dark : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            } ${chipClassName}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** "Todas (5)" → { key: 'Todas', count: 5 } · "Normal 3" → { key: 'Normal', count: 3 } */
export function parseCountLabel(text) {
  const match = String(text).match(/^(.*?)\s*\(?(\d+)\)?\s*$/)
  if (!match) return { key: String(text).trim(), count: null }
  return { key: match[1].trim(), count: Number(match[2]) }
}
