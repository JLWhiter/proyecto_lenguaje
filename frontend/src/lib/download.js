/** Descarga un Blob como archivo en el navegador. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const FILENAME_STAR = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/
const FILENAME_PLAIN = /filename\s*=\s*"?([^";]+)"?/i

function decodeFilename(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * Nombre de archivo de una cabecera Content-Disposition ('' si no trae uno):
 * 'attachment; filename="finova-movimientos-2026-11.xlsx"' → 'finova-movimientos-2026-11.xlsx'.
 * Prefiere `filename*=UTF-8''…` (codificado) y nunca devuelve rutas: solo el nombre.
 */
export function filenameFromDisposition(disposition) {
  const text = String(disposition || '')
  const match = FILENAME_STAR.exec(text) ?? FILENAME_PLAIN.exec(text)
  if (!match) return ''
  const name = decodeFilename(match[1].trim())
  return name.split(/[\\/]/).pop().trim()
}
