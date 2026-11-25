export function BrandMark({ className = 'h-12 w-12', iconClassName = 'h-6 w-6' }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#10B981] via-[#0EA371] to-[#047857] text-white shadow-[0_10px_24px_-10px_rgba(4,120,87,0.85)] ${className}`}
    >
      <span className="absolute -right-3 -top-3 h-8 w-8 rounded-full bg-white/15" aria-hidden="true" />
      <span className="absolute -bottom-4 -left-2 h-9 w-9 rounded-full bg-black/5" aria-hidden="true" />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`relative ${iconClassName}`}
      >
        <path d="M5 16.2v-3.4" />
        <path d="M12 16.2V9.4" />
        <path d="M19 16.2V5.8" />
        <path d="M3.5 19.5h17" opacity="0.55" />
        <path d="m13.2 5.5 1.3 1.3 2.4-2.4" opacity="0.9" />
      </svg>
    </span>
  )
}

export default function Brand({ badge = true, tagline = null, className = '' }) {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <div className="flex items-center gap-3">
        <BrandMark />
        <div className="flex items-start gap-2">
          <span className="text-[26px] font-extrabold leading-none tracking-[0.15em] text-[#111827]">
            FINOVA
          </span>
          {badge && (
            <span className="mt-0.5 rounded-md bg-[#D1FAE5] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#047857]">
              APP
            </span>
          )}
        </div>
      </div>
      {tagline && (
        <p className="mt-4 max-w-[300px] text-[13.5px] leading-relaxed text-[#64748B]">{tagline}</p>
      )}
    </div>
  )
}
