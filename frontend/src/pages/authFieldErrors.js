// Mensajes de validación de los formularios de acceso (inicio de sesión, registro, recuperar y restablecer
// la contraseña). Cada función devuelve '' si el campo aún no se tocó o es válido.
import { isStrongPassword, isValidEmail } from '../lib/validation'

export function emailError(email, touched) {
  if (!touched) return ''
  if (email.trim().length === 0) return 'Ingresa tu correo electrónico.'
  if (!isValidEmail(email)) return 'Ingresa un correo electrónico válido.'
  return ''
}

/** Contraseña nueva (registro y restablecer): al menos 8 caracteres con un número o símbolo. */
export function newPasswordError(password, touched) {
  if (!touched) return ''
  if (password.length === 0) return 'Crea una contraseña.'
  if (!isStrongPassword(password)) return 'Usa al menos 8 caracteres e incluye un número o símbolo.'
  return ''
}

export function confirmPasswordError(password, confirm, touched) {
  if (!touched) return ''
  if (confirm.length === 0) return 'Confirma tu contraseña.'
  if (confirm !== password) return 'Las contraseñas no coinciden.'
  return ''
}

/** Solo los errores de la API que corresponden a campos del formulario (`fields`). */
export function pickFieldErrors(messages, fields) {
  const known = {}
  for (const field of fields) if (messages[field]) known[field] = messages[field]
  return known
}
