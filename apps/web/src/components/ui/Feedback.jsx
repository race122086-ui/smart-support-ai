import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type, key: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      {toast && (
        <div className={`toast toast--visible ${toast.type === 'error' ? 'toast--danger' : ''}`} role="status">
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

export function LoadingState({ message = 'Cargando datos…' }) {
  return <section className="connection-state" aria-live="polite"><h2>{message}</h2><p>Conectando con SmartSupport API.</p></section>
}

export function ErrorState({ error, onRetry }) {
  return (
    <section className="connection-state connection-state--error" role="alert">
      <h2>No se pudieron cargar los datos</h2>
      <p>{error?.message || 'Ocurrió un error inesperado'}</p>
      {onRetry && <button className="btn btn--primary" type="button" onClick={onRetry}>Reintentar</button>}
    </section>
  )
}

export function EmptyState({ title, description }) {
  return <div className="empty-state"><p>{title}</p><span>{description}</span></div>
}

export function ConfirmDialog({ title, children, confirmLabel = 'Eliminar', onConfirm, onClose }) {
  const cancelRef = useRef(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="confirm-modal__icon" aria-hidden="true">!</div>
        <h2 id="confirm-title">{title}</h2>
        <p>{children}</p>
        <div className="report-card__actions">
          <button ref={cancelRef} type="button" className="btn btn--secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="btn btn--danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
