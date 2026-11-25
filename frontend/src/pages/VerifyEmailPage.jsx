import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Brand from '../components/auth/Brand'
import AuthCard from '../components/auth/AuthCard'
import Alert from '../components/auth/Alert'
import { feedbackFromError } from '../components/auth/feedback'
import { useResendVerification } from '../components/auth/useResendVerification'
import { AlertCircleIcon, ArrowRightIcon, CheckCircleIcon, LoaderIcon } from '../components/icons'
import { authService } from '../services/authService'
import { useAuth } from '../context/AuthContext'

const primaryLink =
  'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] px-4 text-[14px] font-bold text-white shadow-[0_14px_28px_-14px_rgba(5,150,105,0.9)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#10B981]/25 disabled:cursor-wait disabled:opacity-60 disabled:hover:translate-y-0'
const secondaryLink =
  'flex min-h-10 items-center justify-center text-[13px] font-bold text-[#047857] hover:text-[#10B981] hover:underline'

/**
 * /verificar-email?uid=…&token=… — funciona con y sin sesión.
 * Estados: loading · success · invalid (enlace no válido/vencido) · missing (faltan datos) · error (red, 429, 5xx).
 */
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const { user, updateUser } = useAuth()
  const uid = searchParams.get('uid') || ''
  const token = searchParams.get('token') || ''

  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState(() =>
    uid && token ? { status: 'loading' } : { status: 'missing' },
  )
  const startedFor = useRef(null)

  useEffect(() => {
    if (!uid || !token) return
    // Una sola petición por intento (StrictMode monta los efectos dos veces en desarrollo).
    if (startedFor.current === attempt) return
    startedFor.current = attempt

    authService
      .verifyEmail({ uid, token })
      .then((data) => {
        // Si es la cuenta con sesión abierta, el header y Configuración se actualizan al instante.
        if (data?.user) updateUser(data.user)
        setState({ status: 'success', message: data?.detail, verifiedUser: data?.user ?? null })
      })
      .catch((error) => {
        if (error?.status === 400) {
          setState({ status: 'invalid', message: error.message || 'El enlace de verificación no es válido o ya expiró.' })
        } else {
          setState({ status: 'error', feedback: feedbackFromError(error, 'No pudimos verificar tu correo. Inténtalo de nuevo.') })
        }
      })
  }, [uid, token, attempt, updateUser])

  const otherAccount = Boolean(user && state.verifiedUser && state.verifiedUser.id !== user.id)

  return (
    <div className="auth-page relative min-h-screen overflow-x-clip">
      <main className="relative mx-auto flex min-h-screen w-full max-w-[470px] flex-col px-4 py-10">
        <div className="my-auto w-full">
        <Brand tagline="Verificación de correo electrónico" />

        <AuthCard className="mt-7 animate-rise text-center">
          {state.status === 'loading' && (
            <div className="space-y-5 py-4" role="status">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F0F7F5] text-[#047857]">
                <LoaderIcon className="h-7 w-7" />
              </span>
              <h1 className="text-[20px] font-extrabold text-[#111827]">Verificando tu correo…</h1>
              <p className="text-[12.5px] text-[#64748B]">Esto tomará solo un momento.</p>
            </div>
          )}

          {state.status === 'success' && (
            <div className="space-y-5">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#D1FAE5] text-[#047857]">
                <CheckCircleIcon className="h-7 w-7" />
              </span>
              <div>
                <h1 className="text-[21px] font-extrabold text-[#111827]">Correo verificado</h1>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#64748B]">
                  {state.message || 'Correo verificado correctamente.'}
                </p>
                {state.verifiedUser?.email && (
                  <p className="mt-1 break-all text-[13px] font-semibold text-[#1F2937]">{state.verifiedUser.email}</p>
                )}
              </div>
              {otherAccount && (
                <Alert tone="info" className="text-left">
                  Este enlace corresponde a otra cuenta. Tu sesión actual ({user.email}) no cambió.
                </Alert>
              )}
              {user ? (
                <Link to="/app" className={primaryLink}>
                  Ir a Finova
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              ) : (
                <Link to="/login" state={{ notice: 'Tu correo quedó verificado. Inicia sesión para continuar.' }} className={primaryLink}>
                  Iniciar sesión
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}

          {(state.status === 'invalid' || state.status === 'missing') && (
            <InvalidLink
              message={
                state.status === 'missing'
                  ? 'El enlace no incluye los datos de verificación necesarios. Ábrelo completo desde el correo que te enviamos.'
                  : state.message
              }
            />
          )}

          {state.status === 'error' && (
            <div className="space-y-5">
              <ErrorBadge />
              <h1 className="text-[21px] font-extrabold text-[#111827]">No pudimos verificar tu correo</h1>
              <Alert tone={state.feedback.tone} title={state.feedback.title} className="text-left">
                {state.feedback.message}
              </Alert>
              <button
                type="button"
                onClick={() => {
                  setState({ status: 'loading' })
                  setAttempt((value) => value + 1)
                }}
                className={primaryLink}
              >
                Reintentar
              </button>
              <Link to={user ? '/app' : '/login'} className={secondaryLink}>
                {user ? 'Volver a Finova' : 'Volver al inicio de sesión'}
              </Link>
            </div>
          )}
        </AuthCard>
        </div>
      </main>
    </div>
  )
}

function ErrorBadge() {
  return (
    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-[#D35F5F]">
      <AlertCircleIcon className="h-7 w-7" />
    </span>
  )
}

/** Enlace no válido o vencido: con sesión se puede pedir otro aquí mismo; sin sesión, tras iniciar sesión. */
function InvalidLink({ message }) {
  const { user } = useAuth()
  const { resend, sending, feedback } = useResendVerification()

  return (
    <div className="space-y-5">
      <ErrorBadge />
      <div>
        <h1 className="text-[21px] font-extrabold text-[#111827]">Enlace no válido o vencido</h1>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#64748B]">
          Los enlaces de verificación caducan después de un tiempo y solo sirven para la cuenta que los recibió.
        </p>
      </div>
      <Alert tone="error" className="text-left">
        {message}
      </Alert>

      {user ? (
        user.email_verified ? (
          <>
            <Alert tone="success" className="text-left">
              Tu correo {user.email} ya está verificado. No necesitas hacer nada más.
            </Alert>
            <Link to="/app" className={primaryLink}>
              Ir a Finova
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </>
        ) : (
          <>
            {feedback && (
              <Alert tone={feedback.tone} title={feedback.title} className="text-left">
                {feedback.message}
              </Alert>
            )}
            <button type="button" onClick={resend} disabled={sending} className={primaryLink}>
              {sending ? 'Enviando…' : 'Enviar un enlace nuevo'}
            </button>
            <Link to="/app" className={secondaryLink}>
              Ir a Finova
            </Link>
          </>
        )
      ) : (
        <>
          <p className="text-[12.5px] leading-relaxed text-[#64748B]">
            Inicia sesión y solicita un enlace nuevo desde <span className="font-semibold text-[#1F2937]">Configuración</span>.
          </p>
          <Link to="/login" state={{ from: '/app/configuracion' }} className={primaryLink}>
            Iniciar sesión
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  )
}
