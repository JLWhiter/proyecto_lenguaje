import { apiRequest, resetCsrfToken, setCsrfToken } from '../lib/api'

export const authService = {
  async csrf() {
    return apiRequest('/auth/csrf/')
  },

  async me() {
    return apiRequest('/auth/me/')
  },

  async session() {
    return apiRequest('/auth/session/')
  },

  async login({ email, password, rememberMe }) {
    const data = await apiRequest('/auth/login/', {
      method: 'POST',
      body: { email, password, remember_me: Boolean(rememberMe) },
    })
    setCsrfToken(data?.csrfToken)
    return data
  },

  async register(payload) {
    const data = await apiRequest('/auth/register/', {
      method: 'POST',
      body: {
        full_name: payload.fullName,
        email: payload.email,
        currency: payload.currency,
        password: payload.password,
        password_confirm: payload.passwordConfirm,
        accept_terms: payload.acceptTerms,
      },
    })
    setCsrfToken(data?.csrfToken)
    return data
  },

  async logout() {
    try {
      return await apiRequest('/auth/logout/', { method: 'POST' })
    } finally {
      resetCsrfToken()
    }
  },

  /** Cierra TODAS las sesiones del usuario (incluida la actual). → `{ detail }` */
  async logoutAll() {
    try {
      return await apiRequest('/auth/logout-all/', { method: 'POST' })
    } finally {
      resetCsrfToken()
    }
  },

  /** PATCH me/: solo nombre y moneda principal (el correo no es editable). Devuelve el usuario actualizado. */
  async updateProfile({ fullName, currency }) {
    const body = {}
    if (fullName !== undefined) body.full_name = fullName
    if (currency !== undefined) body.currency = currency
    return apiRequest('/auth/me/', { method: 'PATCH', body })
  },

  /**
   * Cambia la contraseña sin cerrar la sesión actual (las demás sesiones quedan invalidadas).
   * El backend rota el token CSRF: guardamos el nuevo igual que tras el login. → `{ detail, user, csrfToken }`
   */
  async changePassword({ currentPassword, newPassword, newPasswordConfirm }) {
    const data = await apiRequest('/auth/password-change/', {
      method: 'POST',
      body: {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      },
    })
    setCsrfToken(data?.csrfToken)
    return data
  },

  /** Reenvía el enlace de verificación. 200 → ya verificado · 202 → enviado · 503 sin correo configurado · 429. */
  async resendVerification() {
    return apiRequest('/auth/verify-email/resend/', { method: 'POST' })
  },

  async passwordReset(email) {
    return apiRequest('/auth/password-reset/', {
      method: 'POST',
      body: { email },
    })
  },

  async resetPassword({ uid, token, password, passwordConfirm }) {
    return apiRequest('/auth/password-reset/confirm/', {
      method: 'POST',
      body: { uid, token, password, password_confirm: passwordConfirm },
    })
  },

  async verifyEmail({ uid, token }) {
    return apiRequest('/auth/verify-email/', {
      method: 'POST',
      body: { uid, token },
    })
  },
}
