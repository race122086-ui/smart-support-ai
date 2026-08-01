export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTicket(ticketNumber) {
  return `#${String(ticketNumber).padStart(4, '0')}`
}

export function formatBytes(value) {
  const bytes = Number(value) || 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function priorityClass(priority) {
  return `badge-priority badge-priority--${priority.toLocaleLowerCase('es-MX')}`
}

export function statusClass(status) {
  if (status === 'Resuelto') return 'badge-status badge-status--resolved'
  if (status === 'En progreso') return 'badge-status badge-status--progress'
  return 'badge-status badge-status--pending'
}

export function downloadJson(data, prefix = 'smartsupport-respaldo') {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}
