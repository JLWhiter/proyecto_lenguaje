import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Lock, MailCheck, ShieldAlert, UserRound } from 'lucide-react'
import Alert from '../../components/auth/Alert'
import AuthInput from '../../components/auth/AuthInput'
import CurrencySelector from '../../components/auth/CurrencySelector'
import { allFieldMessages, feedbackFromError } from '../../components/auth/feedback'
import { useResendVerification } from '../../components/auth/useResendVerification'
import { UserIcon } from '../../components/icons'
import { useToast } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { formatDate, initialsOf } from '../../lib/format'
import { authService } from '../../services/authService'
import SettingsCard, { buttonStyles } from './SettingsCard'

/** Igual que el backend: espacios colapsados. */
function normalizeName(value) {
  return value.split(/\s+/).filter(Boolean).join(' ')
}

function validate({ fullName }) {
  const name = normalizeName(fullName)
  if (name.length < 2) return { full_name: 'Ingresa tu nombre completo.' }
  if (name.length > 150) return { full_name: 'El nombre no puede superar los 150 caracteres.' }
  return {}
}

export default function ProfileCard() {
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const nameRef = useRef(null)

  const savedName = user?.full_name ?? ''
  const savedCurrency = user?.currency ?? 'PEN'

  const [form, setForm] = useState(() => ({ fullName: savedName, currency: savedCurrency }))
  const [errors, setErrors] = useState({})
  const [feedback, setFeedback] = useState(null)
  const [saving, setSaving] = useState(false)
  // Mientras guarda el input está deshabilitado: el foco al campo con error se da al terminar.
  const focusNameAfterSave = useRef(false)

  useEffect(() => {
    if (saving || !focusNameAfterSave.current) return
    focusNameAfterSave.current = false
    nameRef.current?.focus()
  }, [saving])

  const changes = {}
  if (normalizeName(form.fullName) !== savedName) changes.fullName = normalizeName(form.fullName)
  if (form.currency !== savedCurrency) changes.currency = form.currency
  const dirty = Object.keys(changes).length > 0

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    const serverField = field === 'fullName' ? 'full_name' : field
    setErrors((current) => {
      if (!current[serverField]) return current
      const next = { ...current }
      delete next[serverField]
      return next
    })
    setFeedback(null)
  }

  function discard() {
    setForm({ fullName: savedName, currency: savedCurrency })
    setErrors({})
    setFeedback(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving || !dirty) return

    const clientErrors = validate(form)
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      nameRef.current?.focus()
      return
    }

    setSaving(true)
    setErrors({})
    setFeedback(null)
    try {
      const data = await authService.updateProfile(changes)
      updateUser(data)
      setForm({ fullName: data.full_name ?? '', currency: data.currency ?? savedCurrency })
      toast.success(
        changes.currency
          ? `Perfil actualizado. Ahora tus montos se muestran en ${data.currency_display || data.currency}.`
          : 'Perfil actualizado.',
      )
    } catch (error) {
      const fields = allFieldMessages(error)
      const known = {}
      const other = []
      for (const [key, message] of Object.entries(fields)) {
        if (key === 'full_name' || key === 'currency') known[key] = message
        else other.push(message)
      }
      setErrors(known)
      if (other.length > 0) setFeedback({ tone: 'error', message: other.join(' ') })
      else if (Object.keys(known).length === 0) setFeedback(feedbackFromError(error, 'No pudimos guardar tu perfil. Inténtalo de nuevo.'))
      focusNameAfterSave.current = Boolean(known.full_name)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsCard
      id="settings-profile"
      icon={UserRound}
      title="Perfil"
      description="Tu nombre y tu moneda principal se usan en toda la aplicación."
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-700"
        >
          {initialsOf(user?.full_name, user?.email)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900">{user?.full_name || 'Sin nombre'}</p>
          {user?.created_at && (
            <p className="text-sm text-slate-500">Miembro desde {formatDate(user.created_at)}</p>
          )}
        </div>
      </div>

      <EmailStatus />

      <form onSubmit={handleSubmit} noValidate className="mt-5 flex flex-1 flex-col">
        <div className="space-y-4">
          <AuthInput
            ref={nameRef}
            id="settings-full-name"
            name="full_name"
            type="text"
            label="Nombre completo"
            autoComplete="name"
            maxLength={150}
            icon={<UserIcon className="h-[18px] w-[18px]" />}
            value={form.fullName}
            disabled={saving}
            error={errors.full_name || ''}
            onChange={(event) => update('fullName', event.target.value)}
          />

          <CurrencySelector
            id="settings-currency"
            name="currency"
            value={form.currency}
            disabled={saving}
            error={errors.currency || ''}
            labelExtra={null}
            hint="Cambia el símbolo con el que se muestran tus montos (S/, $ o €). No convierte los importes que ya registraste."
            onChange={(event) => update('currency', event.target.value)}
          />

          {feedback && (
            <Alert tone={feedback.tone} title={feedback.title}>
              {feedback.message}
            </Alert>
          )}
        </div>

        <div className="mt-auto flex flex-col-reverse gap-2 pt-5 sm:flex-row sm:justify-end">
          {dirty && (
            <button type="button" onClick={discard} disabled={saving} className={buttonStyles.outline}>
              Descartar
            </button>
          )}
          <button type="submit" disabled={!dirty || saving} className={buttonStyles.primary}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </SettingsCard>
  )
}

/** Correo (no editable) + estado de verificación + "Reenviar enlace". */
function EmailStatus() {
  const { user } = useAuth()
  const { resend, sending, feedback } = useResendVerification()
  const verified = Boolean(user?.email_verified)

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="text-[13px] font-semibold text-[#1F2937]">Correo electrónico</p>
        {verified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Verificado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
            Sin verificar
          </span>
        )}
      </div>
      <p className="mt-1.5 break-all text-sm font-semibold text-slate-800">{user?.email}</p>
      <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-slate-500">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Es tu usuario para iniciar sesión, por eso no se puede cambiar.
      </p>

      {!verified && (
        <div className="mt-3 flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-snug text-slate-600">
            Confirma tu correo con el enlace que te enviamos. ¿No lo encuentras? Te enviamos otro.
          </p>
          <button type="button" onClick={resend} disabled={sending} className={`${buttonStyles.outline} shrink-0`}>
            <MailCheck className="h-4 w-4" aria-hidden="true" />
            {sending ? 'Enviando…' : 'Reenviar enlace'}
          </button>
        </div>
      )}

      {feedback && (
        <Alert tone={feedback.tone} title={feedback.title} className="mt-3">
          {feedback.message}
        </Alert>
      )}
    </div>
  )
}
