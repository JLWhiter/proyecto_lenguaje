/**
 * Aviso de un solo uso para la pantalla de login (en memoria, sobrevive a la navegación SPA).
 *
 * Al cerrar la sesión, ProtectedRoute redirige a /login con su propio `state` ({ from }) y esa
 * redirección puede ganarle a un `navigate('/login', { state: { notice } })` (react-router aplica la
 * navegación como transición). Por eso los avisos de "cerraste sesión…" viajan por aquí.
 *
 *   setLoginNotice('Cerraste sesión en todos tus dispositivos.')   // antes de cerrar la sesión
 *   LoginPage: peekLoginNotice() al montar y clearLoginNotice() en un efecto
 */
let pending = ''

export function setLoginNotice(message) {
  pending = typeof message === 'string' ? message : ''
}

export function peekLoginNotice() {
  return pending
}

export function clearLoginNotice() {
  pending = ''
}
