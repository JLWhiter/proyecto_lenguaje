import { Link } from 'react-router-dom'
import Brand from '../components/auth/Brand'
import AuthCard from '../components/auth/AuthCard'
import { ArrowRightIcon } from '../components/icons'

export default function NotFoundPage() {
  return (
    <div className="auth-page relative min-h-screen overflow-x-clip">
      <main className="relative mx-auto flex min-h-screen w-full max-w-[470px] flex-col px-4 py-10">
        <div className="my-auto w-full">
        <Brand tagline="La página que buscas no está disponible" />
        <AuthCard className="mt-7 animate-rise text-center">
          <p className="text-[44px] font-extrabold leading-none tracking-[-0.04em] text-[#10B981]">404</p>
          <h1 className="mt-3 text-[21px] font-extrabold text-[#111827]">Página no encontrada</h1>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#64748B]">
            Verifica la dirección o vuelve a una pantalla disponible.
          </p>
          <Link
            to="/login"
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] text-[14px] font-bold text-white shadow-[0_14px_28px_-14px_rgba(5,150,105,0.9)] transition hover:-translate-y-0.5"
          >
            Volver al inicio de sesión
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </AuthCard>
        </div>
      </main>
    </div>
  )
}
