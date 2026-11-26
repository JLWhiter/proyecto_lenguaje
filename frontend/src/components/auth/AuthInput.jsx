import FieldMessage from './FieldMessage'
import { fieldDescribedBy } from './feedback'

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
  const describedBy = fieldDescribedBy(id, error, hint)

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
          className={`h-12 w-full min-w-0 rounded-xl border bg-[#FBFDFC] text-base text-[#1F2937] sm:text-[14px] placeholder:text-[#9AA8A2] transition-all duration-200 focus:bg-white focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${
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

      <FieldMessage id={id} error={error} hint={hint} />
    </div>
  )
}
