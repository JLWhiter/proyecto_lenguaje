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
