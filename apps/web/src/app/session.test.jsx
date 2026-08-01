import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { api, setCsrfToken } from '../api/client.js'
import { SessionProvider, useSession } from './session.jsx'

function SessionState() {
  const session = useSession()
  return <span>{session.status === 'loading' ? 'cargando' : `${session.user?.name || 'sin sesión'}:${session.user?.role || 'sin rol'}`}</span>
}

afterEach(() => {
  setCsrfToken(null)
  vi.restoreAllMocks()
  localStorage.clear()
})

it('comparte la restauración de sesión bajo StrictMode y conserva CSRF solo en memoria', async () => {
  let resolveSession
  const pending = new Promise((resolve) => { resolveSession = resolve })
  const me = vi.spyOn(api, 'me').mockReturnValue(pending)

  render(<StrictMode><SessionProvider><SessionState /></SessionProvider></StrictMode>)
  resolveSession({ user: { id: 'admin', name: 'Administración', role: 'ADMIN' }, csrfToken: 'restaurado' })

  await waitFor(() => expect(screen.getByText('Administración:ADMIN')).toBeInTheDocument())
  expect(me).toHaveBeenCalledOnce()
  expect(screen.getByText('Administración:ADMIN')).toBeInTheDocument()
  expect(localStorage.length).toBe(0)
})
