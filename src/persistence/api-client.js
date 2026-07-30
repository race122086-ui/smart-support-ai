const apiBaseUrl = `${(import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')}/api/v1`

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request(path, options = {}) {
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

async function listAllReports() {
  const reports = []
  let page = 1
  while (true) {
    const result = await request(`/reports?page=${page}&pageSize=100`)
    reports.push(...result.items)
    if (reports.length >= result.total) return reports
    page += 1
  }
}

export const api = {
  async loadState() {
    const [reports, settings, notifications] = await Promise.all([
      listAllReports(),
      request('/settings'),
      request('/notifications'),
    ])
    return { reports, settings, notifications }
  },
  createReport(input) {
    return request('/reports', { method: 'POST', body: JSON.stringify(input) })
  },
  updateReport(id, input) {
    return request(`/reports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
  },
  deleteReport(id) {
    return request(`/reports/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },
  changeStatus(id, status) {
    return request(`/reports/${encodeURIComponent(id)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    })
  },
  assignTechnician(id, technician) {
    return request(`/reports/${encodeURIComponent(id)}/technician`, {
      method: 'PUT',
      body: JSON.stringify({ technician }),
    })
  },
  addComment(id, message) {
    return request(`/reports/${encodeURIComponent(id)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    })
  },
  addTechnician(name) {
    return request('/technicians', { method: 'POST', body: JSON.stringify({ name }) })
  },
  updateSettings(changes) {
    return request('/settings', { method: 'PATCH', body: JSON.stringify(changes) })
  },
  markNotificationsRead() {
    return request('/notifications/read-all', { method: 'POST' })
  },
  exportBackup() {
    return request('/backups/current')
  },
  importBackup(backup) {
    return request('/backups/import', {
      method: 'POST',
      body: JSON.stringify(backup),
    })
  },
}
