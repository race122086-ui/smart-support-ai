import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '../../app/session.jsx'
import { LoadingState } from '../../components/ui/Feedback.jsx'

export function LoginPage() {
  const session = useSession()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (session.status === 'loading') return <main className="connection-state"><LoadingState message="Comprobando sesión…" /></main>
  if (session.status === 'authenticated' && session.user) return <Navigate to={location.state?.from || '/'} replace />

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await session.login(form)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="brand__icon" aria-hidden="true">⚡</div>
        <h1 id="login-title">Iniciar sesión</h1>
        <p>Accede al portal de soporte con tu cuenta.</p>
        <form onSubmit={submit}>
          <label htmlFor="login-email">Correo</label>
          <input id="login-email" type="email" autoComplete="username" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <label htmlFor="login-password">Contraseña</label>
          <input id="login-password" type="password" autoComplete="current-password" required minLength="12" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="btn btn--primary" type="submit" disabled={submitting}>
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  )
}
