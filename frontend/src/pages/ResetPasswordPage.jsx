import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Brand from '../components/auth/Brand'
import AuthCard from '../components/auth/AuthCard'
import PasswordInput from '../components/auth/PasswordInput'
import PasswordStrength from '../components/auth/PasswordStrength'
import PrimaryButton from '../components/auth/PrimaryButton'
import Alert from '../components/auth/Alert'
import { ArrowRightIcon, CheckCircleIcon } from '../components/icons'
import { authService } from '../services/authService'
import { fieldErrorsFromApi, messageFromApi } from '../lib/api'
import { isStrongPassword } from '../lib/validation'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const uid = searchParams.get('uid') || ''
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [touched, setTouched] = useState({ password: false, confirm: false })
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const linkValid = Boolean(uid && token)
  const passwordReady = isStrongPassword(password)
  const passwordsMatch = passwordConfirm.length > 0 && passwordConfirm === password
  const formValid = linkValid && passwordReady && passwordsMatch

  const passwordError =
    fieldErrors.password ||
    (touched.password && !passwordReady ? 'Usa al menos 8 caracteres e incluye un número o símbolo.' : '')
  const confirmError =
    fieldErrors.password_confirm ||
    (touched.confirm
      ? passwordConfirm.length === 0
        ? 'Confirma tu contraseña.'
        : !passwordsMatch
          ? 'Las contraseñas no coinciden.'
          : ''
      : '')

  async function handleSubmit(event) {
    event.preventDefault()
    setTouched({ password: true, confirm: true })
    if (!formValid) return

    setSubmitting(true)
    setServerError('')
    setFieldErrors({})

    try {
      await authService.resetPassword({ uid, token, password, passwordConfirm })
      setDone(true)
    } catch (error) {
      const fields = fieldErrorsFromApi(error)
      setFieldErrors(fields)
      if (Object.keys(fields).length === 0) {
        setServerError(messageFromApi(error, 'No pudimos actualizar tu contraseña. Inténtalo de nuevo.'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page relative min-h-screen overflow-x-clip">
      <main className="relative mx-auto flex min-h-screen w-full max-w-[470px] flex-col px-4 py-10">
        <div className="my-auto w-full">
        <Brand tagline="Crea una nueva contraseña para tu cuenta" />

        <AuthCard className="mt-7 animate-rise">
          {!linkValid ? (
            <div className="space-y-5">
              <h1 className="text-[21px] font-extrabold text-[#111827]">Enlace no válido</h1>
              <Alert tone="error">
                Este enlace no incluye los datos necesarios para restablecer la contraseña. Solicita uno
                nuevo desde la pantalla de recuperación.
              </Alert>
              <Link
                to="/recuperar-contrasena"
                className="inline-flex text-[13px] font-bold text-[#047857] hover:text-[#10B981] hover:underline"
              >
                Solicitar un enlace nuevo
              </Link>
            </div>
          ) : done ? (
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
              <Link
                to="/login"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-[14px] font-bold text-white shadow-[0_14px_28px_-14px_rgba(5,150,105,0.9)] transition hover:-translate-y-0.5"
              >
                Ir al inicio de sesión
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          ) : (
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
                <Alert tone="error" className="mb-5">
                  {serverError}
                </Alert>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                  <PasswordInput
                    id="reset-password"
                    name="password"
                    label="Nueva contraseña"
                    placeholder="Finova#2025"
                    autoComplete="new-password"
                    value={password}
                    disabled={submitting}
                    error={passwordError}
                    onChange={(event) => setPassword(event.target.value)}
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
                  onChange={(event) => setPasswordConfirm(event.target.value)}
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
