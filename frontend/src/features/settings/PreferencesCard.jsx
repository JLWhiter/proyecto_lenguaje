import { MonitorSmartphone, SlidersHorizontal } from 'lucide-react'
import { usePreferences } from '../../context/PreferencesContext'
import SettingsCard from './SettingsCard'

export default function PreferencesCard() {
  const { showAmounts, setShowAmounts } = usePreferences()

  return (
    <SettingsCard
      id="settings-preferences"
      icon={SlidersHorizontal}
      title="Preferencias"
      description="Ajustes de visualización de la aplicación."
    >
      <label
        htmlFor="settings-show-amounts"
        className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl bg-slate-50 p-4 transition hover:bg-slate-100/80"
      >
        <span className="min-w-0">
          <span className="block font-semibold text-slate-800">Mostrar saldos</span>
          <span id="settings-show-amounts-hint" className="mt-1 block text-sm leading-snug text-slate-500">
            Desactívalo para ocultar los saldos y montos (••••) en toda la aplicación si usas Finova en un lugar público.
            Los porcentajes siguen visibles.
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
          <input
            id="settings-show-amounts"
            type="checkbox"
            role="switch"
            aria-describedby="settings-show-amounts-hint settings-show-amounts-device"
            checked={showAmounts}
            onChange={(event) => setShowAmounts(event.target.checked)}
            className="peer sr-only"
          />
          {/* Interruptor visual: 48×28 px; toda la fila es el área táctil. */}
          <span
            aria-hidden="true"
            className="relative inline-flex h-7 w-12 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-emerald-500 peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-500/25"
          />
          <span aria-hidden="true" className="text-[11px] font-semibold text-slate-500">
            {showAmounts ? 'Visibles' : 'Ocultos'}
          </span>
        </span>
      </label>

      <p id="settings-show-amounts-device" className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <span>
          Se guarda solo en este dispositivo y navegador: no se sincroniza con tu cuenta. También puedes cambiarlo con el
          botón del ojo en el resumen.
        </span>
      </p>
    </SettingsCard>
  )
}
