import { useState } from 'react'
import AuthInput from './AuthInput'
import { EyeIcon, EyeOffIcon, LockIcon } from '../icons'

export default function PasswordInput({ id = 'password', label = 'Contraseña', ...props }) {
  const [visible, setVisible] = useState(false)

  return (
    <AuthInput
      id={id}
      label={label}
      type={visible ? 'text' : 'password'}
      icon={<LockIcon className="h-[18px] w-[18px]" />}
      autoComplete={props.autoComplete ?? 'current-password'}
      rightElement={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#94A3B8] transition hover:bg-[#F0F7F5] hover:text-[#047857] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10B981]/40"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOffIcon className="h-[18px] w-[18px]" />
          ) : (
            <EyeIcon className="h-[18px] w-[18px]" />
          )}
        </button>
      }
      {...props}
    />
  )
}
