import { Link } from 'react-router-dom'
import Brand from '../components/auth/Brand'
import AuthCard from '../components/auth/AuthCard'
import Alert from '../components/auth/Alert'
import { ArrowLeftIcon } from '../components/icons'
import { useAuth } from '../context/AuthContext'

const CONTENT = {
  terminos: {
    title: 'Términos de Servicio',
    intro:
      'Estos términos describen las condiciones de uso de Finova, una aplicación web para organizar tus finanzas personales. El documento es preliminar y se completará antes de un lanzamiento público.',
    sections: [
      {
        heading: 'Qué ofrece Finova',
        text: 'Finova te permite registrar cuentas y billeteras, anotar ingresos, gastos y transferencias, definir presupuestos y metas, recibir alertas sobre tu actividad y ver un resumen de tu situación financiera. También puedes exportar tus movimientos en formato CSV desde Configuración.',
      },
      {
        heading: 'Uso de la cuenta',
        text: 'Debes proporcionar información veraz y mantener la confidencialidad de tus credenciales. La cuenta es personal y no debe compartirse. Desde Configuración puedes cambiar tu contraseña y cerrar la sesión en todos tus dispositivos.',
      },
      {
        heading: 'Información que registras',
        text: 'Los saldos, movimientos y presupuestos los ingresas tú: Finova no se conecta con bancos ni mueve dinero real. Las cifras, alertas y resúmenes son referenciales y no constituyen asesoría financiera, tributaria ni legal.',
      },
      {
        heading: 'Seguridad',
        text: 'Finova aplica hash de contraseñas, cookies de sesión HttpOnly, protección CSRF, límites de intentos y validaciones en el servidor. Ningún sistema puede garantizar seguridad absoluta, por lo que debes usar una contraseña única y mantener tus dispositivos protegidos.',
      },
      {
        heading: 'Contacto',
        text: 'Para consultas sobre estos términos, utiliza los canales oficiales de soporte de Finova cuando estén publicados.',
      },
    ],
  },
  privacidad: {
    title: 'Política de Privacidad',
    intro:
      'Esta política describe qué datos trata Finova para crear y proteger tu cuenta y para mostrarte tu información financiera. Es un documento preliminar sujeto a revisión legal.',
    sections: [
      {
        heading: 'Datos que recopilamos',
        text: 'De tu cuenta: nombre completo, correo electrónico, moneda principal, estado de verificación del correo y fechas de creación y actualización. De tu uso: las cuentas, movimientos, presupuestos, metas y alertas que registras en la aplicación.',
      },
      {
        heading: 'Finalidad',
        text: 'Autenticar tu identidad, mantener tu sesión, aplicar medidas de seguridad, permitir la recuperación de acceso y calcular los resúmenes, presupuestos y alertas que ves en Finova. No utilizamos estos datos para publicidad ni los vendemos a terceros.',
      },
      {
        heading: 'Contraseñas',
        text: 'Las contraseñas se almacenan únicamente como hash PBKDF2 mediante el sistema de Django. Finova no guarda ni muestra contraseñas en texto plano.',
      },
      {
        heading: 'Cookies y almacenamiento local',
        text: 'Usamos una cookie de sesión HttpOnly para identificar la sesión autenticada y una cookie CSRF legible por la aplicación para proteger las peticiones. No almacenamos tokens de sesión en localStorage; allí solo guardamos preferencias de visualización de este dispositivo, como "Mostrar saldos".',
      },
      {
        heading: 'Tus derechos',
        text: 'Puedes corregir tu nombre y tu moneda principal desde Configuración y descargar tus movimientos en CSV cuando quieras. Para solicitar la eliminación de tu cuenta o de tus datos, utiliza los canales oficiales de Finova; el procedimiento formal se habilitará antes de un lanzamiento público.',
      },
    ],
  },
}

export default function LegalPage({ kind = 'terminos' }) {
  const content = CONTENT[kind] ?? CONTENT.terminos
  const { user } = useAuth()
  const back = user ? { to: '/app/configuracion', label: 'Volver a Finova' } : { to: '/registro', label: 'Volver al registro' }

  return (
    <div className="auth-page relative min-h-screen overflow-x-clip">
      <main className="relative mx-auto w-full max-w-[700px] px-4 py-8 sm:py-10">
        <Link
          to={back.to}
          className="mb-6 inline-flex min-h-10 items-center gap-2 text-[12px] font-semibold text-[#64748B] transition hover:text-[#047857]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/70 shadow-sm">
            <ArrowLeftIcon className="h-4 w-4" />
          </span>
          {back.label}
        </Link>

        <Brand badge={false} className="items-start text-left" />

        <AuthCard className="mt-6 animate-rise">
          <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-[#111827]">{content.title}</h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[#64748B]">{content.intro}</p>

          <Alert tone="info" className="mt-5">
            Versión preliminar. Este texto no constituye todavía un documento legal definitivo.
          </Alert>

          <div className="mt-6 space-y-5">
            {content.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-[13.5px] font-bold text-[#1F2937]">{section.heading}</h2>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[#64748B]">{section.text}</p>
              </section>
            ))}
          </div>

          <p className="mt-7 border-t border-[#E8EFEB] pt-4 text-[10.5px] text-[#8A9A94]">
            © 2026 Finova Technologies S.A.C. Todos los derechos reservados.
          </p>
        </AuthCard>
      </main>
    </div>
  )
}
