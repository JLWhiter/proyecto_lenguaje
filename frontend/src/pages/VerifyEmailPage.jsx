import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Brand from '../components/auth/Brand'
import AuthCard from '../components/auth/AuthCard'
import Alert from '../components/auth/Alert'
import { ArrowRightIcon, CheckCircleIcon, LoaderIcon } from '../components/icons'
import { authService } from '../services/authService'
import { useAuth } from '../context/AuthContext'
import { messageFromApi } from '../lib/api'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const { user, refreshUser } = useAuth()
  const [state, setState] = useState({ status: 'loading', message: '' })
  const started = useRef(false)

  const uid = searchParams.get('uid') || ''
  const token = searchParams.get('token') || ''

  useEffect(() => {
    if (started.current) return
    started.current = true

    if (!uid || !token) {
      setState({ status: 'error', message: 'El enlace no incluye los datos de verificación necesarios.' })
      return
    }

    authService
      .verifyEmail({ uid, token })
      .then((data) => {
        setState({ status: 'success', message: data.detail })
        if (user) refreshUser().catch(() => {})
      })
      .catch((error) => {
        setState({
          status: 'error',
          message: messageFromApi(error, 'No pudimos verificar el correo. Solicita un enlace nuevo.'),
        })
      })
  }, [uid, token, user, refreshUser])

  return (
    <div className="auth-page relative min-h-screen overflow-x-clip">
      <main className="relative mx-auto flex min-h-screen w-full max-w-[470px] flex-col px-4 py-10">
        <div className="my-auto w-full">
        <Brand tagline="Verificación de correo electrónico" />

        <AuthCard className="mt-7 animate-rise text-center">
          {state.status === 'loading' && (
            <div className="space-y-5 py-4">
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
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#64748B]">{state.message}</p>
              </div>
              <Link
                to={user ? '/app' : '/login'}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-[14px] font-bold text-white shadow-[0_14px_28px_-14px_rgba(5,150,105,0.9)] transition hover:-translate-y-0.5"
              >
                {user ? 'Ir a Finova' : 'Iniciar sesión'}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          )}

          {state.status === 'error' && (
            <div className="space-y-5">
              <h1 className="text-[21px] font-extrabold text-[#111827]">No se pudo verificar</h1>
              <Alert tone="error">{state.message}</Alert>
              <Link
                to={user ? '/app' : '/login'}
                className="inline-flex text-[13px] font-bold text-[#047857] hover:text-[#10B981] hover:underline"
              >
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
