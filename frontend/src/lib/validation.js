export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(value.trim())
}

export function passwordChecks(password) {
  const minLength = password.length >= 8
  const hasNumberOrSymbol = /[\d]/.test(password) || /[^A-Za-z0-9]/.test(password)
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password)
  const strong = password.length >= 12 && hasMixedCase && hasNumberOrSymbol

  const score = Number(minLength) + Number(hasNumberOrSymbol) + Number(strong)
  let label = ''
  if (password.length > 0) {
    label = score >= 2 ? 'Segura' : score === 1 ? 'Débil' : 'Muy débil'
  }

  return { minLength, hasNumberOrSymbol, hasMixedCase, strong, score, label }
}

export function isStrongPassword(password) {
  const { minLength, hasNumberOrSymbol } = passwordChecks(password)
  return minLength && hasNumberOrSymbol
}

export function firstError(value) {
  if (Array.isArray(value)) return value.length ? String(value[0]) : ''
  if (value == null) return ''
  return String(value)
}
