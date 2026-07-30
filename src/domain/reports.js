import {
  DEPARTMENTS,
  PRIORITIES,
  STATUSES,
  UNASSIGNED_TECHNICIAN,
} from './constants.js'

const priorityWeight = { Alta: 3, Media: 2, Baja: 1 }

function asText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function asIsoDate(value, fallback) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return fallback
  return new Date(value).toISOString()
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export function createContactEmail(userName = '') {
  const localPart = asText(userName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')

  return `${localPart || 'usuario'}@empresa.com`
}

export function createContactPhone(ticketNumber) {
  return `+52 55 0000 ${String(positiveInteger(ticketNumber, 1)).padStart(4, '0')}`
}

export function suggestDepartment(description = '') {
  const text = asText(description).toLowerCase()
  if (text.includes('contabil')) return 'Contabilidad'
  if (text.includes('factur')) return 'Finanzas'
  if (text.includes('inventario')) return 'Almacén'
  if (text.includes('internet') || text.includes('red') || text.includes('fibra') || text.includes('roseta')) return 'Infraestructura'
  if (text.includes('impresora') || text.includes('tóner')) return 'Administración'
  if (text.includes('correo')) return 'Comercial'
  if (text.includes('acceso') || text.includes('contraseña')) return 'Sistemas'
  return 'Operaciones'
}

export function createActivity(message, options = {}) {
  const now = options.now || new Date().toISOString()
  const idFactory = options.idFactory || (() => crypto.randomUUID())

  return {
    id: idFactory(),
    message: asText(message).trim(),
    createdAt: asIsoDate(now, new Date().toISOString()),
  }
}

export function normalizeActivity(activity, index, reportId, now) {
  const fallbackDate = asIsoDate(now, new Date().toISOString())
  return {
    id: asText(activity?.id, `${reportId}-actividad-${index + 1}`),
    message: asText(activity?.message),
    createdAt: asIsoDate(activity?.createdAt, fallbackDate),
  }
}

export function normalizeReport(report, index = 0, options = {}) {
  const source = report && typeof report === 'object' ? report : {}
  const ticketNumber = positiveInteger(source.ticketNumber, index + 1)
  const now = options.now || new Date().toISOString()
  const id = asText(source.id, `reporte-${ticketNumber}`)
  const userName = asText(source.userName)
  const description = asText(source.description)
  const priority = PRIORITIES.includes(source.priority) ? source.priority : 'Media'
  const status = Object.values(STATUSES).includes(source.status)
    ? source.status
    : STATUSES.PENDING

  return {
    ...source,
    id,
    ticketNumber,
    userName,
    contactEmail: asText(source.contactEmail) || createContactEmail(userName),
    contactPhone: asText(source.contactPhone) || createContactPhone(ticketNumber),
    department: DEPARTMENTS.includes(source.department)
      ? source.department
      : suggestDepartment(description),
    description,
    priority,
    status,
    technician: asText(source.technician) || UNASSIGNED_TECHNICIAN,
    createdAt: asIsoDate(source.createdAt, asIsoDate(now, new Date().toISOString())),
    activity: Array.isArray(source.activity)
      ? source.activity.map((item, activityIndex) =>
          normalizeActivity(item, activityIndex, id, now)
        )
      : [],
  }
}

export function normalizeReports(value, options = {}) {
  if (!Array.isArray(value)) return []
  return value.map((report, index) => normalizeReport(report, index, options))
}

export function nextTicketNumber(reports) {
  return reports.reduce(
    (highest, report) => Math.max(highest, positiveInteger(report.ticketNumber, 0)),
    0
  ) + 1
}

export function createReport(input, existingReports = [], options = {}) {
  const idFactory = options.idFactory || (() => crypto.randomUUID())
  const now = options.now || new Date().toISOString()
  const ticketNumber = nextTicketNumber(existingReports)

  return normalizeReport(
    {
      id: idFactory(),
      ticketNumber,
      userName: asText(input?.userName).trim(),
      contactEmail: asText(input?.contactEmail).trim(),
      contactPhone: asText(input?.contactPhone).trim(),
      department: input?.department,
      description: asText(input?.description).trim(),
      priority: input?.priority,
      status: STATUSES.PENDING,
      technician: UNASSIGNED_TECHNICIAN,
      createdAt: now,
      activity: [createActivity('Reporte creado', { idFactory, now })],
    },
    ticketNumber - 1,
    { now }
  )
}

export function canTransitionStatus(from, to) {
  return Object.values(STATUSES).includes(from) && Object.values(STATUSES).includes(to)
}

export function filterReports(reports, filters = {}) {
  const query = asText(filters.query).toLowerCase().trim()

  return reports.filter((report) => {
    const searchable = [
      report.userName,
      report.contactEmail,
      report.contactPhone,
      report.department,
      report.description,
      formatTicket(report.ticketNumber),
    ].map((value) => asText(value).toLowerCase())

    return (
      searchable.some((value) => value.includes(query)) &&
      (!filters.status || filters.status === 'Todos' || report.status === filters.status) &&
      (!filters.priority || filters.priority === 'Todas' || report.priority === filters.priority) &&
      (!filters.technician || filters.technician === 'Todos' || report.technician === filters.technician)
    )
  })
}

export function getSlaDeadline(report, sla) {
  const hours = Number(sla?.[report.priority])
  return new Date(new Date(report.createdAt).getTime() + hours * 60 * 60 * 1000)
}

export function isSlaOverdue(report, sla, now = Date.now()) {
  return report.status !== STATUSES.RESOLVED && getSlaDeadline(report, sla).getTime() < new Date(now).getTime()
}

export function sortReports(reports, order = 'recent', sla = {}) {
  return [...reports].sort((a, b) => {
    if (order === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
    if (order === 'priority') return priorityWeight[b.priority] - priorityWeight[a.priority]
    if (order === 'deadline') return getSlaDeadline(a, sla) - getSlaDeadline(b, sla)
    return new Date(b.createdAt) - new Date(a.createdAt)
  })
}

export function calculateStats(reports) {
  return reports.reduce(
    (stats, report) => {
      stats.total += 1
      if (report.status === STATUSES.PENDING) stats.pending += 1
      if (report.status === STATUSES.IN_PROGRESS) stats.inProgress += 1
      if (report.status === STATUSES.RESOLVED) stats.resolved += 1
      return stats
    },
    { total: 0, pending: 0, inProgress: 0, resolved: 0 }
  )
}

export function calculateMetrics(reports) {
  const stats = calculateStats(reports)
  return {
    ...stats,
    resolutionRate: stats.total ? Math.round((stats.resolved / stats.total) * 100) : 0,
    priorities: Object.fromEntries(
      PRIORITIES.map((priority) => [
        priority,
        reports.filter((report) => report.priority === priority).length,
      ])
    ),
  }
}

export function formatTicket(number) {
  return `INC-${String(number).padStart(4, '0')}`
}
