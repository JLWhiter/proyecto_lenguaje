/** Bajo un campo: el error (se anuncia con role="alert") o, si no hay error, la ayuda. Ids: `<id>-error` / `<id>-hint`. */
export default function FieldMessage({ id, error, hint }) {
  if (error) {
    return (
      <p id={`${id}-error`} role="alert" className="mt-2 text-[12px] font-medium text-[#DC5A5A]">
        {error}
      </p>
    )
  }
  if (!hint) return null
  return (
    <p id={`${id}-hint`} className="mt-2 text-[12px] leading-relaxed text-[#64748B]">
      {hint}
    </p>
  )
}
