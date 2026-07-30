import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TicketsPage } from './TicketsPage.jsx'

const report = {
  id: 'ticket-1',
  ticketNumber: 7,
  userName: '<img src=x onerror=alert(1)>',
  contactEmail: 'ana@example.com',
  contactPhone: '55 1234',
  department: 'Sistemas',
  description: '<script>peligro</script>',
  priority: 'Alta',
  status: 'Pendiente',
  technician: 'Sin asignar',
  createdAt: '2026-07-29T12:00:00.000Z',
  activity: [],
}

function Location() {
  return <output data-testid="location">{useLocation().search}</output>
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/tickets?status=Pendiente&page=2']}>
        <Routes><Route path="/tickets" element={<><TicketsPage /><Location /></>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('TicketsPage', () => {
  it('consulta con la URL, muestra texto no confiable y sincroniza filtros', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('/technicians')) {
        return { ok: true, status: 200, json: async () => [] }
      }
      return { ok: true, status: 200, json: async () => ({ items: [report], total: 15 }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    renderPage()

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(document.querySelector('img')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('status=Pendiente') && String(url).includes('page=2'))).toBe(true)

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'Resuelto')
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('?status=Resuelto'))
  })
})
