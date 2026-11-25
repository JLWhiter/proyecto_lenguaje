import { createContext, useCallback, useContext, useRef, useState } from 'react'
import Modal from './Modal'

/**
 * Diálogo de confirmación (reemplaza window.confirm).
 * Uso directo:  <ConfirmDialog title="…" message="…" onConfirm={…} onCancel={…} />
 * Uso con hook: const confirm = useConfirm(); if (await confirm({ title, message, tone: 'danger' })) { … }
 */
export default function ConfirmDialog({
  title = '¿Confirmas esta acción?',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null)
  const confirmClass =
    tone === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'

  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      initialFocusRef={cancelRef}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`h-11 rounded-xl px-5 text-sm font-semibold disabled:cursor-wait disabled:opacity-60 ${confirmClass}`}
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      }
    >
      {message && <p className="text-sm leading-6 text-slate-600">{message}</p>}
    </Modal>
  )
}

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null)

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        setRequest({ ...options, resolve })
      }),
    [],
  )

  function settle(result) {
    request?.resolve(result)
    setRequest(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <ConfirmDialog
          title={request.title}
          message={request.message}
          confirmLabel={request.confirmLabel}
          cancelLabel={request.cancelLabel}
          tone={request.tone}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  )
}

/** `const confirm = useConfirm(); const ok = await confirm({ title, message, confirmLabel, tone })` */
export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) throw new Error('useConfirm debe usarse dentro de ConfirmProvider')
  return context
}
