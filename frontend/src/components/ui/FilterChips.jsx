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
    // <fieldset> = grupo nativo. `min-w-auto` anula el `min-inline-size: min-content` que le da el navegador.
    <fieldset aria-label={label} className={`flex min-w-auto flex-wrap items-center gap-2 ${className}`}>
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
    </fieldset>
  )
}

const LINE_BREAK = /[\n\r\u2028\u2029]/

function isDigit(char) {
  return char >= '0' && char <= '9'
}

/**
 * "Todas (5)" → { key: 'Todas', count: 5 } · "Normal 3" → { key: 'Normal', count: 3 }
 * Sin número al final → { key: texto, count: null }. Se recorre el texto desde el final
 * (sin expresiones regulares con retroceso).
 */
export function parseCountLabel(text) {
  const raw = String(text)
  const trimmed = raw.trimEnd()
  const end = trimmed.endsWith(')') ? trimmed.length - 1 : trimmed.length
  let start = end
  while (start > 0 && isDigit(trimmed[start - 1])) start -= 1
  if (start === end) return { key: raw.trim(), count: null }

  const keyEnd = trimmed[start - 1] === '(' ? start - 1 : start
  const key = trimmed.slice(0, keyEnd).trimEnd()
  // Igual que antes: la etiqueta debe estar en una sola línea.
  if (LINE_BREAK.test(key)) return { key: raw.trim(), count: null }
  return { key: key.trim(), count: Number(trimmed.slice(start, end)) }
}
