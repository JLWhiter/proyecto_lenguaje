import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Brand from '../components/auth/Brand'
import AuthCard from '../components/auth/AuthCard'
import AuthInput from '../components/auth/AuthInput'
import PasswordInput from '../components/auth/PasswordInput'
import PrimaryButton from '../components/auth/PrimaryButton'
import { SecurityFooter } from '../components/auth/SecurityFooter'
import Alert from '../components/auth/Alert'
import { feedbackFromError } from '../components/auth/feedback'
import { clearLoginNotice, peekLoginNotice } from '../components/auth/loginNotice'
import { ArrowRightIcon, MailIcon } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { fieldErrorsFromApi } from '../lib/api'
import { isValidEmail } from '../lib/validation'
import { emailError as emailFieldError } from './authFieldErrors'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/app'
  const sessionExpired = location.state?.reason === 'expired'
  // Aviso de otra pantalla: "Cerraste sesión en todos tus dispositivos." (loginNotice) o
  // "Tu correo quedó verificado…" (location.state.notice).
  const [flashNotice] = useState(peekLoginNotice)
  useEffect(() => clearLoginNotice(), [])
  const notice = flashNotice || (typeof location.state?.notice === 'string' ? location.state.notice : '')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const emailValid = isValidEmail(email)
  const formValid = emailValid && password.length > 0

  const emailError = fieldErrors.email || emailFieldError(email, touched.email)

  const passwordError =
    fieldErrors.password || (touched.password && password.length === 0 ? 'Ingresa tu contraseña.' : '')

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
    setTouched({ email: true, password: true })
    if (!formValid) return

    setSubmitting(true)
    setServerError(null)
    setFieldErrors({})

    try {
      await login(
        { email: email.trim(), password, rememberMe },
        { onSuccess: () => navigate(redirectTo, { replace: true }) },
      )
    } catch (error) {
      const fields = fieldErrorsFromApi(error)
      setFieldErrors(fields)
      if (Object.keys(fields).length === 0) {
        setServerError(feedbackFromError(error, 'No pudimos iniciar sesión. Inténtalo de nuevo.'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page relative min-h-screen overflow-x-clip">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -left-28 top-8 h-72 w-72 rounded-full bg-[#10B981]/10 blur-3xl" />
        <span className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-[#047857]/8 blur-3xl" />
        <span className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[#D1FAE5]/60 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-[470px] flex-col px-4 pb-8 pt-9 sm:py-10">
        <div className="my-auto w-full">
        <Brand
          tagline="Bienvenido de vuelta a tu centro financiero"
          className="animate-rise"
        />

        <AuthCard className="mt-7 animate-rise [animation-delay:60ms]">
          <div className="mb-6">
            <h1 className="text-[21px] font-extrabold tracking-[-0.01em] text-[#111827]">Iniciar sesión</h1>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#64748B]">
              Ingresa tus credenciales para acceder de forma segura.
            </p>
          </div>

          {sessionExpired && !serverError && (
            <Alert tone="info" className="mb-5">
              Tu sesión expiró. Inicia sesión nuevamente para continuar.
            </Alert>
          )}

          {notice && !sessionExpired && !serverError && (
            <Alert tone="success" className="mb-5">
              {notice}
            </Alert>
          )}

          {serverError && (
            <Alert tone={serverError.tone} title={serverError.title} className="mb-5">
              {serverError.message}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <AuthInput
              id="login-email"
              name="email"
              type="email"
              label="Correo electrónico"
              placeholder="tu@correo.com"
              autoComplete="email"
              inputMode="email"
              icon={<MailIcon className="h-[18px] w-[18px]" />}
              value={email}
              disabled={submitting}
              error={emailError}
              onChange={(event) => {
                setEmail(event.target.value)
                clearFieldError('email')
              }}
              onBlur={() => setTouched((current) => ({ ...current, email: true }))}
            />

            <PasswordInput
              id="login-password"
              name="password"
              label="Contraseña"
              placeholder="Ingresa tu contraseña"
              autoComplete="current-password"
              value={password}
              disabled={submitting}
              error={passwordError}
              onChange={(event) => {
                setPassword(event.target.value)
                clearFieldError('password')
              }}
              onBlur={() => setTouched((current) => ({ ...current, password: true }))}
            />

            <div className="flex flex-col items-start justify-between gap-0 sm:flex-row sm:items-center sm:gap-2">
              <label htmlFor="remember-me" className="flex min-h-10 cursor-pointer items-center gap-2 text-[12px] font-medium text-[#475569]">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  disabled={submitting}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-[#CBD5E1] accent-[#059669] focus:ring-[#10B981]/30"
                />
                {' '}Recordar mi sesión
              </label>
              <Link
                to="/recuperar-contrasena"
                className="inline-flex min-h-10 items-center text-[12px] font-semibold text-[#047857] transition hover:text-[#10B981] hover:underline sm:ml-auto"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <PrimaryButton
              loading={submitting}
              loadingText="Verificando…"
              disabled={!formValid}
              className="mt-1"
            >
              <span>Iniciar Sesión</span>
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </PrimaryButton>
          </form>

          <p className="mt-6 border-t border-[#E8EFEB] pt-5 text-center text-[12.5px] text-[#64748B]">
            ¿No tienes una cuenta?{' '}
            <Link
              to="/registro"
              className="inline-flex min-h-10 items-center font-bold text-[#047857] transition hover:text-[#10B981] hover:underline"
            >
              Regístrate gratis
            </Link>
          </p>
        </AuthCard>

        <SecurityFooter />

        <p className="mt-5 text-center text-[10px] tracking-wide text-[#64748B]">
          Finova es un proyecto académico.
        </p>
        </div>
      </main>
    </div>
  )
}
