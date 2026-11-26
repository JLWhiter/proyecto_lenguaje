import { Link } from 'react-router-dom'
import { ChevronRight, Database, Download, FileText, ShieldCheck } from 'lucide-react'
import { usePeriod } from '../../context/PeriodContext'
import SettingsCard, { buttonStyles } from './SettingsCard'
import { useDataExport } from './useDataExport'

const LEGAL_LINKS = [
  { to: '/terminos', label: 'Términos de Servicio', icon: FileText },
  { to: '/privacidad', label: 'Política de Privacidad', icon: ShieldCheck },
]

export default function DataCard() {
  const { period, label } = usePeriod()
  const { exportAll, exportMonth, exporting } = useDataExport()

  return (
    <SettingsCard id="settings-data" icon={Database} title="Tus datos" description="Lleva tu información contigo y revisa cómo la tratamos.">
      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="font-semibold text-slate-800">Exportar movimientos</p>
        <p className="mt-1 text-sm leading-snug text-slate-500">
          Descarga tus ingresos, gastos y transferencias de todas tus cuentas en un Excel (.xlsx) con resumen por
          categoría, gráficos y presupuestos. También se abre en Google Sheets.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={exportAll}
            disabled={exporting !== null}
            aria-busy={exporting === 'all' || undefined}
            className={buttonStyles.primary}
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
            {exporting === 'all' ? 'Preparando Excel…' : 'Descargar todo el historial (Excel)'}
          </button>
          <button
            type="button"
            onClick={() => exportMonth(period)}
            disabled={exporting !== null}
            aria-busy={exporting === 'month' || undefined}
            className={buttonStyles.outline}
          >
            {exporting === 'month' ? 'Preparando Excel…' : `Solo ${label} (Excel)`}
          </button>
        </div>
      </div>

      <nav aria-label="Documentos legales" className="mt-auto pt-4">
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
          {LEGAL_LINKS.map((link) => {
            const Icon = link.icon
            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    {link.label}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </SettingsCard>
  )
}
