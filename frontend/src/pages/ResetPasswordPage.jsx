import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Brand from '../components/auth/Brand'
import AuthCard from '../components/auth/AuthCard'
import PasswordInput from '../components/auth/PasswordInput'
import PasswordStrength from '../components/auth/PasswordStrength'
import PrimaryButton from '../components/auth/PrimaryButton'
import Alert from '../components/auth/Alert'
import { allFieldMessages, feedbackFromError } from '../components/auth/feedback'
import { ArrowRightIcon, CheckCircleIcon } from '../components/icons'
import { authService } from '../services/authService'
import { isStrongPassword } from '../lib/validation'
import { confirmPasswordError, newPasswordError, pickFieldErrors } from './authFieldErrors'

const FORM_FIELDS = ['password', 'password_confirm']

const PRIMARY_LINK =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-[14px] font-bold text-white shadow-[0_14px_28px_-14px_rgba(5,150,105,0.9)] transition hover:-translate-y-0.5'

/** El enlace no trae uid/token o el backend lo rechazó (`rejected`: su mensaje). */
function InvalidResetLink({ rejected }) {
  return (
    <div className="space-y-5">
      <h1 className="text-[21px] font-extrabold text-[#111827]">
        {rejected ? 'Enlace no válido o vencido' : 'Enlace incompleto'}
      </h1>
      <Alert tone="error">
        {rejected
          ? `${rejected} Los enlaces de recuperación se pueden usar una sola vez y caducan después de un tiempo.`
          : 'Este enlace no incluye los datos necesarios para restablecer la contraseña. Copia el enlace completo del correo o solicita uno nuevo.'}
      </Alert>
      <Link to="/recuperar-contrasena" className={PRIMARY_LINK}>
        Solicitar un enlace nuevo
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
      <Link
        to="/login"
        className="flex min-h-10 items-center justify-center text-[13px] font-bold text-[#047857] hover:text-[#10B981] hover:underline"
      >
        Volver al inicio de sesión
      </Link>
    </div>
  )
}

function PasswordUpdated() {
  return (
    <div className="space-y-5 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#D1FAE5] text-[#047857]">
        <CheckCircleIcon className="h-7 w-7" />
      </span>
      <div>
        <h1 className="text-[21px] font-extrabold text-[#111827]">Contraseña actualizada</h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#64748B]">
          Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión con tus nuevas
          credenciales.
        </p>
      </div>
      <Link to="/login" className={PRIMARY_LINK}>
        Ir al inicio de sesión
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </div>
  )
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const uid = searchParams.get('uid') || ''
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [touched, setTouched] = useState({ password: false, confirm: false })
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  // El backend rechazó el enlace (uid/token inválido o vencido): no tiene sentido seguir en el formulario.
  const [linkRejected, setLinkRejected] = useState('')
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const linkValid = Boolean(uid && token) && !linkRejected
  const passwordReady = isStrongPassword(password)
  const passwordsMatch = passwordConfirm.length > 0 && passwordConfirm === password
  const formValid = linkValid && passwordReady && passwordsMatch

  const passwordError = fieldErrors.password || newPasswordError(password, touched.password)
  const confirmError = fieldErrors.password_confirm || confirmPasswordError(password, passwordConfirm, touched.confirm)

  function clearFieldError(field) {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setServerError(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setTouched({ password: true, confirm: true })
    if (!formValid) return

    setSubmitting(true)
    setServerError(null)
    setFieldErrors({})

    try {
      await authService.resetPassword({ uid, token, password, passwordConfirm })
      setDone(true)
    } catch (error) {
      showResetError(error)
    } finally {
      setSubmitting(false)
    }
  }

  /** Errores de la API: bajo su campo, enlace rechazado (400) o aviso general. */
  function showResetError(error) {
    const known = pickFieldErrors(allFieldMessages(error), FORM_FIELDS)
    setFieldErrors(known)

    if (Object.keys(known).length > 0) return
    if (error?.status === 400) {
      // `{"detail": "El enlace no es válido o ya expiró."}` o errores de uid/token.
      setLinkRejected(error.message || 'El enlace no es válido o ya expiró.')
    } else {
      setServerError(feedbackFromError(error, 'No pudimos actualizar tu contraseña. Inténtalo de nuevo.'))
    }
  }

  // Enlace no válido o contraseña ya cambiada: la tarjeta muestra ese estado en vez del formulario.
  let statusContent = null
  if (!linkValid) statusContent = <InvalidResetLink rejected={linkRejected} />
  else if (done) statusContent = <PasswordUpdated />

  return (
    <div className="auth-page relative min-h-screen overflow-x-clip">
      <main className="relative mx-auto flex min-h-screen w-full max-w-[470px] flex-col px-4 py-10">
        <div className="my-auto w-full">
        <Brand tagline="Crea una nueva contraseña para tu cuenta" />

        <AuthCard className="mt-7 animate-rise">
          {statusContent ?? (
            <>
              <div className="mb-6">
                <h1 className="text-[21px] font-extrabold tracking-[-0.01em] text-[#111827]">
                  Nueva contraseña
                </h1>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#64748B]">
                  Define una contraseña segura de al menos 8 caracteres con un número o símbolo.
                </p>
              </div>

              {serverError && (
                <Alert tone={serverError.tone} title={serverError.title} className="mb-5">
                  {serverError.message}
                </Alert>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <PasswordInput
                    id="reset-password"
                    name="password"
                    label="Nueva contraseña"
                    placeholder="Mínimo 8 caracteres"
                    autoComplete="new-password"
                    value={password}
                    disabled={submitting}
                    error={passwordError}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      clearFieldError('password')
                    }}
                    onBlur={() => setTouched((current) => ({ ...current, password: true }))}
                  />
                  <PasswordStrength password={password} />
                </div>

                <PasswordInput
                  id="reset-password-confirm"
                  name="passwordConfirm"
                  label="Confirmar contraseña"
                  placeholder="Repite tu contraseña"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  disabled={submitting}
                  error={confirmError}
                  labelExtra={
                    passwordConfirm.length > 0 && passwordsMatch ? (
                      <span className="text-[10px] font-bold text-[#047857]">Coinciden</span>
                    ) : null
                  }
                  onChange={(event) => {
                    setPasswordConfirm(event.target.value)
                    clearFieldError('password_confirm')
                  }}
                  onBlur={() => setTouched((current) => ({ ...current, confirm: true }))}
                />

                <PrimaryButton
                  loading={submitting}
                  loadingText="Actualizando…"
                  disabled={!formValid}
                  className="mt-1"
                >
                  Guardar contraseña
                  <ArrowRightIcon className="h-4 w-4" />
                </PrimaryButton>
              </form>
            </>
          )}
        </AuthCard>
        </div>
      </main>
    </div>
  )
}
