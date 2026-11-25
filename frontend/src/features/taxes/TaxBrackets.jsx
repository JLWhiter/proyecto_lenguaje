import { toNumber } from '../../lib/format'
import { LAST_BRACKET_VISUAL_UIT, buildBrackets, formatUit, soles } from './taxRules'

function rangeLabel(bracket) {
  if (bracket.from === 0) return { soles: `Hasta ${soles(bracket.hasta)}`, uit: `hasta ${bracket.to} UIT` }
  if (bracket.hasta === null) return { soles: `Más de ${soles(bracket.desde)}`, uit: `más de ${bracket.from} UIT` }
  return { soles: `${soles(bracket.desde)} – ${soles(bracket.hasta)}`, uit: `${bracket.from} – ${bracket.to} UIT` }
}

function rateLabel(value) {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`
}

function Swatch({ bracket }) {
  return <span aria-hidden="true" className={`inline-block h-3 w-3 shrink-0 rounded-[4px] ${bracket.color} ${bracket.reached ? '' : 'opacity-30'}`} />
}

function NotReached() {
  return <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">No alcanzado</span>
}

/** Escala gráfica: cada tramo con ancho proporcional a su rango en UIT, relleno hasta la renta neta. */
function BracketScale({ brackets, net, uit }) {
  const netUit = uit > 0 ? net / uit : 0
  const segments = brackets.map((bracket) => {
    const to = bracket.to ?? bracket.from + LAST_BRACKET_VISUAL_UIT
    const width = to - bracket.from
    const fill = Math.min(1, Math.max(0, (netUit - bracket.from) / width))
    return { ...bracket, width, fill }
  })

  const description = [
    `Tu renta neta de ${soles(net)} equivale a ${formatUit(netUit)} UIT.`,
    ...brackets.map((bracket) =>
      bracket.reached
        ? `Tramo ${bracket.number} (${rateLabel(bracket.tasa)}): ${bracket.hasta === null ? 'alcanzado, sin tope' : `${Math.round(bracket.fill * 100)}% usado`}.`
        : `Tramo ${bracket.number} (${rateLabel(bracket.tasa)}): no alcanzado.`,
    ),
  ].join(' ')

  return (
    <figure className="mt-5 rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-600">
        Tu renta neta: <strong className="font-bold text-slate-900 tabular-nums">{soles(net)}</strong>{' '}
        <span className="whitespace-nowrap text-slate-500 tabular-nums">({formatUit(netUit)} UIT)</span>
      </p>
      <div role="img" aria-label={description} className="mt-3 flex gap-0.5">
        {segments.map((segment) => (
          <div key={segment.number} className="min-w-0" style={{ flexGrow: segment.width, flexBasis: 0 }}>
            <div className={`h-3 overflow-hidden rounded-[4px] ${segment.fill > 0 ? 'bg-emerald-100' : 'bg-slate-200/70'}`}>
              <div className={`h-full rounded-[4px] transition-[width] duration-500 ${segment.color}`} style={{ width: `${segment.fill * 100}%` }} />
            </div>
            <p className={`mt-1.5 text-center text-[11px] font-bold leading-none tabular-nums ${segment.reached ? 'text-slate-800' : 'text-slate-400'}`}>
              {rateLabel(segment.tasa)}
            </p>
            <p className="mt-1 hidden text-center text-[11px] leading-none text-slate-400 tabular-nums sm:block">
              {segment.to === null ? `${segment.from}+` : `${segment.from}–${segment.to}`}
            </p>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 text-xs leading-5 text-slate-500">
        Cada bloque es un tramo; su ancho es proporcional a su rango en UIT (el último no tiene tope). La parte coloreada es la porción de tu renta
        neta que cae en ese tramo.
      </figcaption>
    </figure>
  )
}

/** Escala progresiva: visual + tabla (≥ md) / tarjetas (móvil). Los tramos no alcanzados se muestran en gris. */
export default function TaxBrackets({ result }) {
  const brackets = buildBrackets(result)
  const uit = toNumber(result.uit)
  const net = toNumber(result.renta_neta)
  const reached = brackets.filter((bracket) => bracket.reached)
  const marginal = reached.at(-1)

  return (
    <section aria-labelledby="tax-brackets-title" className="min-w-0 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="tax-brackets-title" className="text-xl font-bold text-slate-900">
            Escala progresiva por tramos
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            La renta neta se reparte en tramos y cada parte paga su propia tasa: ganar más no encarece lo que ya está en los tramos anteriores
            (art. 53 de la Ley del Impuesto a la Renta).
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {marginal ? `Tasa marginal ${rateLabel(marginal.tasa)}` : 'Ningún tramo alcanzado'}
        </span>
      </div>

      <BracketScale brackets={brackets} net={net} uit={uit} />

      {/* Escritorio / tablet: tabla */}
      <div className="mt-6 hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Impuesto por tramo de la escala progresiva, año {result.anio}</caption>
          <thead>
            <tr className="text-xs uppercase tracking-[0.12em] text-slate-400">
              <th scope="col" className="pb-3 pr-4 font-semibold">
                Tramo
              </th>
              <th scope="col" className="pb-3 pr-4 font-semibold">
                Rango
              </th>
              <th scope="col" className="pb-3 pr-4 text-right font-semibold">
                Tasa
              </th>
              <th scope="col" className="pb-3 pr-4 text-right font-semibold">
                Base
              </th>
              <th scope="col" className="pb-3 text-right font-semibold">
                Impuesto
              </th>
            </tr>
          </thead>
          <tbody>
            {brackets.map((bracket) => {
              const range = rangeLabel(bracket)
              const muted = !bracket.reached
              return (
                <tr key={bracket.number} className={`border-t border-slate-100 align-top ${muted ? 'text-slate-400' : 'text-slate-700'}`}>
                  <th scope="row" className="py-3 pr-4 font-semibold">
                    <span className="flex flex-wrap items-center gap-2">
                      <Swatch bracket={bracket} />
                      <span className={muted ? 'text-slate-400' : 'text-slate-900'}>Tramo {bracket.number}</span>
                      {muted && <NotReached />}
                    </span>
                  </th>
                  <td className="py-3 pr-4">
                    <span className="block tabular-nums">{range.soles}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{range.uit}</span>
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold tabular-nums">{rateLabel(bracket.tasa)}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums">
                    {muted ? '—' : soles(bracket.base)}
                    {!muted && bracket.hasta !== null && (
                      <span className="mt-0.5 block text-xs text-slate-400">{Math.round(bracket.fill * 100)}% del tramo</span>
                    )}
                  </td>
                  <td className={`whitespace-nowrap py-3 text-right font-semibold tabular-nums ${muted ? '' : 'text-slate-900'}`}>
                    {muted ? '—' : soles(bracket.impuesto)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-900/80 text-slate-900">
              <th scope="row" colSpan={3} className="pt-3 pr-4 font-bold">
                Total
              </th>
              <td className="whitespace-nowrap pt-3 pr-4 text-right font-bold tabular-nums">{soles(net)}</td>
              <td className="whitespace-nowrap pt-3 text-right font-bold text-emerald-700 tabular-nums">{soles(result.impuesto)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Móvil: tarjetas apiladas */}
      <ul className="mt-5 space-y-3 md:hidden" aria-label={`Impuesto por tramo, año ${result.anio}`}>
        {brackets.map((bracket) => {
          const range = rangeLabel(bracket)
          const muted = !bracket.reached
          return (
            <li
              key={bracket.number}
              className={`rounded-2xl border p-3 ${muted ? 'border-dashed border-slate-200 bg-white text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Swatch bracket={bracket} />
                  <span className={`font-semibold ${muted ? 'text-slate-400' : 'text-slate-900'}`}>Tramo {bracket.number}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${muted ? 'bg-slate-100' : 'bg-white text-slate-800'}`}>
                    {rateLabel(bracket.tasa)}
                  </span>
                </div>
                {muted && <NotReached />}
              </div>
              <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                <dt className="text-slate-500">Rango</dt>
                <dd className="text-right tabular-nums">
                  {range.soles}
                  <span className="block text-xs text-slate-400">{range.uit}</span>
                </dd>
                {!muted && (
                  <>
                    <dt className="text-slate-500">Base</dt>
                    <dd className="text-right tabular-nums">
                      {soles(bracket.base)}
                      {bracket.hasta !== null && <span className="text-xs text-slate-400"> · {Math.round(bracket.fill * 100)}%</span>}
                    </dd>
                    <dt className="text-slate-500">Impuesto</dt>
                    <dd className="text-right font-bold text-slate-900 tabular-nums">{soles(bracket.impuesto)}</dd>
                  </>
                )}
              </dl>
            </li>
          )
        })}
        <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
          <span className="text-sm font-semibold text-emerald-800">Total sobre {soles(net)}</span>
          <span className="whitespace-nowrap text-lg font-bold text-emerald-700 tabular-nums">{soles(result.impuesto)}</span>
        </li>
      </ul>
    </section>
  )
}
