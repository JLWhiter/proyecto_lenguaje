import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Brand from '../components/auth/Brand'
import AuthCard from '../components/auth/AuthCard'
import AuthInput from '../components/auth/AuthInput'
import PasswordInput from '../components/auth/PasswordInput'
import CurrencySelector from '../components/auth/CurrencySelector'
import PasswordStrength from '../components/auth/PasswordStrength'
import PrimaryButton from '../components/auth/PrimaryButton'
import Divider from '../components/auth/SecurityFooter'
import SocialAuthButtons from '../components/auth/SocialAuthButtons'
import Alert from '../components/auth/Alert'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  MailIcon,
  ShieldCheckIcon,
  UserIcon,
} from '../components/icons'
import { useAuth } from '../context/AuthContext'
import { fieldErrorsFromApi, messageFromApi } from '../lib/api'
import { isStrongPassword, isValidEmail } from '../lib/validation'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    currency: 'PEN',
    password: '',
    passwordConfirm: '',
    acceptTerms: false,
  })
  const [touched, setTouched] = useState({
    fullName: false,
    email: false,
    password: false,
    passwordConfirm: false,
    acceptTerms: false,
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const emailValid = isValidEmail(form.email)
  const passwordReady = isStrongPassword(form.password)
  const passwordsMatch = form.passwordConfirm.length > 0 && form.passwordConfirm === form.password

  const formValid =
    form.fullName.trim().length >= 2 &&
    emailValid &&
    Boolean(form.currency) &&
    passwordReady &&
    passwordsMatch &&
    form.acceptTerms

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setServerError('')
    const serverField = {
      fullName: 'full_name',
      email: 'email',
      currency: 'currency',
      password: 'password',
      passwordConfirm: 'password_confirm',
      acceptTerms: 'accept_terms',
    }[field]
    if (serverField) {
      setFieldErrors((current) => {
        if (!current[serverField]) return current
        const next = { ...current }
        delete next[serverField]
        return next
      })
    }
  }

  function markTouched(field) {
    setTouched((current) => ({ ...current, [field]: true }))
  }

  const fullNameError =
    fieldErrors.full_name ||
    (touched.fullName && form.fullName.trim().length < 2 ? 'Ingresa tu nombre completo.' : '')

  const emailError =
    fieldErrors.email ||
    (touched.email
      ? form.email.trim().length === 0
        ? 'Ingresa tu correo electrónico.'
        : !emailValid
          ? 'Ingresa un correo electrónico válido.'
          : ''
      : '')

  const passwordError =
    fieldErrors.password ||
    (touched.password
      ? form.password.length === 0
        ? 'Crea una contraseña.'
        : !passwordReady
          ? 'Usa al menos 8 caracteres e incluye un número o símbolo.'
          : ''
      : '')

  const confirmError =
    fieldErrors.password_confirm ||
    (touched.passwordConfirm
      ? form.passwordConfirm.length === 0
        ? 'Confirma tu contraseña.'
        : !passwordsMatch
          ? 'Las contraseñas no coinciden.'
          : ''
      : '')

  const termsError =
    fieldErrors.accept_terms ||
    (touched.acceptTerms && !form.acceptTerms
      ? 'Debes aceptar los Términos de Servicio y la Política de Privacidad.'
      : '')

  async function handleSubmit(event) {
    event.preventDefault()
    setTouched({
      fullName: true,
      email: true,
      password: true,
      passwordConfirm: true,
      acceptTerms: true,
    })
    if (!formValid) return

    setSubmitting(true)
    setServerError('')
    setFieldErrors({})

    try {
      const data = await register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        currency: form.currency,
        password: form.password,
        passwordConfirm: form.passwordConfirm,
        acceptTerms: form.acceptTerms,
      })
      navigate('/cuenta', {
        replace: true,
        state: { justRegistered: true, emailDeliveryConfigured: data.email_delivery_configured },
      })
    } catch (error) {
      const fields = fieldErrorsFromApi(error)
      setFieldErrors(fields)
      if (Object.keys(fields).length === 0) {
        setServerError(messageFromApi(error, 'No pudimos crear tu cuenta. Inténtalo de nuevo.'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page relative min-h-screen overflow-x-clip">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#E6F0EC] via-[#EDF5F2]/70 to-transparent"
      />

      <header className="relative mx-auto flex w-full max-w-[640px] items-center justify-center px-4 pb-2 pt-6">
        <button
          type="button"
          onClick={() => navigate('/login')}
          aria-label="Volver al inicio de sesión"
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/75 text-[#334155] shadow-sm backdrop-blur transition hover:-translate-x-0.5 hover:border-[#10B981]/30 hover:text-[#047857] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#10B981]/20 sm:left-0"
        >
          <ArrowLeftIcon className="h-[18px] w-[18px]" />
        </button>

        <Brand badge={false} />
      </header>

      <div className="relative flex justify-center px-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFE8D9] bg-white/70 px-3 py-1 text-[10px] font-semibold tracking-wide text-[#047857] shadow-sm backdrop-blur">
          <ShieldCheckIcon className="h-3.5 w-3.5" />
          Plataforma Segura · Protección en capas
        </span>
      </div>

      <main className="relative mx-auto w-full max-w-[600px] px-4 pb-10 pt-6 sm:pt-8">
        <div className="animate-rise">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-[#111827] sm:text-[34px]">
            Crear tu cuenta
          </h1>
          <p className="mt-2 max-w-[500px] text-[13px] leading-relaxed text-[#64748B] sm:text-[13.5px]">
            Toma el control de tus finanzas personales y presupuestos con analítica inteligente.
          </p>
        </div>

        <AuthCard className="mt-6 animate-rise [animation-delay:60ms]">
          {serverError && (
            <Alert tone="error" className="mb-5">
              {serverError}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <AuthInput
              id="register-name"
              name="fullName"
              type="text"
              label="Nombre completo"
              placeholder="Ej. Carlos Mendoza"
              autoComplete="name"
              icon={<UserIcon className="h-[18px] w-[18px]" />}
              value={form.fullName}
              disabled={submitting}
              error={fullNameError}
              onChange={(event) => update('fullName', event.target.value)}
              onBlur={() => markTouched('fullName')}
            />

            <AuthInput
              id="register-email"
              name="email"
              type="email"
              label="Correo electrónico"
              placeholder="tu.correo@ejemplo.com"
              autoComplete="email"
              inputMode="email"
              icon={<MailIcon className="h-[18px] w-[18px]" />}
              value={form.email}
              disabled={submitting}
              error={emailError}
              hint={
                emailValid
                  ? 'Formato válido. La verificación se completará cuando confirmes el enlace enviado a tu correo.'
                  : 'Usaremos este correo para verificar tu cuenta.'
              }
              labelExtra={
                emailValid ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#047857]">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    Válido
                  </span>
                ) : null
              }
              rightElement={
                emailValid ? <CheckCircleIcon className="mr-1 h-[18px] w-[18px] text-[#10B981]" /> : null
              }
              onChange={(event) => update('email', event.target.value)}
              onBlur={() => markTouched('email')}
            />

            <CurrencySelector
              value={form.currency}
              disabled={submitting}
              error={fieldErrors.currency || ''}
              onChange={(event) => update('currency', event.target.value)}
            />

            <div>
              <PasswordInput
                id="register-password"
                name="password"
                label="Contraseña"
                placeholder="Finova#2025"
                autoComplete="new-password"
                value={form.password}
                disabled={submitting}
                error={passwordError}
                onChange={(event) => update('password', event.target.value)}
                onBlur={() => markTouched('password')}
              />
              <PasswordStrength password={form.password} />
            </div>

            <div>
              <PasswordInput
                id="register-password-confirm"
                name="passwordConfirm"
                label="Confirmar contraseña"
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
                value={form.passwordConfirm}
                disabled={submitting}
                error={confirmError}
                labelExtra={
                  form.passwordConfirm.length > 0 ? (
                    passwordsMatch ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#047857]">
                        <CheckIcon className="h-3.5 w-3.5" />
                        Coinciden
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-[#DC5A5A]">No coinciden</span>
                    )
                  ) : null
                }
                onChange={(event) => update('passwordConfirm', event.target.value)}
                onBlur={() => markTouched('passwordConfirm')}
              />
            </div>

            <div>
              <div
                className={`flex items-start gap-3 rounded-xl border p-3.5 transition ${
                  termsError ? 'border-red-200 bg-red-50/40' : 'border-[#E5E7EB] bg-[#FBFDFC]'
                }`}
              >
                <input
                  id="accept-terms"
                  name="acceptTerms"
                  type="checkbox"
                  checked={form.acceptTerms}
                  disabled={submitting}
                  onChange={(event) => {
                    update('acceptTerms', event.target.checked)
                    markTouched('acceptTerms')
                  }}
                  onBlur={() => markTouched('acceptTerms')}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#CBD5E1] accent-[#059669] focus:ring-[#10B981]/30"
                />
                <label htmlFor="accept-terms" className="text-[11.5px] leading-relaxed text-[#475569]">
                  Acepto los{' '}
                  <Link
                    to="/terminos"
                    onClick={(event) => event.stopPropagation()}
                    className="font-bold text-[#047857] underline decoration-[#A7D9C8] underline-offset-2 hover:text-[#10B981]"
                  >
                    Términos de Servicio
                  </Link>{' '}
                  y la{' '}
                  <Link
                    to="/privacidad"
                    onClick={(event) => event.stopPropagation()}
                    className="font-bold text-[#047857] underline decoration-[#A7D9C8] underline-offset-2 hover:text-[#10B981]"
                  >
                    Política de Privacidad
                  </Link>{' '}
                  de Finova.
                </label>
              </div>
              {termsError && (
                <p role="alert" className="mt-2 text-[12px] font-medium text-[#DC5A5A]">
                  {termsError}
                </p>
              )}
            </div>

            <PrimaryButton
              loading={submitting}
              loadingText="Creando cuenta…"
              disabled={!formValid}
              className="mt-1"
            >
              <span>Crear Cuenta Gratuita</span>
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </PrimaryButton>
          </form>

          <div className="my-5">
            <Divider>o regístrate con</Divider>
          </div>

          <SocialAuthButtons mode="register" />

          <p className="mt-6 text-center text-[12.5px] text-[#64748B]">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login" className="font-bold text-[#047857] transition hover:text-[#10B981] hover:underline">
              Inicia sesión
            </Link>
          </p>
        </AuthCard>

        <footer className="mt-7 animate-rise [animation-delay:120ms]">
          <div className="flex flex-col items-center justify-center gap-2.5 text-[11px] font-medium text-[#64748B] sm:flex-row sm:gap-7">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircleIcon className="h-3.5 w-3.5 text-[#10B981]" />
              Sin comisiones ocultas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircleIcon className="h-3.5 w-3.5 text-[#10B981]" />
              Alertas inteligentes de presupuesto
            </span>
          </div>
          <p className="mt-5 text-center text-[10px] leading-relaxed text-[#8A9A94]">
            © 2026 Finova Technologies S.A.C. Todos los derechos reservados.
          </p>
        </footer>
      </main>
    </div>
  )
}
