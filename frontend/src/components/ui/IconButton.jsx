import { forwardRef } from 'react'

const VARIANTS = {
  outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  soft: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
  ghost: 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
  dark: 'bg-slate-900 text-white hover:bg-slate-800',
}

const SHAPES = {
  round: 'rounded-full',
  square: 'rounded-xl',
}

/**
 * Botón solo-ícono accesible (mínimo 40×40 px). `label` es obligatorio: se usa como aria-label y title.
 *   <IconButton label="Cerrar" onClick={onClose}><X className="h-4 w-4" /></IconButton>
 */
const IconButton = forwardRef(function IconButton(
  { label, children, variant = 'outline', shape = 'round', className = '', type = 'button', ...props },
  ref,
) {
  if (import.meta.env.DEV && !label) {
    console.error('IconButton: la prop "label" es obligatoria (aria-label).')
  }
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 min-w-10 shrink-0 items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-50 ${SHAPES[shape] ?? SHAPES.round} ${VARIANTS[variant] ?? VARIANTS.outline} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
})

export default IconButton
