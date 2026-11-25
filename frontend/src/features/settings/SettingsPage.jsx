import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import DataCard from './DataCard'
import PreferencesCard from './PreferencesCard'
import ProfileCard from './ProfileCard'
import SecurityCard from './SecurityCard'

/**
 * Configuración: Perfil · Seguridad · Preferencias · Tus datos.
 * Una columna en móvil/tablet; dos desde xl (las tarjetas de cada fila se estiran a la misma altura).
 */
export default function SettingsPage() {
  useDocumentTitle('Configuración')

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Tu cuenta</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Configuración</h1>
        <p className="mt-2 text-sm text-slate-500">Administra tu perfil, la seguridad de tu cuenta, tus preferencias y tus datos.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ProfileCard />
        <SecurityCard />
        <PreferencesCard />
        <DataCard />
      </div>
    </div>
  )
}
