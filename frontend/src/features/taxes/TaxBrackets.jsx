import { toNumber } from '../../lib/format'
import TaxAmount, { useAmountsHidden } from './TaxAmount'
import { LAST_BRACKET_VISUAL_UIT, buildBrackets, formatUit, soles } from './taxRules'

/** Rango del tramo en soles y en UIT. Con los montos ocultos solo queda el rango en UIT (`soles: null`). */
function rangeLabel(bracket, hidden) {
  if (bracket.from === 0) return { soles: hidden ? null : `Hasta ${soles(bracket.hasta)}`, uit: `hasta ${bracket.to} UIT`, uitTitle: `Hasta ${bracket.to} UIT` }
  if (bracket.hasta === null) {
    return { soles: hidden ? null : `Más de ${soles(bracket.desde)}`, uit: `más de ${bracket.from} UIT`, uitTitle: `Más de ${bracket.from} UIT` }
  }
  const uit = `${bracket.from} – ${bracket.to} UIT`
  return { soles: hidden ? null : `${soles(bracket.desde)} – ${soles(bracket.hasta)}`, uit, uitTitle: uit }
}

function rateLabel(value) {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`
}

/** Frase de un tramo para lectores de pantalla ('Tramo 2 (14%): 40% usado.'). */
function bracketSummary(bracket) {
  const name = `Tramo ${bracket.number} (${rateLabel(bracket.tasa)})`
  if (!bracket.reached) return `${name}: no alcanzado.`
  if (bracket.hasta === null) return `${name}: alcanzado, sin tope.`
  return `${name}: ${Math.round(bracket.fill * 100)}% usado.`
}

function Swatch({ bracket }) {
  return <span aria-hidden="true" className={`inline-block h-3 w-3 shrink-0 rounded-[4px] ${bracket.color} ${bracket.reached ? '' : 'opacity-30'}`} />
}

function NotReached() {
  return <span className="inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">No alcanzado</span>
}

/** Rango para mostrar: en soles con el rango en UIT debajo, o solo en UIT si los montos están ocultos. */
function RangeText({ range, subClassName }) {
  if (!range.soles) return <span className="block tabular-nums">{range.uitTitle}</span>
  return (
    <>
      <span className="block tabular-nums">{range.soles}</span>
      <span className={`block text-xs text-slate-500 ${subClassName}`}>{range.uit}</span>
    </>
  )
}

/** Escala gráfica: cada tramo con ancho proporcional a su rango en UIT, relleno hasta la renta neta. */
function BracketScale({ brackets, net, uit }) {
  const hidden = useAmountsHidden()
  const netUit = uit > 0 ? net / uit : 0
  const segments = brackets.map((bracket) => {
    const to = bracket.to ?? bracket.from + LAST_BRACKET_VISUAL_UIT
    const width = to - bracket.from
    const fill = Math.min(1, Math.max(0, (netUit - bracket.from) / width))
    return { ...bracket, width, fill }
  })

  const description = [
    hidden ? 'Tu renta neta: monto oculto.' : `Tu renta neta de ${soles(net)} equivale a ${formatUit(netUit)} UIT.`,
    ...brackets.map(bracketSummary),
  ].join(' ')

  return (
    <figure className="mt-5 rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-600">
        Tu renta neta: <TaxAmount value={net} className="font-bold text-slate-900" />
        {!hidden && (
          <>
            {' '}
            <span className="whitespace-nowrap text-slate-500 tabular-nums">({formatUit(netUit)} UIT)</span>
          </>
        )}
      </p>
      {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role -- gráfico hecho con bloques <div>: <img> no admite hijos */}
      <div role="img" aria-label={description} className="mt-3 flex gap-0.5">
        {segments.map((segment) => (
          <div key={segment.number} className="min-w-0" style={{ flexGrow: segment.width, flexBasis: 0 }}>
            <div className={`h-3 overflow-hidden rounded-[4px] ${segment.fill > 0 ? 'bg-emerald-100' : 'bg-slate-200/70'}`}>
              <div className={`h-full rounded-[4px] transition-[width] duration-500 ${segment.color}`} style={{ width: `${segment.fill * 100}%` }} />
            </div>
            <p className={`mt-1.5 text-center text-[11px] font-bold leading-none tabular-nums ${segment.reached ? 'text-slate-900' : 'text-slate-600'}`}>
              {rateLabel(segment.tasa)}
            </p>
            <p className="mt-1 hidden text-center text-[11px] leading-none text-slate-600 tabular-nums sm:block">
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
  const hidden = useAmountsHidden()
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
            <tr className="text-xs uppercase tracking-[0.12em] text-slate-500">
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
              const range = rangeLabel(bracket, hidden)
              const muted = !bracket.reached
              return (
                <tr key={bracket.number} className={`border-t border-slate-100 align-top ${muted ? 'text-slate-500' : 'text-slate-700'}`}>
                  <th scope="row" className="py-3 pr-4 font-semibold">
                    <span className="flex flex-wrap items-center gap-2">
                      <Swatch bracket={bracket} />
                      <span className={muted ? 'text-slate-600' : 'text-slate-900'}>Tramo {bracket.number}</span>
                      {muted && <NotReached />}
                    </span>
                  </th>
                  <td className="py-3 pr-4">
                    <RangeText range={range} subClassName="mt-0.5" />
                  </td>
                  <td className="py-3 pr-4 text-right font-semibold tabular-nums">{rateLabel(bracket.tasa)}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums">
                    {muted ? '—' : <TaxAmount value={bracket.base} />}
                    {!muted && bracket.hasta !== null && (
                      <span className="mt-0.5 block text-xs text-slate-500">{Math.round(bracket.fill * 100)}% del tramo</span>
                    )}
                  </td>
                  <td className={`whitespace-nowrap py-3 text-right font-semibold tabular-nums ${muted ? '' : 'text-slate-900'}`}>
                    {muted ? '—' : <TaxAmount value={bracket.impuesto} />}
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
              <td className="whitespace-nowrap pt-3 pr-4 text-right font-bold">
                <TaxAmount value={net} />
              </td>
              <td className="whitespace-nowrap pt-3 text-right font-bold text-emerald-700">
                <TaxAmount value={result.impuesto} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Móvil: tarjetas apiladas */}
      <ul className="mt-5 space-y-3 md:hidden" aria-label={`Impuesto por tramo, año ${result.anio}`}>
        {brackets.map((bracket) => {
          const range = rangeLabel(bracket, hidden)
          const muted = !bracket.reached
          return (
            <li
              key={bracket.number}
              className={`rounded-2xl border p-3 ${muted ? 'border-dashed border-slate-200 bg-white text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Swatch bracket={bracket} />
                  <span className={`font-semibold ${muted ? 'text-slate-600' : 'text-slate-900'}`}>Tramo {bracket.number}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${muted ? 'bg-slate-100 text-slate-600' : 'bg-white text-slate-800'}`}
                  >
                    {rateLabel(bracket.tasa)}
                  </span>
                </div>
                {muted && <NotReached />}
              </div>
              <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                <dt className="text-slate-500">Rango</dt>
                <dd className="text-right tabular-nums">
                  <RangeText range={range} />
                </dd>
                {!muted && (
                  <>
                    <dt className="text-slate-500">Base</dt>
                    <dd className="text-right tabular-nums">
                      <TaxAmount value={bracket.base} />
                      {bracket.hasta !== null && <span className="text-xs text-slate-500"> · {Math.round(bracket.fill * 100)}%</span>}
                    </dd>
                    <dt className="text-slate-500">Impuesto</dt>
                    <dd className="text-right font-bold text-slate-900">
                      <TaxAmount value={bracket.impuesto} />
                    </dd>
                  </>
                )}
              </dl>
            </li>
          )
        })}
        <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3">
          <span className="text-sm font-semibold text-emerald-800">
            Total sobre <TaxAmount value={net} />
          </span>
          <span className="whitespace-nowrap text-lg font-bold text-emerald-700">
            <TaxAmount value={result.impuesto} />
          </span>
        </li>
      </ul>
    </section>
  )
}
