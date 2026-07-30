const apiBaseUrl = `${(import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/v1`

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
  if (response.status === 204) return null
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(
      body?.error?.message || 'No se pudo completar la operación',
      response.status,
      body?.error?.code || 'API_ERROR'
    )
  }
  return body
}

function jsonOptions(method, body) {
  return { method, body: JSON.stringify(body) }
}

export const api = {
  listReports(params = {}) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) query.set(key, value)
    })
    return request(`/reports?${query}`)
  },
  getReport(id) {
    return request(`/reports/${encodeURIComponent(id)}`)
  },
  createReport(input) {
    return request('/reports', jsonOptions('POST', input))
  },
  updateReport(id, input) {
    return request(`/reports/${encodeURIComponent(id)}`, jsonOptions('PATCH', input))
  },
  deleteReport(id) {
    return request(`/reports/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  changeStatus(id, status) {
    return request(`/reports/${encodeURIComponent(id)}/status`, jsonOptions('PUT', { status }))
  },
  assignTechnician(id, technician) {
    return request(
      `/reports/${encodeURIComponent(id)}/technician`,
      jsonOptions('PUT', { technician })
    )
  },
  addComment(id, message) {
    return request(
      `/reports/${encodeURIComponent(id)}/comments`,
      jsonOptions('POST', { message })
    )
  },
  getActivity(id) {
    return request(`/reports/${encodeURIComponent(id)}/activity`)
  },
  getSla(id) {
    return request(`/reports/${encodeURIComponent(id)}/sla`)
  },
  getMetrics() {
    return request('/metrics')
  },
  listTechnicians() {
    return request('/technicians')
  },
  addTechnician(name) {
    return request('/technicians', jsonOptions('POST', { name }))
  },
  deleteTechnician(id) {
    return request(`/technicians/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  getSettings() {
    return request('/settings')
  },
  updateSettings(changes) {
    return request('/settings', jsonOptions('PATCH', changes))
  },
  listNotifications() {
    return request('/notifications')
  },
  markNotificationsRead() {
    return request('/notifications/read-all', { method: 'POST' })
  },
  exportBackup() {
    return request('/backups/current')
  },
  importBackup(backup) {
    return request('/backups/import', jsonOptions('POST', backup))
  },
}
