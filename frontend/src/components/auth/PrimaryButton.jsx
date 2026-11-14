import { LoaderIcon } from '../icons'

export default function PrimaryButton({
  children,
  loading = false,
  loadingText = 'Procesando…',
  disabled = false,
  type = 'submit',
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] px-5 text-[14.5px] font-bold text-white shadow-[0_14px_28px_-14px_rgba(5,150,105,0.9)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-14px_rgba(5,150,105,0.95)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#10B981]/25 active:translate-y-0 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-55 disabled:shadow-none ${className}`}
      {...props}
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {loading ? (
        <>
          <LoaderIcon className="h-[18px] w-[18px]" />
          <span>{loadingText}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
