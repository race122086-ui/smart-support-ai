import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TicketDetailPage } from './TicketDetailPage.jsx'

const report = {
  id: 'ticket-1',
  ticketNumber: 7,
  userName: 'Ana',
  contactEmail: 'ana@example.com',
  contactPhone: '55 1234',
  department: 'Sistemas',
  description: 'Sin red en la oficina',
  priority: 'Alta',
  status: 'Pendiente',
  technician: 'Sin asignar',
  createdAt: '2026-07-29T12:00:00.000Z',
  createdById: 'u1',
  activity: [],
}

vi.mock('../../../app/session.jsx', () => ({
  useSession: () => ({ user: { id: 'u1', name: 'Ana', role: 'USER' } }),
}))

vi.mock('../../../components/ui/Feedback.jsx', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useToast: () => vi.fn() }
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/tickets/ticket-1']}>
        <Routes><Route path="/tickets/:id" element={<TicketDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', async (url) => {
    const path = String(url)
    const json = path.endsWith('/activity') || path.endsWith('/attachments') ? [] : report
    return { ok: true, status: 200, json: async () => json }
  })
})

describe('TicketDetailPage', () => {
  it('muestra la sección de adjuntos en el detalle del ticket', async () => {
    renderPage()
    expect(await screen.findByText('Adjuntos')).toBeInTheDocument()
    expect(await screen.findByText(/no tiene archivos adjuntos/)).toBeInTheDocument()
  })
})
