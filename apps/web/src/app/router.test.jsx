import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const session = vi.hoisted(() => ({ current: { status: 'loading', user: null } }))
vi.mock('./session.jsx', () => ({ useSession: () => session.current }))

import { RolePage } from './router.jsx'

function CurrentPath() {
  return <output aria-label="ruta actual">{useLocation().pathname}</output>
}

function RouteHarness({ path }) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <CurrentPath />
      <Routes>
        <Route path="/" element={<p>Dashboard autorizado</p>} />
        <Route path="/login" element={<p>Inicio de sesión</p>} />
        <Route path="/users" element={<RolePage roles={['ADMIN']}><p>Usuarios administrativos</p></RolePage>} />
        <Route path="/technicians" element={<RolePage roles={['ADMIN']}><p>Técnicos administrativos</p></RolePage>} />
        <Route path="/settings" element={<RolePage roles={['ADMIN']}><p>Configuración administrativa</p></RolePage>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  session.current = { status: 'loading', user: null }
})

async function restoreAt(path, role) {
  const view = render(<RouteHarness path={path} />)
  expect(screen.getByText('Comprobando sesión…')).toBeInTheDocument()
  expect(screen.getByLabelText('ruta actual')).toHaveTextContent(path)
  expect(screen.queryByText('Dashboard autorizado')).not.toBeInTheDocument()

  session.current = { status: 'authenticated', user: { id: role.toLowerCase(), role } }
  view.rerender(<RouteHarness path={path} />)
  return view
}

describe('protección durante la restauración de sesión', () => {
  it('mantiene a ADMIN en /users después de restaurar', async () => {
    await restoreAt('/users', 'ADMIN')
    expect(screen.getByText('Usuarios administrativos')).toBeInTheDocument()
    expect(screen.getByLabelText('ruta actual')).toHaveTextContent('/users')
  })

  it('mantiene a ADMIN en /technicians después de restaurar', async () => {
    await restoreAt('/technicians', 'ADMIN')
    expect(screen.getByText('Técnicos administrativos')).toBeInTheDocument()
    expect(screen.getByLabelText('ruta actual')).toHaveTextContent('/technicians')
  })

  it('redirige a TECHNICIAN fuera de /users solo después de restaurar', async () => {
    await restoreAt('/users', 'TECHNICIAN')
    await waitFor(() => expect(screen.getByLabelText('ruta actual')).toHaveTextContent('/'))
    expect(screen.getByText('Dashboard autorizado')).toBeInTheDocument()
  })

  it('redirige a USER fuera de /settings solo después de restaurar', async () => {
    await restoreAt('/settings', 'USER')
    await waitFor(() => expect(screen.getByLabelText('ruta actual')).toHaveTextContent('/'))
    expect(screen.getByText('Dashboard autorizado')).toBeInTheDocument()
  })
})
