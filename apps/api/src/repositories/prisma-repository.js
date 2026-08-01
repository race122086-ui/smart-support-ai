import { PrismaClient } from '@prisma/client'
import { DEFAULT_SETTINGS, PRIORITIES, UNASSIGNED_TECHNICIAN } from '@smartsupport/contracts'

const defaultTechnicians = ['Ana Torres', 'Carlos Ruiz', 'Laura Méndez']

function normalizeName(name) {
  return name.normalize('NFKC').trim().toLocaleLowerCase('es-MX')
}

function mapActivity(activity) {
  return {
    id: activity.id,
    message: activity.message,
    createdAt: activity.createdAt.toISOString(),
  }
}

function mapReport(report) {
  return {
    id: report.id,
    ticketNumber: report.ticketNumber,
    userName: report.userName,
    contactEmail: report.contactEmail,
    contactPhone: report.contactPhone,
    department: report.department,
    description: report.description,
    priority: report.priority,
    status: report.status,
    technician: report.technician?.name || UNASSIGNED_TECHNICIAN,
    technicianId: report.technicianId || null,
    createdById: report.createdById || null,
    createdAt: report.createdAt.toISOString(),
    activity: (report.activities || []).map(mapActivity),
  }
}

function mapNotification(notification) {
  return {
    id: notification.id,
    recipientId: notification.recipientId,
    reportId: notification.reportId,
    message: notification.message,
    type: notification.type,
    createdAt: notification.createdAt.toISOString(),
    read: notification.readAt !== null,
  }
}

function mapAttachment(attachment) {
  return {
    id: attachment.id,
    reportId: attachment.reportId,
    fileName: attachment.fileName,
    storedName: attachment.storedName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    storageKey: attachment.storageKey,
    uploadedBy: attachment.uploadedBy?.name || null,
    uploadedById: attachment.uploadedById || null,
    createdAt: attachment.createdAt.toISOString(),
  }
}

const attachmentInclude = { uploadedBy: { select: { name: true } } }

const reportInclude = {
  technician: true,
  activities: { orderBy: { createdAt: 'desc' } },
}

export class PrismaRepository {
  constructor(client, options = {}) {
    this.client = client || new PrismaClient(
      options.datasourceUrl ? { datasourceUrl: options.datasourceUrl } : undefined
    )
    this.ownsClient = options.ownsClient ?? true
  }

  async connect() {
    await this.client.$connect()
    await this.client.$queryRaw`SELECT 1`
    await this.ensureDefaults()
  }

  async disconnect() {
    if (this.ownsClient) await this.client.$disconnect()
  }

  async health() {
    await this.client.$queryRaw`SELECT 1`
    return true
  }

  async ensureDefaults() {
    await this.client.profile.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, ...DEFAULT_SETTINGS.profile },
    })
    for (const priority of PRIORITIES) {
      await this.client.slaSetting.upsert({
        where: { priority },
        update: {},
        create: { priority, hours: DEFAULT_SETTINGS.sla[priority] },
      })
    }
    await this.client.counter.upsert({
      where: { name: 'report-ticket' },
      update: {},
      create: { name: 'report-ticket', value: 0 },
    })
    if (await this.client.technician.count() === 0) {
      await this.client.technician.createMany({
        data: defaultTechnicians.map((name) => ({
          name,
          normalizedName: normalizeName(name),
        })),
        skipDuplicates: true,
      })
    }
  }

  async transaction(work) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.client.$transaction(
          (transaction) => work(new PrismaRepository(transaction, { ownsClient: false })),
          { isolationLevel: 'Serializable' }
        )
      } catch (error) {
        if (error.code !== 'P2034' || attempt === 3) throw error
      }
    }
  }

  async nextTicketNumber() {
    const counter = await this.client.counter.upsert({
      where: { name: 'report-ticket' },
      update: { value: { increment: 1 } },
      create: { name: 'report-ticket', value: 1 },
    })
    return counter.value
  }

  async snapshot() {
    const [reports, settings, technicians, notifications] = await Promise.all([
      this.listReports(),
      this.getSettings(),
      this.listTechnicians(),
      this.listAllNotifications(),
    ])
    return { reports, settings, technicians, notifications }
  }

  async replace(snapshot) {
    await this.client.reportActivity.deleteMany()
    await this.client.ticketAttachment.deleteMany()
    await this.client.report.deleteMany()
    await this.client.notification.deleteMany()
    await this.client.technician.deleteMany()

    for (const technician of snapshot.technicians) {
      await this.saveTechnician(technician)
    }
    for (const report of snapshot.reports) {
      await this.saveReport(report)
    }
    for (const notification of [...snapshot.notifications].reverse()) {
      await this.saveNotification(notification)
    }
    await this.saveSettings(snapshot.settings)
    const highestTicket = snapshot.reports.reduce(
      (highest, report) => Math.max(highest, report.ticketNumber),
      0
    )
    await this.client.counter.upsert({
      where: { name: 'report-ticket' },
      update: { value: highestTicket },
      create: { name: 'report-ticket', value: highestTicket },
    })
  }

  async listReports() {
    const reports = await this.client.report.findMany({ include: reportInclude })
    return reports.map(mapReport)
  }

  async getReport(id) {
    const report = await this.client.report.findUnique({
      where: { id },
      include: reportInclude,
    })
    return report ? mapReport(report) : null
  }

  async saveReport(report) {
    const technician = report.technician === UNASSIGNED_TECHNICIAN
      ? null
      : await this.client.technician.findUnique({
          where: { normalizedName: normalizeName(report.technician) },
        })
    const data = {
      ticketNumber: report.ticketNumber,
      userName: report.userName,
      contactEmail: report.contactEmail,
      contactPhone: report.contactPhone,
      department: report.department,
      description: report.description,
      priority: report.priority,
      status: report.status,
      technicianId: technician?.id || null,
      createdById: report.createdById || null,
      createdAt: new Date(report.createdAt),
    }
    await this.client.report.upsert({
      where: { id: report.id },
      update: data,
      create: { id: report.id, ...data },
    })
    for (const activity of report.activity) {
      await this.client.reportActivity.upsert({
        where: { id: activity.id },
        update: {
          message: activity.message,
          createdAt: new Date(activity.createdAt),
        },
        create: {
          id: activity.id,
          reportId: report.id,
          message: activity.message,
          createdAt: new Date(activity.createdAt),
        },
      })
    }
    return this.getReport(report.id)
  }

  async removeReport(id) {
    const result = await this.client.report.deleteMany({ where: { id } })
    return result.count > 0
  }

  async listAttachments(reportId) {
    const rows = await this.client.ticketAttachment.findMany({
      where: { reportId },
      include: attachmentInclude,
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(mapAttachment)
  }

  async getAttachment(id) {
    const row = await this.client.ticketAttachment.findUnique({
      where: { id },
      include: attachmentInclude,
    })
    return row ? mapAttachment(row) : null
  }

  async saveAttachment(attachment) {
    await this.client.ticketAttachment.upsert({
      where: { id: attachment.id },
      update: {
        fileName: attachment.fileName,
        storedName: attachment.storedName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        storageKey: attachment.storageKey,
        uploadedById: attachment.uploadedById || null,
      },
      create: {
        id: attachment.id,
        reportId: attachment.reportId,
        fileName: attachment.fileName,
        storedName: attachment.storedName,
        mimeType: attachment.mimeType,
        size: attachment.size,
        storageKey: attachment.storageKey,
        uploadedById: attachment.uploadedById || null,
        createdAt: new Date(attachment.createdAt),
      },
    })
    return this.getAttachment(attachment.id)
  }

  async removeAttachment(id) {
    const result = await this.client.ticketAttachment.deleteMany({ where: { id } })
    return result.count > 0
  }

  async getSettings() {
    const [profile, slaRows] = await Promise.all([
      this.client.profile.findUnique({ where: { id: 1 } }),
      this.client.slaSetting.findMany(),
    ])
    return {
      profile: profile
        ? { name: profile.name, role: profile.role }
        : { ...DEFAULT_SETTINGS.profile },
      sla: {
        ...DEFAULT_SETTINGS.sla,
        ...Object.fromEntries(slaRows.map((row) => [row.priority, row.hours])),
      },
    }
  }

  async saveSettings(settings) {
    await this.client.profile.upsert({
      where: { id: 1 },
      update: settings.profile,
      create: { id: 1, ...settings.profile },
    })
    for (const priority of PRIORITIES) {
      await this.client.slaSetting.upsert({
        where: { priority },
        update: { hours: settings.sla[priority] },
        create: { priority, hours: settings.sla[priority] },
      })
    }
    return this.getSettings()
  }

  async listTechnicians() {
    return this.client.technician.findMany({
      select: { id: true, name: true, active: true, userId: true },
      orderBy: { name: 'asc' },
    })
  }

  async saveTechnician(technician) {
    return this.client.technician.upsert({
      where: { normalizedName: normalizeName(technician.name) },
      update: { name: technician.name, active: technician.active, userId: technician.userId || null },
      create: {
        id: technician.id,
        name: technician.name,
        normalizedName: normalizeName(technician.name),
        active: technician.active,
        userId: technician.userId || null,
      },
      select: { id: true, name: true, active: true, userId: true },
    })
  }

  async removeTechnician(id) {
    const result = await this.client.technician.deleteMany({ where: { id } })
    return result.count > 0
  }

  async listAllNotifications() {
    const notifications = await this.client.notification.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return notifications.map(mapNotification)
  }

  async listNotifications(recipientId) {
    const notifications = await this.client.notification.findMany({
      where: { recipientId },
      orderBy: { createdAt: 'desc' },
    })
    return notifications.map(mapNotification)
  }

  async saveNotification(notification) {
    const saved = await this.client.notification.upsert({
      where: { id: notification.id },
      update: {
        recipientId: notification.recipientId || null,
        reportId: notification.reportId || null,
        message: notification.message,
        type: notification.type || 'info',
        readAt: notification.read ? new Date(notification.createdAt) : null,
      },
      create: {
        id: notification.id,
        recipientId: notification.recipientId || null,
        reportId: notification.reportId || null,
        message: notification.message,
        type: notification.type || 'info',
        createdAt: new Date(notification.createdAt),
        readAt: notification.read ? new Date(notification.createdAt) : null,
      },
    })
    return mapNotification(saved)
  }

  async getNotification(id) {
    const notification = await this.client.notification.findUnique({ where: { id } })
    return notification ? mapNotification(notification) : null
  }

  async markNotificationRead(id, recipientId, readAt) {
    const result = await this.client.notification.updateMany({
      where: { id, recipientId },
      data: { readAt: new Date(readAt) },
    })
    return result.count ? this.getNotification(id) : null
  }

  async markNotificationsRead(recipientId, readAt) {
    await this.client.notification.updateMany({
      where: { recipientId, readAt: null },
      data: { readAt: new Date(readAt) },
    })
    return this.listNotifications(recipientId)
  }

  async replaceNotifications(notifications) {
    const readIds = notifications.filter((item) => item.read).map((item) => item.id)
    if (readIds.length) {
      await this.client.notification.updateMany({
        where: { id: { in: readIds } },
        data: { readAt: new Date() },
      })
    }
    return this.listAllNotifications()
  }

  async listUsers() {
    return this.client.user.findMany({ orderBy: { name: 'asc' } })
  }

  async getUser(id) {
    return this.client.user.findUnique({ where: { id } })
  }

  async getUserByEmail(email) {
    return this.client.user.findUnique({ where: { email } })
  }

  async saveUser(user) {
    const data = {
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role,
      active: user.active,
    }
    return this.client.user.upsert({
      where: { id: user.id },
      update: data,
      create: { id: user.id, ...data },
    })
  }

  async saveSession(session) {
    return this.client.session.create({ data: {
      id: session.id,
      tokenHash: session.tokenHash,
      csrfHash: session.csrfHash,
      userId: session.userId,
      expiresAt: new Date(session.expiresAt),
    } })
  }

  async getSessionByTokenHash(tokenHash) {
    return this.client.session.findUnique({ where: { tokenHash }, include: { user: true } })
  }

  async updateSessionCsrf(tokenHash, csrfHash) {
    await this.client.session.update({ where: { tokenHash }, data: { csrfHash } })
  }

  async removeSessionByTokenHash(tokenHash) {
    await this.client.session.deleteMany({ where: { tokenHash } })
  }

  async removeUserSessions(userId) {
    await this.client.session.deleteMany({ where: { userId } })
  }

  async removeExpiredSessions(now) {
    await this.client.session.deleteMany({ where: { expiresAt: { lte: now } } })
  }

  async getImport(fingerprint) {
    return this.client.backupImport.findUnique({ where: { fingerprint } })
  }

  async saveImport(fingerprint, result) {
    await this.client.backupImport.create({ data: { fingerprint, result } })
  }
}
