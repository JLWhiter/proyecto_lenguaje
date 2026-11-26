import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, LogOut, MonitorSmartphone, ShieldCheck } from 'lucide-react'
import Alert from '../../components/auth/Alert'
import PasswordInput from '../../components/auth/PasswordInput'
import PasswordStrength from '../../components/auth/PasswordStrength'
import { allFieldMessages, feedbackFromError } from '../../components/auth/feedback'
import { clearLoginNotice, setLoginNotice } from '../../components/auth/loginNotice'
import { CheckIcon } from '../../components/icons'
import { useConfirm, useToast } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { isStrongPassword } from '../../lib/validation'
import { authService } from '../../services/authService'
import SettingsCard, { buttonStyles } from './SettingsCard'

const EMPTY = { current: '', next: '', confirm: '' }
const FIELDS = ['current', 'next', 'confirm']
// Campo del formulario ↔ campo del backend.
const SERVER_FIELD = { current_password: 'current', new_password: 'next', new_password_confirm: 'confirm' }

function clientErrors(form) {
  const errors = {}
  if (!form.current) errors.current = 'Ingresa tu contraseña actual.'
  if (!form.next) errors.next = 'Crea una nueva contraseña.'
  else if (!isStrongPassword(form.next)) errors.next = 'Usa al menos 8 caracteres e incluye un número o símbolo.'
  else if (form.current && form.next === form.current) errors.next = 'La nueva contraseña debe ser diferente de la actual.'
  if (!form.confirm) errors.confirm = 'Confirma la nueva contraseña.'
  else if (form.confirm !== form.next) errors.confirm = 'Las contraseñas no coinciden.'
  return errors
}

/**
 * Aviso "Contraseña actualizada…" (toast) de esta pantalla. Es de un solo uso: se cierra al salir de
 * Configuración o al cerrar sesión, para que no tape el formulario de /login. El aviso propio de
 * "cerraste sesión en todos tus dispositivos" viaja aparte (loginNotice).
 */
function usePasswordToast() {
  const toast = useToast()
  const idRef = useRef(null)

  const dismiss = useCallback(() => {
    if (idRef.current !== null) toast.dismiss(idRef.current)
    idRef.current = null
  }, [toast])

  const show = useCallback(
    (message) => {
      dismiss()
      idRef.current = toast.success(message)
    },
    [dismiss, toast],
  )

  // Al desmontar (navegar a otra pantalla o a /login tras cerrar sesión) el aviso ya no aplica.
  useEffect(() => dismiss, [dismiss])

  return { show, dismiss }
}

export default function SecurityCard() {
  const passwordToast = usePasswordToast()
  return (
    <SettingsCard
      id="settings-security"
      icon={ShieldCheck}
      title="Seguridad"
      description="Cambia tu contraseña y controla dónde tienes la sesión abierta."
    >
      <PasswordChangeForm onChanged={passwordToast.show} />
      <SessionsPanel onLeave={passwordToast.dismiss} />
    </SettingsCard>
  )
}

function PasswordChangeForm({ onChanged }) {
  const { user, updateUser } = useAuth()
  const currentRef = useRef(null)
  const nextRef = useRef(null)
  const confirmRef = useRef(null)
  // Campo a enfocar cuando termine el envío (mientras guarda, los inputs están deshabilitados).
  const pendingFocus = useRef(null)

  const [form, setForm] = useState(EMPTY)
  const [touched, setTouched] = useState({})
  const [serverErrors, setServerErrors] = useState({})
  const [feedback, setFeedback] = useState(null)
  const [saving, setSaving] = useState(false)

  // Solo usa refs (estables), por eso el efecto puede llamarla sin listarla como dependencia.
  function focusField(field) {
    const refs = { current: currentRef, next: nextRef, confirm: confirmRef }
    refs[field]?.current?.focus()
  }

  useEffect(() => {
    if (saving || !pendingFocus.current) return
    const field = pendingFocus.current
    pendingFocus.current = null
    focusField(field)
  }, [saving])

  const local = clientErrors(form)
  const errorFor = (field) => serverErrors[field] || (touched[field] ? local[field] || '' : '')
  const passwordsMatch = form.confirm.length > 0 && form.confirm === form.next

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setServerErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setFeedback(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return
    setTouched({ current: true, next: true, confirm: true })
    if (Object.keys(local).length > 0) {
      focusField(FIELDS.find((field) => local[field]))
      return
    }

    setSaving(true)
    setServerErrors({})
    setFeedback(null)
    try {
      const data = await authService.changePassword({
        currentPassword: form.current,
        newPassword: form.next,
        newPasswordConfirm: form.confirm,
      })
      updateUser(data?.user)
      setForm(EMPTY)
      setTouched({})
      onChanged(`${data?.detail || 'Contraseña actualizada correctamente.'} Las sesiones abiertas en otros dispositivos se cerraron.`)
    } catch (error) {
      const mapped = {}
      const other = []
      for (const [key, message] of Object.entries(allFieldMessages(error))) {
        if (SERVER_FIELD[key]) mapped[SERVER_FIELD[key]] = message
        else other.push(message)
      }
      setServerErrors(mapped)
      if (other.length > 0) setFeedback({ tone: 'error', message: other.join(' ') })
      else if (Object.keys(mapped).length === 0) {
        setFeedback(feedbackFromError(error, 'No pudimos cambiar tu contraseña. Inténtalo de nuevo.'))
      }
      pendingFocus.current = FIELDS.find((field) => mapped[field]) ?? null
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-labelledby="settings-password-title">
      <h3 id="settings-password-title" className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <KeyRound className="h-4 w-4 text-slate-400" aria-hidden="true" />
        Cambiar contraseña
      </h3>

      {/* Ayuda a los gestores de contraseñas a asociar la nueva clave con esta cuenta. */}
      <input type="email" name="username" autoComplete="username" value={user?.email ?? ''} readOnly hidden />

      <div className="mt-4 space-y-4">
        <PasswordInput
          ref={currentRef}
          id="settings-current-password"
          name="current_password"
          label="Contraseña actual"
          autoComplete="current-password"
          value={form.current}
          disabled={saving}
          error={errorFor('current')}
          onChange={(event) => update('current', event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, current: true }))}
        />

        <div>
          <PasswordInput
            ref={nextRef}
            id="settings-new-password"
            name="new_password"
            label="Nueva contraseña"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            value={form.next}
            disabled={saving}
            error={errorFor('next')}
            onChange={(event) => update('next', event.target.value)}
            onBlur={() => setTouched((current) => ({ ...current, next: true }))}
          />
          <PasswordStrength password={form.next} />
        </div>

        <PasswordInput
          ref={confirmRef}
          id="settings-new-password-confirm"
          name="new_password_confirm"
          label="Confirmar nueva contraseña"
          placeholder="Repite la contraseña"
          autoComplete="new-password"
          value={form.confirm}
          disabled={saving}
          error={errorFor('confirm')}
          labelExtra={
            passwordsMatch ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#047857]">
                <CheckIcon className="h-3.5 w-3.5" />
                Coinciden
              </span>
            ) : null
          }
          onChange={(event) => update('confirm', event.target.value)}
          onBlur={() => setTouched((current) => ({ ...current, confirm: true }))}
        />

        {feedback && (
          <Alert tone={feedback.tone} title={feedback.title}>
            {feedback.message}
          </Alert>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Seguirás conectado en este dispositivo; en los demás tendrás que iniciar sesión con la nueva contraseña.
      </p>

      <div className="mt-4 flex sm:justify-end">
        <button type="submit" disabled={saving} className={`${buttonStyles.primary} w-full sm:w-auto`}>
          {saving ? 'Actualizando…' : 'Actualizar contraseña'}
        </button>
      </div>
    </form>
  )
}

function SessionsPanel({ onLeave }) {
  const { logout, logoutAll } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()
  const [busy, setBusy] = useState(null) // 'one' | 'all' | null

  async function handleLogout() {
    setBusy('one')
    onLeave()
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  async function handleLogoutAll() {
    const ok = await confirm({
      title: '¿Cerrar sesión en todos tus dispositivos?',
      message:
        'Se cerrarán todas las sesiones abiertas de tu cuenta, incluida esta. Tendrás que volver a iniciar sesión en cada dispositivo.',
      confirmLabel: 'Cerrar todas las sesiones',
      tone: 'danger',
    })
    if (!ok) return

    setBusy('all')
    onLeave()
    // Se fija antes de limpiar el usuario: la redirección de ProtectedRoute puede llegar primero.
    setLoginNotice('Cerraste sesión en todos tus dispositivos.')
    try {
      const data = await logoutAll()
      if (data?.detail) setLoginNotice(data.detail)
      navigate('/login', { replace: true })
    } catch (error) {
      clearLoginNotice()
      setBusy(null)
      toast.error(error?.message || 'No pudimos cerrar las sesiones. Inténtalo de nuevo.')
    }
  }

  return (
    <div className="mt-auto pt-6">
      <div className="border-t border-slate-100 pt-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <MonitorSmartphone className="h-4 w-4 text-slate-400" aria-hidden="true" />
          Sesiones
        </h3>
        <p className="mt-1.5 text-sm leading-snug text-slate-500">
          ¿Usaste Finova en un equipo compartido o perdiste un dispositivo? Cierra la sesión en todos ellos; también se
          cerrará en este.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button type="button" onClick={handleLogout} disabled={busy !== null} className={buttonStyles.outline}>
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {busy === 'one' ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
          <button type="button" onClick={handleLogoutAll} disabled={busy !== null} className={buttonStyles.danger}>
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            {busy === 'all' ? 'Cerrando sesiones…' : 'Cerrar sesión en todos los dispositivos'}
          </button>
        </div>
      </div>
    </div>
  )
}
