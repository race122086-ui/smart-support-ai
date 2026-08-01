const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const apiOrigin = configuredApiUrl || (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin)
const apiBaseUrl = `${apiOrigin.replace(/\/$/, '')}/api/v1`
let csrfToken = null

export function setCsrfToken(value) {
  csrfToken = value || null
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function request(path, options = {}) {
  const method = options.method || 'GET'
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(!['GET', 'HEAD'].includes(method) && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...options.headers,
    },
  })
  if (response.status === 204) return null
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      window.dispatchEvent(new Event('smartsupport:session-expired'))
    }
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
  login(input) { return request('/auth/login', jsonOptions('POST', input)) },
  logout() { return request('/auth/logout', { method: 'POST' }) },
  me() { return request('/auth/me') },
  listUsers() { return request('/users') },
  createUser(input) { return request('/users', jsonOptions('POST', input)) },
  updateUser(id, changes) { return request(`/users/${encodeURIComponent(id)}`, jsonOptions('PATCH', changes)) },
  listReports(params = {}) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) query.set(key, value)
    })
    return request(`/reports?${query}`)
  },
  getReport(id) { return request(`/reports/${encodeURIComponent(id)}`) },
  createReport(input) { return request('/reports', jsonOptions('POST', input)) },
  updateReport(id, input) { return request(`/reports/${encodeURIComponent(id)}`, jsonOptions('PATCH', input)) },
  deleteReport(id) { return request(`/reports/${encodeURIComponent(id)}`, { method: 'DELETE' }) },
  changeStatus(id, status) { return request(`/reports/${encodeURIComponent(id)}/status`, jsonOptions('PUT', { status })) },
  assignTechnician(id, technician) { return request(`/reports/${encodeURIComponent(id)}/technician`, jsonOptions('PUT', { technician })) },
  addComment(id, message) { return request(`/reports/${encodeURIComponent(id)}/comments`, jsonOptions('POST', { message })) },
  getActivity(id) { return request(`/reports/${encodeURIComponent(id)}/activity`) },
  getSla(id) { return request(`/reports/${encodeURIComponent(id)}/sla`) },
  getMetrics() { return request('/metrics') },
  listTechnicians() { return request('/technicians') },
  addTechnician(name) { return request('/technicians', jsonOptions('POST', { name })) },
  deleteTechnician(id) { return request(`/technicians/${encodeURIComponent(id)}`, { method: 'DELETE' }) },
  getSettings() { return request('/settings') },
  updateSettings(changes) { return request('/settings', jsonOptions('PATCH', changes)) },
  listNotifications() { return request('/notifications') },
  markNotificationsRead() { return request('/notifications/read-all', { method: 'POST' }) },
  exportBackup() { return request('/backups/current') },
  importBackup(backup) { return request('/backups/import', jsonOptions('POST', backup)) },
}
