import { DEFAULT_SETTINGS } from '@smartsupport/contracts'

const defaultTechnicians = [
  { id: 'tecnico-ana-torres', name: 'Ana Torres', active: true },
  { id: 'tecnico-carlos-ruiz', name: 'Carlos Ruiz', active: true },
  { id: 'tecnico-laura-mendez', name: 'Laura Méndez', active: true },
]

function clone(value) {
  return structuredClone(value)
}

function normalizeNotification(notification) {
  return {
    ...notification,
    recipientId: notification.recipientId || null,
    reportId: notification.reportId || null,
    type: notification.type || 'info',
    read: notification.read === true,
  }
}

export class MemoryRepository {
  constructor(initialState = {}) {
    this.state = {
      reports: clone(initialState.reports || []),
      settings: clone(initialState.settings || DEFAULT_SETTINGS),
      technicians: clone(initialState.technicians || defaultTechnicians),
      notifications: clone(initialState.notifications || []).map(normalizeNotification),
      users: clone(initialState.users || []),
      sessions: clone(initialState.sessions || []),
    }
    this.imports = new Map()
  }

  async transaction(work) {
    const state = clone(this.state)
    const imports = new Map(this.imports)
    try {
      return await work(this)
    } catch (error) {
      this.state = state
      this.imports = imports
      throw error
    }
  }

  async nextTicketNumber() {
    return this.state.reports.reduce(
      (highest, report) => Math.max(highest, Number(report.ticketNumber) || 0),
      0
    ) + 1
  }

  async health() {
    return true
  }

  async snapshot() {
    return clone(this.state)
  }

  async replace(snapshot) {
    this.state = {
      ...clone(snapshot),
      users: clone(snapshot.users || this.state.users),
      sessions: clone(snapshot.sessions || this.state.sessions),
      notifications: clone(snapshot.notifications || []).map(normalizeNotification),
    }
  }

  async listReports() {
    return clone(this.state.reports)
  }

  async getReport(id) {
    return clone(this.state.reports.find((report) => report.id === id) || null)
  }

  async saveReport(report) {
    const index = this.state.reports.findIndex((item) => item.id === report.id)
    if (index === -1) this.state.reports.push(clone(report))
    else this.state.reports[index] = clone(report)
    return clone(report)
  }

  async removeReport(id) {
    const index = this.state.reports.findIndex((report) => report.id === id)
    if (index === -1) return false
    this.state.reports.splice(index, 1)
    return true
  }

  async getSettings() {
    return clone(this.state.settings)
  }

  async saveSettings(settings) {
    this.state.settings = clone(settings)
    return clone(settings)
  }

  async listTechnicians() {
    return clone(this.state.technicians)
  }

  async saveTechnician(technician) {
    const index = this.state.technicians.findIndex((item) => item.id === technician.id)
    if (index === -1) this.state.technicians.push(clone(technician))
    else this.state.technicians[index] = clone(technician)
    return clone(technician)
  }

  async removeTechnician(id) {
    const index = this.state.technicians.findIndex((item) => item.id === id)
    if (index === -1) return false
    this.state.technicians.splice(index, 1)
    return true
  }

  async listNotifications(recipientId) {
    return clone(this.state.notifications.filter((item) => item.recipientId === recipientId))
  }

  async saveNotification(notification) {
    this.state.notifications.unshift(clone(notification))
    return clone(notification)
  }

  async getNotification(id) {
    return clone(this.state.notifications.find((item) => item.id === id) || null)
  }

  async markNotificationRead(id, recipientId, readAt) {
    const notification = this.state.notifications.find(
      (item) => item.id === id && item.recipientId === recipientId
    )
    if (!notification) return null
    notification.read = true
    notification.readAt = readAt
    return clone(notification)
  }

  async markNotificationsRead(recipientId, readAt) {
    for (const notification of this.state.notifications) {
      if (notification.recipientId === recipientId) {
        notification.read = true
        notification.readAt = readAt
      }
    }
    return this.listNotifications(recipientId)
  }

  async replaceNotifications(notifications) {
    this.state.notifications = clone(notifications)
    return clone(notifications)
  }

  async listUsers() {
    return clone(this.state.users)
  }

  async getUser(id) {
    return clone(this.state.users.find((user) => user.id === id) || null)
  }

  async getUserByEmail(email) {
    return clone(this.state.users.find((user) => user.email === email) || null)
  }

  async saveUser(user) {
    const index = this.state.users.findIndex((item) => item.id === user.id)
    if (index === -1) this.state.users.push(clone(user))
    else this.state.users[index] = clone(user)
    return clone(user)
  }

  async saveSession(session) {
    this.state.sessions.push(clone(session))
    return clone(session)
  }

  async getSessionByTokenHash(tokenHash) {
    const session = this.state.sessions.find((item) => item.tokenHash === tokenHash)
    if (!session) return null
    const user = this.state.users.find((item) => item.id === session.userId)
    return user ? clone({ ...session, user }) : null
  }

  async updateSessionCsrf(tokenHash, csrfHash) {
    const session = this.state.sessions.find((item) => item.tokenHash === tokenHash)
    if (session) session.csrfHash = csrfHash
  }

  async removeSessionByTokenHash(tokenHash) {
    this.state.sessions = this.state.sessions.filter((item) => item.tokenHash !== tokenHash)
  }

  async removeUserSessions(userId) {
    this.state.sessions = this.state.sessions.filter((item) => item.userId !== userId)
  }

  async removeExpiredSessions(now) {
    this.state.sessions = this.state.sessions.filter((item) => new Date(item.expiresAt) > now)
  }

  async getImport(fingerprint) {
    return this.imports.has(fingerprint)
      ? { fingerprint, result: clone(this.imports.get(fingerprint)) }
      : null
  }

  async saveImport(fingerprint, result) {
    this.imports.set(fingerprint, clone(result))
  }
}
