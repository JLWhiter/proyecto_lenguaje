export default function AuthInput({
  id,
  label,
  icon = null,
  error = '',
  hint = '',
  labelExtra = null,
  rightElement = null,
  className = '',
  inputClassName = '',
  ...inputProps
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-[#1F2937]">
          {label}
        </label>
        {labelExtra}
      </div>

      <div className="group relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[#94A3B8] transition-colors group-focus-within:text-[#10B981]">
            {icon}
          </span>
        )}
        <input
          id={id}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          className={`h-12 w-full rounded-xl border bg-[#FBFDFC] text-[14px] text-[#1F2937] placeholder:text-[#9AA8A2] transition-all duration-200 focus:bg-white focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
            icon ? 'pl-11' : 'pl-4'
          } ${rightElement ? 'pr-12' : 'pr-4'} ${
            error
              ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
              : 'border-[#E5E7EB] hover:border-[#C8D6D0] focus:border-[#10B981] focus:ring-[#10B981]/10'
          } ${inputClassName}`}
          {...inputProps}
        />
        {rightElement && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</span>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-2 text-[12px] font-medium text-[#DC5A5A]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 text-[12px] leading-relaxed text-[#64748B]">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
