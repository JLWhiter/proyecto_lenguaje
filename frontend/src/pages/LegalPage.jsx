import { Link } from 'react-router-dom'
import Brand from '../components/auth/Brand'
import AuthCard from '../components/auth/AuthCard'
import Alert from '../components/auth/Alert'
import { ArrowLeftIcon } from '../components/icons'

const CONTENT = {
  terminos: {
    title: 'Términos de Servicio',
    intro:
      'Estos términos describen las condiciones de uso del módulo de autenticación de Finova. El documento es preliminar y se completará antes del lanzamiento público.',
    sections: [
      {
        heading: 'Uso de la cuenta',
        text: 'Debes proporcionar información veraz y mantener la confidencialidad de tus credenciales. La cuenta es personal y no debe compartirse.',
      },
      {
        heading: 'Seguridad',
        text: 'Finova aplica hash de contraseñas, cookies de sesión HttpOnly, protección CSRF y validaciones en el servidor. Ningún sistema puede garantizar seguridad absoluta, por lo que debes usar una contraseña única y mantener tus dispositivos protegidos.',
      },
      {
        heading: 'Alcance actual del servicio',
        text: 'En esta etapa solo está disponible el módulo de registro e inicio de sesión. Las funciones de dashboard financiero, transacciones, presupuestos y reportes aún no forman parte de la aplicación.',
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
      'Esta política describe cómo el módulo de autenticación de Finova trata los datos necesarios para crear y proteger tu cuenta. Es un documento preliminar sujeto a revisión legal.',
    sections: [
      {
        heading: 'Datos que recopilamos',
        text: 'Nombre completo, correo electrónico, moneda principal, estado de verificación del correo y fechas de creación y actualización de la cuenta.',
      },
      {
        heading: 'Finalidad',
        text: 'Autenticar tu identidad, mantener tu sesión, aplicar medidas de seguridad y permitir la recuperación de acceso. No utilizamos estos datos para publicidad.',
      },
      {
        heading: 'Contraseñas',
        text: 'Las contraseñas se almacenan únicamente como hash PBKDF2 mediante el sistema de Django. Finova no guarda ni muestra contraseñas en texto plano.',
      },
      {
        heading: 'Cookies',
        text: 'Usamos una cookie de sesión HttpOnly para identificar la sesión autenticada y una cookie CSRF legible por la aplicación para proteger las peticiones. No almacenamos tokens de sesión en localStorage.',
      },
      {
        heading: 'Derechos del usuario',
        text: 'Puedes solicitar información, corrección o eliminación de tus datos a través de los canales oficiales de Finova. El procedimiento formal se habilitará antes del lanzamiento público.',
      },
    ],
  },
}

export default function LegalPage({ kind = 'terminos' }) {
  const content = CONTENT[kind] ?? CONTENT.terminos

  return (
    <div className="auth-page relative min-h-screen overflow-x-clip">
      <main className="relative mx-auto w-full max-w-[700px] px-4 py-8 sm:py-10">
        <Link
          to="/registro"
          className="mb-6 inline-flex items-center gap-2 text-[12px] font-semibold text-[#64748B] transition hover:text-[#047857]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/70 shadow-sm">
            <ArrowLeftIcon className="h-4 w-4" />
          </span>
          Volver al registro
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
