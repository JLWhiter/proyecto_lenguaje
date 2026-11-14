import { useState } from 'react'
import { Link } from 'react-router-dom'
import Brand from '../components/auth/Brand'
import AuthCard from '../components/auth/AuthCard'
import AuthInput from '../components/auth/AuthInput'
import PrimaryButton from '../components/auth/PrimaryButton'
import Alert from '../components/auth/Alert'
import { ArrowLeftIcon, MailIcon } from '../components/icons'
import { authService } from '../services/authService'
import { fieldErrorsFromApi, messageFromApi } from '../lib/api'
import { isValidEmail } from '../lib/validation'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [fieldError, setFieldError] = useState('')
  const [serverError, setServerError] = useState('')
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const emailValid = isValidEmail(email)

  async function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    if (!emailValid) return

    setSubmitting(true)
    setServerError('')
    setFieldError('')
    setResult(null)

    try {
      const data = await authService.passwordReset(email.trim())
      setResult(data)
    } catch (error) {
      const fields = fieldErrorsFromApi(error)
      setFieldError(fields.email || '')
      if (Object.keys(fields).length === 0) {
        setServerError(messageFromApi(error, 'No pudimos iniciar la recuperación. Inténtalo de nuevo.'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const clientError =
    fieldError ||
    (touched && email.trim().length === 0
      ? 'Ingresa tu correo electrónico.'
      : touched && !emailValid
        ? 'Ingresa un correo electrónico válido.'
        : '')

  return (
    <div className="auth-page relative min-h-screen overflow-x-clip">
      <main className="relative mx-auto flex min-h-screen w-full max-w-[470px] flex-col px-4 py-10">
        <div className="my-auto w-full">
        <Link
          to="/login"
          className="mb-6 inline-flex w-fit items-center gap-2 text-[12px] font-semibold text-[#64748B] transition hover:text-[#047857]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/70 shadow-sm">
            <ArrowLeftIcon className="h-4 w-4" />
          </span>
          Volver al inicio de sesión
        </Link>

        <Brand tagline="Recupera el acceso de forma segura" />

        <AuthCard className="mt-7 animate-rise">
          <div className="mb-6">
            <h1 className="text-[21px] font-extrabold tracking-[-0.01em] text-[#111827]">
              ¿Olvidaste tu contraseña?
            </h1>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#64748B]">
              Escribe el correo asociado a tu cuenta y te indicaremos cómo continuar.
            </p>
          </div>

          {serverError && (
            <Alert tone="error" className="mb-5">
              {serverError}
            </Alert>
          )}

          {result && (
            <div className="mb-5 space-y-3">
              <Alert tone="success">{result.detail}</Alert>
              {!result.email_delivery_configured && (
                <Alert tone="info">
                  El envío de correos aún no está configurado en este entorno. El flujo quedó preparado, pero
                  no se ha enviado ningún mensaje.
                </Alert>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <AuthInput
              id="recovery-email"
              name="email"
              type="email"
              label="Correo electrónico"
              placeholder="tu.correo@ejemplo.com"
              autoComplete="email"
              inputMode="email"
              icon={<MailIcon className="h-[18px] w-[18px]" />}
              value={email}
              disabled={submitting}
              error={clientError}
              onChange={(event) => {
                setEmail(event.target.value)
                setFieldError('')
                setServerError('')
              }}
              onBlur={() => setTouched(true)}
            />

            <PrimaryButton
              loading={submitting}
              loadingText="Procesando…"
              disabled={!emailValid}
              className="mt-5"
            >
              Enviar instrucciones
            </PrimaryButton>
          </form>

          <p className="mt-5 rounded-xl bg-[#F0F7F5] px-3.5 py-3 text-[11px] leading-relaxed text-[#64748B]">
            Por seguridad, mostraremos el mismo mensaje exista o no una cuenta con ese correo. Así evitamos
            revelar qué direcciones están registradas en Finova.
          </p>
        </AuthCard>
        </div>
      </main>
    </div>
  )
}
