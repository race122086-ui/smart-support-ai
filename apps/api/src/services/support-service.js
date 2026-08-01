import {
  DEFAULT_SETTINGS,
  DEPARTMENTS,
  PRIORITIES,
  ROLES,
  SORT_ORDERS,
  STATUSES,
  sortReportActivity,
  UNASSIGNED_TECHNICIAN,
} from '@smartsupport/contracts'
import { createHash } from 'node:crypto'
import { DomainError, notFound, validationError } from '../errors/domain-error.js'

const priorityWeight = { Alta: 3, Media: 2, Baja: 1 }
const editableFields = [
  'userName',
  'contactEmail',
  'contactPhone',
  'department',
  'description',
  'priority',
]

function normalizedText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isoDate(value, fallback) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return fallback
  return new Date(value).toISOString()
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function deterministicUuid(value) {
  const hex = createHash('sha256').update(value).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

function safeUuid(value, namespace) {
  const normalized = normalizedText(value).toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : deterministicUuid(`${namespace}:${normalized || 'missing'}`)
}

function backupFingerprint(backup) {
  return createHash('sha256').update(JSON.stringify(backup)).digest('hex')
}

export class SupportService {
  constructor(repository, options = {}) {
    this.repository = repository
    this.idFactory = options.idFactory || (() => crypto.randomUUID())
    this.clock = options.clock || (() => new Date())
    this.notificationHub = options.notificationHub || null
  }

  now() {
    return this.clock().toISOString()
  }

  forbidden() {
    throw new DomainError('FORBIDDEN', 'No tienes permiso para realizar esta acción', 403)
  }

  canAccessReport(report, actor) {
    if (actor.role === 'ADMIN') return true
    if (actor.role === 'USER') return report.createdById === actor.id
    return report.technicianId === actor.technicianId
      || report.technician === actor.name
  }

  assertReportAccess(report, actor) {
    if (!this.canAccessReport(report, actor)) this.forbidden()
  }

  activity(message, now = this.now()) {
    return { id: this.idFactory(), message, createdAt: now }
  }

  async notificationRecipients(report, options = {}, repository = this.repository) {
    const recipients = new Set()
    if (options.creator && report.createdById) recipients.add(report.createdById)
    if (options.technician && (report.technicianId || report.technician !== UNASSIGNED_TECHNICIAN)) {
      const technician = (await repository.listTechnicians())
        .find((item) => item.id === report.technicianId || item.name === report.technician)
      if (technician?.userId) recipients.add(technician.userId)
    }
    if (options.admins) {
      for (const user of await repository.listUsers()) {
        if (user.active && user.role === 'ADMIN') recipients.add(user.id)
      }
    }
    if (options.excludeActorId) recipients.delete(options.excludeActorId)
    return [...recipients]
  }

  async notifyRecipients(repository, recipientIds, data, now = this.now()) {
    const notifications = []
    for (const recipientId of new Set(recipientIds)) {
      notifications.push(await repository.saveNotification({
        id: this.idFactory(),
        recipientId,
        reportId: data.reportId || null,
        message: data.message,
        type: data.type || 'info',
        createdAt: now,
        read: false,
      }))
    }
    return notifications
  }

  publishNotifications(notifications) {
    for (const notification of notifications) this.notificationHub?.publish(notification)
  }

  async finishNotificationTransaction(work) {
    const result = await this.repository.transaction(work)
    this.publishNotifications(result.notifications)
    return result.value
  }

  async listReports(filters = {}, actor) {
    const settings = await this.repository.getSettings()
    let items = await this.repository.listReports()
    items = items.filter((report) => this.canAccessReport(report, actor))
    const query = normalizedText(filters.q).toLowerCase()
    if (query) {
      items = items.filter((report) =>
        [
          report.userName,
          report.contactEmail,
          report.contactPhone,
          report.department,
          report.description,
          `INC-${String(report.ticketNumber).padStart(4, '0')}`,
        ].some((value) => String(value).toLowerCase().includes(query))
      )
    }
    for (const field of ['status', 'priority', 'technician']) {
      if (filters[field]) items = items.filter((report) => report[field] === filters[field])
    }
    const order = SORT_ORDERS.includes(filters.sort) ? filters.sort : 'recent'
    items.sort((a, b) => {
      if (order === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
      if (order === 'priority') return priorityWeight[b.priority] - priorityWeight[a.priority]
      if (order === 'deadline') {
        return this.slaDeadline(a, settings.sla) - this.slaDeadline(b, settings.sla)
      }
      return new Date(b.createdAt) - new Date(a.createdAt)
    })
    const total = items.length
    const page = Number(filters.page || 1)
    const pageSize = Number(filters.pageSize || 20)
    const start = (page - 1) * pageSize
    return { items: items.slice(start, start + pageSize), total, page, pageSize }
  }

  async getReport(id, actor) {
    const report = await this.repository.getReport(id)
    if (!report) throw notFound('Reporte')
    this.assertReportAccess(report, actor)
    return report
  }

  async createReport(input, actor) {
    if (actor.role === 'TECHNICIAN') this.forbidden()
    if (actor.role === 'USER') {
      input = { ...input, userName: actor.name, contactEmail: actor.email }
    }
    return this.finishNotificationTransaction(async (repository) => {
      const ticketNumber = await repository.nextTicketNumber()
      const now = this.now()
      const report = {
        id: this.idFactory(),
        ticketNumber,
        ...Object.fromEntries(
          editableFields.map((field) => [
            field,
            typeof input[field] === 'string' ? input[field].trim() : input[field],
          ])
        ),
        status: 'Pendiente',
        createdById: actor.id,
        technician: UNASSIGNED_TECHNICIAN,
        createdAt: now,
        activity: [
          this.activity('Reporte creado', now),
          this.activity('Estado inicial: Pendiente', now),
        ],
      }
      await repository.saveReport(report)
      const recipients = await this.notificationRecipients(report, {
        creator: true,
        admins: true,
      }, repository)
      const notifications = await this.notifyRecipients(repository, recipients, {
        reportId: report.id,
        type: 'ticket_created',
        message: `Se creó el reporte INC-${String(ticketNumber).padStart(4, '0')}`,
      }, now)
      return { value: report, notifications }
    })
  }

  async updateReport(id, changes, actor) {
    if (!['ADMIN', 'USER'].includes(actor.role)) this.forbidden()
    return this.finishNotificationTransaction(async (repository) => {
      const report = await repository.getReport(id)
      if (!report) throw notFound('Reporte')
      this.assertReportAccess(report, actor)
      for (const field of editableFields) {
        if (field in changes) {
          report[field] = typeof changes[field] === 'string'
            ? changes[field].trim()
            : changes[field]
        }
      }
      const now = this.now()
      report.activity.push(this.activity('Reporte actualizado', now))
      await repository.saveReport(report)
      const recipients = await this.notificationRecipients(report, { creator: true }, repository)
      const notifications = await this.notifyRecipients(repository, recipients, {
        reportId: report.id,
        type: 'ticket_updated',
        message: `Se actualizó el reporte INC-${String(report.ticketNumber).padStart(4, '0')}`,
      }, now)
      return { value: report, notifications }
    })
  }

  async deleteReport(id, actor) {
    if (actor.role !== 'ADMIN') this.forbidden()
    const result = await this.repository.transaction(async (repository) => {
      const report = await repository.getReport(id)
      if (!report) throw notFound('Reporte')
      const recipients = await this.notificationRecipients(report, {
        creator: true,
        technician: true,
        admins: true,
      }, repository)
      await repository.removeReport(id)
      return {
        recipients,
        event: {
          id: this.idFactory(),
          reportId: report.id,
          message: `El reporte INC-${String(report.ticketNumber).padStart(4, '0')} fue eliminado`,
          type: 'ticket_deleted',
          createdAt: this.now(),
          read: true,
        },
      }
    })
    for (const recipientId of result.recipients) {
      this.notificationHub?.publish({ ...result.event, recipientId })
    }
  }

  async changeStatus(id, status, actor) {
    if (!['ADMIN', 'TECHNICIAN'].includes(actor.role)) this.forbidden()
    if (!STATUSES.includes(status)) {
      throw new DomainError(
        'INVALID_STATUS_TRANSITION',
        'La transición de estado no está permitida',
        409
      )
    }
    return this.finishNotificationTransaction(async (repository) => {
      const report = await repository.getReport(id)
      if (!report) throw notFound('Reporte')
      this.assertReportAccess(report, actor)
      if (actor.role === 'TECHNICIAN' && report.technician !== actor.name) this.forbidden()
      const now = this.now()
      const previousStatus = report.status
      report.status = status
      report.activity.push(this.activity(`Estado cambiado a ${status}`, now))
      if (status === 'Resuelto' && previousStatus !== 'Resuelto') {
        report.activity.push(this.activity('Reporte cerrado', now))
      }
      await repository.saveReport(report)
      const recipients = await this.notificationRecipients(report, {
        creator: true,
        technician: true,
        admins: true,
        excludeActorId: actor.id,
      }, repository)
      const notifications = await this.notifyRecipients(repository, recipients, {
        reportId: report.id,
        type: 'status_changed',
        message: `El reporte INC-${String(report.ticketNumber).padStart(4, '0')} cambió a ${status}`,
      }, now)
      return { value: report, notifications }
    })
  }

  async assignTechnician(id, technicianName, actor) {
    if (!['ADMIN', 'TECHNICIAN'].includes(actor.role)) this.forbidden()
    return this.finishNotificationTransaction(async (repository) => {
      const report = await repository.getReport(id)
      if (!report) throw notFound('Reporte')
      if (actor.role === 'TECHNICIAN') {
        if (report.technician !== UNASSIGNED_TECHNICIAN || technicianName !== actor.name) this.forbidden()
        technicianName = actor.name
      }
      if (technicianName !== UNASSIGNED_TECHNICIAN) {
        const technicians = await repository.listTechnicians()
        const available = technicians.some(
          (technician) => technician.active && technician.name === technicianName
        )
        if (!available) {
          throw new DomainError(
            'TECHNICIAN_NOT_AVAILABLE',
            'El técnico no está disponible',
            422
          )
        }
      }
      const now = this.now()
      report.technician = technicianName
      report.technicianId = technicianName === UNASSIGNED_TECHNICIAN
        ? null
        : (await repository.listTechnicians()).find((item) => item.name === technicianName)?.id || null
      const message = technicianName === UNASSIGNED_TECHNICIAN
        ? 'Asignación de técnico retirada'
        : `Asignado a ${technicianName}`
      report.activity.push(this.activity(message, now))
      await repository.saveReport(report)
      const recipients = await this.notificationRecipients(report, {
        creator: true,
        technician: true,
        excludeActorId: actor.id,
      }, repository)
      const notifications = await this.notifyRecipients(repository, recipients, {
        reportId: report.id,
        type: 'technician_assigned',
        message: `Se actualizó la asignación del reporte INC-${String(report.ticketNumber).padStart(4, '0')}`,
      }, now)
      return { value: report, notifications }
    })
  }

  async addComment(id, message, actor) {
    return this.finishNotificationTransaction(async (repository) => {
      const report = await repository.getReport(id)
      if (!report) throw notFound('Reporte')
      this.assertReportAccess(report, actor)
      const now = this.now()
      const activity = this.activity(`Comentario: ${message.trim()}`, now)
      report.activity.push(activity)
      await repository.saveReport(report)
      const recipients = await this.notificationRecipients(report, {
        creator: true,
        technician: true,
        admins: true,
        excludeActorId: actor.id,
      }, repository)
      const notifications = await this.notifyRecipients(repository, recipients, {
        reportId: report.id,
        type: 'comment_added',
        message: `Se comentó el reporte INC-${String(report.ticketNumber).padStart(4, '0')}`,
      }, now)
      return { value: activity, notifications }
    })
  }

  async getActivity(id, actor) {
    const report = await this.getReport(id, actor)
    return sortReportActivity(report.activity)
  }

  slaDeadline(report, sla) {
    return new Date(report.createdAt).getTime() + Number(sla[report.priority]) * 3600000
  }

  async getSla(id, actor) {
    const report = await this.getReport(id, actor)
    const settings = await this.repository.getSettings()
    const deadline = this.slaDeadline(report, settings.sla)
    return {
      deadline: new Date(deadline).toISOString(),
      overdue: report.status !== 'Resuelto' && deadline < this.clock().getTime(),
    }
  }

  async getMetrics() {
    const reports = await this.repository.listReports()
    const metrics = reports.reduce(
      (result, report) => {
        result.total += 1
        if (report.status === 'Pendiente') result.pending += 1
        if (report.status === 'En progreso') result.inProgress += 1
        if (report.status === 'Resuelto') result.resolved += 1
        result.priorities[report.priority] += 1
        return result
      },
      {
        total: 0,
        pending: 0,
        inProgress: 0,
        resolved: 0,
        priorities: { Baja: 0, Media: 0, Alta: 0 },
      }
    )
    return {
      ...metrics,
      resolutionRate: metrics.total
        ? Math.round((metrics.resolved / metrics.total) * 100)
        : 0,
    }
  }

  async listTechnicians() {
    const technicians = await this.repository.listTechnicians()
    return technicians.filter((technician) => technician.active)
  }

  async addTechnician(name) {
    const normalizedName = name.trim()
    return this.repository.transaction(async (repository) => {
      const technicians = await repository.listTechnicians()
      if (technicians.some(
        (technician) => technician.name.toLowerCase() === normalizedName.toLowerCase()
      )) {
        throw new DomainError(
          'TECHNICIAN_ALREADY_EXISTS',
          'Ya existe un técnico con ese nombre',
          409
        )
      }
      const technician = { id: this.idFactory(), name: normalizedName, active: true }
      await repository.saveTechnician(technician)
      return technician
    })
  }

  async deleteTechnician(id) {
    return this.repository.transaction(async (repository) => {
      const technicians = await repository.listTechnicians()
      const technician = technicians.find((item) => item.id === id)
      if (!technician) throw notFound('Technician')
      const reports = await repository.listReports()
      if (reports.some((report) => report.technician === technician.name)) {
        throw new DomainError(
          'TECHNICIAN_HAS_REPORTS',
          'El técnico tiene reportes asignados',
          409
        )
      }
      await repository.removeTechnician(id)
    })
  }

  async getSettings() {
    const [settings, technicians] = await Promise.all([
      this.repository.getSettings(),
      this.repository.listTechnicians(),
    ])
    return {
      ...settings,
      technicians: technicians
        .filter((technician) => technician.active)
        .map((technician) => technician.name),
    }
  }

  async updateSettings(changes) {
    return this.repository.transaction(async (repository) => {
      const settings = await repository.getSettings()
      if (changes.profile) settings.profile = { ...settings.profile, ...changes.profile }
      if (changes.sla) settings.sla = { ...settings.sla, ...changes.sla }
      await repository.saveSettings(settings)
      const technicians = await repository.listTechnicians()
      return {
        ...settings,
        technicians: technicians.filter((item) => item.active).map((item) => item.name),
      }
    })
  }

  async listNotifications(actor) {
    return this.repository.listNotifications(actor.id)
  }

  async markNotificationRead(id, actor) {
    const notification = await this.repository.markNotificationRead(id, actor.id, this.now())
    if (!notification) throw notFound('Notificación')
    return notification
  }

  async markNotificationsRead(actor) {
    return this.repository.markNotificationsRead(actor.id, this.now())
  }

  async exportBackup() {
    const snapshot = await this.repository.snapshot()
    return {
      version: 2,
      reports: snapshot.reports,
      settings: {
        ...snapshot.settings,
        technicians: snapshot.technicians
          .filter((technician) => technician.active)
          .map((technician) => technician.name),
      },
      notifications: snapshot.notifications,
    }
  }

  normalizeImportedReport(source, index, now) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw validationError('Un reporte del respaldo no se puede normalizar', [
        { field: `reports[${index}]`, reason: 'Debe ser un objeto' },
      ])
    }
    const ticketNumber = positiveInteger(source.ticketNumber, index + 1)
    const sourceId = normalizedText(source.id) || `reporte-${ticketNumber}`
    const id = safeUuid(source.id, normalizedText(source.id) ? 'report' : `report:${ticketNumber}`)
    const userName = normalizedText(source.userName)
    const description = normalizedText(source.description)
    return {
      id,
      ticketNumber,
      userName: userName || 'Usuario sin nombre',
      contactEmail: normalizedText(source.contactEmail) || 'usuario@empresa.com',
      contactPhone: normalizedText(source.contactPhone) || '+52 55 0000 0001',
      department: DEPARTMENTS.includes(source.department) ? source.department : 'Operaciones',
      description: description || 'Sin descripción',
      priority: PRIORITIES.includes(source.priority) ? source.priority : 'Media',
      status: STATUSES.includes(source.status) ? source.status : 'Pendiente',
      technician: normalizedText(source.technician) || UNASSIGNED_TECHNICIAN,
      createdAt: isoDate(source.createdAt, now),
      activity: Array.isArray(source.activity)
        ? source.activity.map((item, activityIndex) => ({
            id: safeUuid(
              item?.id,
              `activity:${sourceId}:${activityIndex + 1}`
            ),
            message: normalizedText(item?.message),
            createdAt: isoDate(item?.createdAt, now),
          }))
        : [],
    }
  }

  async importBackup(backup) {
    if (!backup || typeof backup !== 'object' || !Array.isArray(backup.reports)) {
      throw new DomainError(
        'INVALID_BACKUP',
        'El respaldo debe contener una lista de reportes',
        400
      )
    }
    if (backup.version !== undefined && ![1, 2].includes(backup.version)) {
      throw new DomainError(
        'UNSUPPORTED_BACKUP_VERSION',
        'La versión del respaldo no es compatible',
        400
      )
    }
    const fingerprint = backupFingerprint(backup)
    const now = this.now()
    const reports = backup.reports.map((report, index) =>
      this.normalizeImportedReport(report, index, now)
    )
    const profile = backup.settings?.profile || DEFAULT_SETTINGS.profile
    const role = ROLES.includes(profile.role) ? profile.role : DEFAULT_SETTINGS.profile.role
    const settings = {
      profile: {
        name: normalizedText(profile.name) || DEFAULT_SETTINGS.profile.name,
        role,
      },
      sla: Object.fromEntries(PRIORITIES.map((priority) => {
        const hours = Number(backup.settings?.sla?.[priority])
        return [
          priority,
          Number.isFinite(hours) && hours >= 1 && hours <= 720
            ? hours
            : DEFAULT_SETTINGS.sla[priority],
        ]
      })),
    }
    const configuredTechnicianNames = Array.isArray(backup.settings?.technicians)
      ? [...new Set(backup.settings.technicians.map(normalizedText).filter(Boolean))]
      : ['Ana Torres', 'Carlos Ruiz', 'Laura Méndez']
    const technicianNames = [...new Map([
      ...configuredTechnicianNames,
      ...reports
        .map((report) => report.technician)
        .filter((name) => name !== UNASSIGNED_TECHNICIAN),
    ].map((name) => [name.toLocaleLowerCase('es-MX'), name])).values()]
    const technicians = technicianNames.map((name) => ({
      id: deterministicUuid(`technician:${name.toLocaleLowerCase('es-MX')}`),
      name,
      active: true,
    }))
    const notifications = Array.isArray(backup.notifications)
      ? backup.notifications.map((item, index) => ({
          id: safeUuid(item?.id, `notification:${index + 1}:${item?.message || ''}`),
          recipientId: null,
          reportId: null,
          message: normalizedText(item?.message),
          type: normalizedText(item?.type) || 'info',
          createdAt: isoDate(item?.createdAt, now),
          read: item?.read === true,
        }))
      : []
    const ids = new Set()
    const tickets = new Set()
    for (const report of reports) {
      if (ids.has(report.id) || tickets.has(report.ticketNumber)) {
        throw new DomainError(
          'REPORT_ALREADY_EXISTS',
          'El respaldo contiene reportes duplicados',
          409
        )
      }
      ids.add(report.id)
      tickets.add(report.ticketNumber)
    }
    const result = {
      reports: reports.length,
      technicians: technicians.length,
      notifications: notifications.length,
      fingerprint,
      duplicate: false,
    }
    return this.repository.transaction(async (repository) => {
      const previous = await repository.getImport(fingerprint)
      if (previous) return { ...previous.result, duplicate: true }
      const existingTechnicians = await repository.listTechnicians()
      for (const technician of technicians) {
        const existing = existingTechnicians.find((item) =>
          item.name.toLocaleLowerCase('es-MX') === technician.name.toLocaleLowerCase('es-MX')
        )
        if (existing?.userId) technician.userId = existing.userId
      }
      await repository.replace({ reports, settings, technicians, notifications })
      await repository.saveImport(fingerprint, result)
      return result
    })
  }
}
