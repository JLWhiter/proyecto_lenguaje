function BaseIcon({ children, className = 'h-5 w-5', filled = false, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {children}
    </svg>
  )
}

export function MailIcon(props) {
  return (
    <BaseIcon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m3.5 7 7.3 5.2a2 2 0 0 0 2.4 0L20.5 7" />
    </BaseIcon>
  )
}

export function LockIcon(props) {
  return (
    <BaseIcon {...props}>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2.5" />
      <path d="M8 10V7.8a4 4 0 0 1 8 0V10" />
      <path d="M12 14.3v2.2" />
    </BaseIcon>
  )
}

export function UserIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </BaseIcon>
  )
}

export function ChevronDownIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </BaseIcon>
  )
}

export function ChevronRightIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="m9 6 6 6-6 6" />
    </BaseIcon>
  )
}

export function ArrowRightIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M4.5 12h15" />
      <path d="m13.5 6 6 6-6 6" />
    </BaseIcon>
  )
}

export function ArrowLeftIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M19.5 12h-15" />
      <path d="m10.5 6-6 6 6 6" />
    </BaseIcon>
  )
}

export function EyeIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M2.8 12s3.3-5.4 9.2-5.4S21.2 12 21.2 12s-3.3 5.4-9.2 5.4S2.8 12 2.8 12Z" />
      <circle cx="12" cy="12" r="2.7" />
    </BaseIcon>
  )
}

export function EyeOffIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.9A10.9 10.9 0 0 1 12 6.8c5.9 0 9.2 5.2 9.2 5.2a16.6 16.6 0 0 1-2.1 2.7" />
      <path d="M6.6 6.9C4 8.7 2.8 12 2.8 12s3.3 5.4 9.2 5.4a10 10 0 0 0 4-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </BaseIcon>
  )
}

export function ShieldCheckIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3 5 6v5.4c0 4.2 2.9 7.7 7 9.6 4.1-1.9 7-5.4 7-9.6V6l-7-3Z" />
      <path d="m9 12 2.1 2.1L15.4 10" />
    </BaseIcon>
  )
}

export function FingerprintIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3.5a8.4 8.4 0 0 0-8.4 8.4" />
      <path d="M20.4 11.9A8.4 8.4 0 0 0 12 3.5" />
      <path d="M8.2 20.1a6.1 6.1 0 0 1-.7-2.8v-5.4a4.5 4.5 0 0 1 9 0v4.2" />
      <path d="M12.2 20.4a4.4 4.4 0 0 1-1-2.8v-5.7a1.3 1.3 0 0 1 2.6 0v4.7" />
      <path d="M5.3 17.1a8.6 8.6 0 0 1-.6-3.2" />
      <path d="M18.7 16.8v-4.9" />
    </BaseIcon>
  )
}

export function WalletIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5v-10Z" />
      <path d="M4 8h13.5" />
      <path d="M16.3 12.2h3.5v3.6h-3.5a1.8 1.8 0 1 1 0-3.6Z" />
    </BaseIcon>
  )
}

export function CheckIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="m5 12.4 4.4 4.3L19 6.9" />
    </BaseIcon>
  )
}

export function CheckCircleIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.2 12.2 2.5 2.5 5.1-5.2" />
    </BaseIcon>
  )
}

export function AlertCircleIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5" />
      <path d="M12 16.3h.01" />
    </BaseIcon>
  )
}

export function InfoIcon(props) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.2" />
      <path d="M12 7.8h.01" />
    </BaseIcon>
  )
}

export function SparklesIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 17.9l-1.7-5.5L4.8 10.7 10.3 9 12 3.5Z" />
      <path d="M18.5 16.5 19.2 19l2.5.7-2.5.7-.7 2.5-.7-2.5-2.5-.7 2.5-.7.7-2.5Z" />
    </BaseIcon>
  )
}

export function LogOutIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H9" />
      <path d="M15 8l4 4-4 4" />
      <path d="M19 12H9.5" />
    </BaseIcon>
  )
}

export function BadgeCheckIcon(props) {
  return (
    <BaseIcon {...props}>
      <path d="m12 3 2.2 1.6 2.7-.1.9 2.6 2.2 1.6-.9 2.6.9 2.6-2.2 1.6-.9 2.6-2.7-.1L12 21l-2.2-1.6-2.7.1-.9-2.6L4 15.3l.9-2.6L4 10.1l2.2-1.6.9-2.6 2.7.1L12 3Z" />
      <path d="m8.8 12 2.1 2.1 4.3-4.4" />
    </BaseIcon>
  )
}

export function LoaderIcon({ className = 'h-5 w-5', ...props }) {
  return (
    <BaseIcon className={`animate-spin ${className}`} {...props}>
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </BaseIcon>
  )
}

export function GoogleIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9.1L6.4 14Z"
      />
      <path
        fill="#EA4335"
        d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.9 5.5L6.4 10C7.2 7.8 9.4 6 12 6Z"
      />
    </svg>
  )
}

export function AppleIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M16.7 12.8c0-2.4 2-3.6 2.1-3.7a4.6 4.6 0 0 0-3.6-2c-1.5-.1-3 .9-3.8.9-.8 0-2-.9-3.3-.9a4.9 4.9 0 0 0-4.1 2.5c-1.8 3-.5 7.5 1.2 10 .9 1.2 1.9 2.5 3.2 2.4 1.3 0 1.8-.8 3.4-.8s2 .8 3.4.8c1.4 0 2.3-1.2 3.1-2.4a11 11 0 0 0 1.4-2.9 4.4 4.4 0 0 1-2.9-4Zm-2.5-7.1A4.5 4.5 0 0 0 15.3 2a4.6 4.6 0 0 0-3 1.5 4.2 4.2 0 0 0-1.1 3.5 3.9 3.9 0 0 0 3-1.3Z" />
    </svg>
  )
}
