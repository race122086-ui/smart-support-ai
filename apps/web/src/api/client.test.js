import { afterEach, describe, expect, it, vi } from 'vitest'
import { request, setCsrfToken } from './client.js'

function response(status, body = {}) {
  return { status, ok: status >= 200 && status < 300, json: async () => body }
}

afterEach(() => {
  setCsrfToken(null)
  vi.restoreAllMocks()
})

describe('cliente CSRF', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('envía X-CSRF-Token en peticiones %s', async (method) => {
    setCsrfToken('token-en-memoria')
    const fetchMock = vi.fn().mockResolvedValue(response(200))
    vi.stubGlobal('fetch', fetchMock)

    await request('/recurso', { method })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][1].headers['X-CSRF-Token']).toBe('token-en-memoria')
    expect(localStorage.getItem('csrfToken')).toBeNull()
  })

  it('renueva el token con auth/me y reintenta una sola vez ante CSRF_INVALID', async () => {
    setCsrfToken('token-anterior')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(403, {
        error: { code: 'CSRF_INVALID', message: 'Token vencido' },
      }))
      .mockResolvedValueOnce(response(200, {
        user: { id: 'admin' }, csrfToken: 'token-renovado',
      }))
      .mockResolvedValueOnce(response(201, { id: 'ticket-1' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(request('/reports', { method: 'POST', body: '{}' }))
      .resolves.toEqual({ id: 'ticket-1' })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0][1].headers['X-CSRF-Token']).toBe('token-anterior')
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/auth\/me$/)
    expect(fetchMock.mock.calls[2][1].headers['X-CSRF-Token']).toBe('token-renovado')
  })
})
