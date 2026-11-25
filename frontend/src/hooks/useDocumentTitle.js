import { useEffect } from 'react'

/** Título de la pestaña: `useDocumentTitle('Movimientos')` → 'Movimientos · Finova'. */
export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · Finova` : 'Finova'
    return () => {
      document.title = previous
    }
  }, [title])
}
