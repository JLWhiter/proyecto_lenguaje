import { useCallback, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { authService } from '../../services/authService'
import { feedbackFromError } from './feedback'

/**
 * "Reenviar enlace de verificación" (requiere sesión).
 *   const { resend, sending, feedback } = useResendVerification()
 * `feedback` → { tone, title?, message } para <Alert>:
 *   200 ya verificado (actualiza el usuario) · 202 enviado · 503 envío de correos no configurado · 429 espera.
 */
export function useResendVerification() {
  const { updateUser } = useAuth()
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const resend = useCallback(async () => {
    setSending(true)
    setFeedback(null)
    try {
      const data = await authService.resendVerification()
      if (data?.email_verified) updateUser({ email_verified: true })
      setFeedback({
        tone: 'success',
        message:
          data?.detail ||
          (data?.email_verified
            ? 'Tu correo electrónico ya está verificado.'
            : 'Te enviamos un nuevo enlace de verificación. Revisa tu bandeja de entrada.'),
      })
    } catch (error) {
      setFeedback(
        error?.status === 503
          ? { tone: 'info', title: 'No se envió el enlace', message: error.message }
          : feedbackFromError(error, 'No pudimos reenviar el enlace. Inténtalo de nuevo.'),
      )
    } finally {
      setSending(false)
    }
  }, [updateUser])

  return { resend, sending, feedback }
}
