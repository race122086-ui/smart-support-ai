import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { applyTicketDeleted, invalidateTicketEvent } from './ticket-sync.js'

describe('sincronización de tickets eliminados', () => {
  it('retira inmediatamente el ticket de todos los listados en caché', async () => {
    const client = new QueryClient()
    client.setQueryData(['reports', { status: 'Pendiente' }], {
      items: [{ id: 'eliminado' }, { id: 'vigente' }], total: 2,
    })
    client.setQueryData(['reports', { technician: 'Técnico' }], {
      items: [{ id: 'eliminado' }], total: 1,
    })
    client.setQueryData(['report', 'eliminado'], { id: 'eliminado' })
    const listener = vi.fn()
    window.addEventListener('smartsupport:ticket-deleted', listener, { once: true })

    await applyTicketDeleted(client, 'eliminado')

    expect(client.getQueryData(['reports', { status: 'Pendiente' }])).toEqual({
      items: [{ id: 'vigente' }], total: 1,
    })
    expect(client.getQueryData(['reports', { technician: 'Técnico' }])).toEqual({
      items: [], total: 0,
    })
    expect(client.getQueryData(['report', 'eliminado'])).toBeUndefined()
    expect(listener).toHaveBeenCalledOnce()
  })

  it('invalida historial y detalle cuando llega un comentario por SSE', async () => {
    const client = { invalidateQueries: vi.fn().mockResolvedValue(undefined) }

    await invalidateTicketEvent(client, {
      type: 'comment_added', reportId: 'ticket-comentado',
    })

    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['activity', 'ticket-comentado'],
    })
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['report', 'ticket-comentado'],
    })
  })
})
