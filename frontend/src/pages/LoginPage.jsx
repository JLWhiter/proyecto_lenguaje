import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Brand from '../components/auth/Brand'
import AuthCard from '../components/auth/AuthCard'
import AuthInput from '../components/auth/AuthInput'
import PasswordInput from '../components/auth/PasswordInput'
import PrimaryButton from '../components/auth/PrimaryButton'
import Divider, { SecurityFooter } from '../components/auth/SecurityFooter'
import SocialAuthButtons from '../components/auth/SocialAuthButtons'
import Alert from '../components/auth/Alert'
import { ArrowRightIcon, FingerprintIcon, InfoIcon, MailIcon } from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { fieldErrorsFromApi, messageFromApi } from '../lib/api'
import { isValidEmail } from '../lib/validation'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [touched, setTouched] = useState({ email: false, password: false })
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const emailValid = isValidEmail(email)
  const formValid = emailValid && password.length > 0

  const emailError =
    fieldErrors.email ||
    (touched.email
      ? email.trim().length === 0
        ? 'Ingresa tu correo electrónico.'
        : !emailValid
          ? 'Ingresa un correo electrónico válido.'
          : ''
      : '')

  const passwordError =
    fieldErrors.password || (touched.password && password.length === 0 ? 'Ingresa tu contraseña.' : '')

  function clearFieldError(field) {
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setServerError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setTouched({ email: true, password: true })
    if (!formValid) return

    setSubmitting(true)
    setServerError('')
    setFieldErrors({})

    try {
      await login({ email: email.trim(), password, rememberMe })
      navigate(redirectTo, { replace: true })
    } catch (error) {
      const fields = fieldErrorsFromApi(error)
      setFieldErrors(fields)
      if (Object.keys(fields).length === 0) {
        setServerError(messageFromApi(error, 'No pudimos iniciar sesión. Inténtalo de nuevo.'))
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

          {serverError && (
            <Alert tone="error" className="mb-5">
              {serverError}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <AuthInput
              id="login-email"
              name="email"
              type="email"
              label="Correo electrónico"
              placeholder="carlos.mendoza@finova.pe"
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

            <div className="flex flex-col items-start justify-between gap-2 pt-0.5 sm:flex-row sm:items-center">
              <label htmlFor="remember-me" className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-[#475569]">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  disabled={submitting}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  className="h-4 w-4 rounded border-[#CBD5E1] accent-[#059669] focus:ring-[#10B981]/30"
                />
                Recordar mi sesión
              </label>
              <Link
                to="/recuperar-contrasena"
                className="text-[11px] font-semibold text-[#047857] transition hover:text-[#10B981] hover:underline sm:ml-auto"
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

          <div className="mt-4">
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="WebAuthn aún no está configurado"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#FBFDFC] text-[12.5px] font-semibold text-[#475569] opacity-70 disabled:cursor-not-allowed"
            >
              <FingerprintIcon className="h-[18px] w-[18px] text-[#059669]" />
              Ingresar con Face ID o Huella
            </button>
            <p className="mt-2 flex items-start justify-center gap-1.5 text-center text-[10.5px] leading-relaxed text-[#94A3B8]">
              <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Próximamente. Requiere WebAuthn y credenciales del dispositivo; no se simula un acceso
              biométrico.
            </p>
          </div>

          <div className="my-5">
            <Divider>o continúa con</Divider>
          </div>

          <SocialAuthButtons mode="login" />

          <p className="mt-6 text-center text-[12.5px] text-[#64748B]">
            ¿No tienes una cuenta?{' '}
            <Link
              to="/registro"
              className="font-bold text-[#047857] transition hover:text-[#10B981] hover:underline"
            >
              Regístrate gratis
            </Link>
          </p>
        </AuthCard>

        <SecurityFooter />

        <p className="mt-5 text-center text-[10px] tracking-wide text-[#8A9A94]">
          © 2026 Finova Technologies S.A.C.
        </p>
        </div>
      </main>
    </div>
  )
}
