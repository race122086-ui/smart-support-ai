import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { MemoryRepository } from './memory-repository.js'

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validateStoredData(value) {
  if (
    !isObject(value)
    || !Array.isArray(value.reports)
    || !isObject(value.settings)
    || !Array.isArray(value.technicians)
    || !Array.isArray(value.notifications)
  ) {
    throw new TypeError('El archivo local de SmartSupport no tiene una estructura válida')
  }
  value.users = Array.isArray(value.users) ? value.users : []
  value.sessions = Array.isArray(value.sessions) ? value.sessions : []
  value.attachments = Array.isArray(value.attachments) ? value.attachments : []
  if (value.imports !== undefined && !Array.isArray(value.imports)) {
    throw new TypeError('El historial de importaciones local no es válido')
  }
  return value
}

export class FileRepository extends MemoryRepository {
  constructor(filePath = '.smartsupport/data.json') {
    super()
    this.filePath = resolve(filePath)
    this.transactionDepth = 0
    this.writeQueue = Promise.resolve()
  }

  async connect() {
    let serialized
    try {
      serialized = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
    const stored = validateStoredData(JSON.parse(serialized))
    await super.replace(stored)
    this.imports = new Map(stored.imports || [])
  }

  async persist() {
    const snapshot = await super.snapshot()
    const payload = JSON.stringify({
      ...snapshot,
      imports: [...this.imports.entries()],
    }, null, 2)
    const tempPath = `${this.filePath}.${process.pid}.tmp`
    this.writeQueue = this.writeQueue.catch(() => {}).then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true })
      try {
        await writeFile(tempPath, payload, 'utf8')
        await rename(tempPath, this.filePath)
      } catch (error) {
        await rm(tempPath, { force: true })
        throw error
      }
    })
    return this.writeQueue
  }

  async persistOutsideTransaction() {
    if (this.transactionDepth === 0) await this.persist()
  }

  async transaction(work) {
    this.transactionDepth += 1
    try {
      const result = await super.transaction(work)
      this.transactionDepth -= 1
      if (this.transactionDepth === 0) await this.persist()
      return result
    } catch (error) {
      this.transactionDepth -= 1
      throw error
    }
  }

  async replace(snapshot) {
    const result = await super.replace(snapshot)
    await this.persistOutsideTransaction()
    return result
  }

  async saveReport(report) {
    const result = await super.saveReport(report)
    await this.persistOutsideTransaction()
    return result
  }

  async removeReport(id) {
    const result = await super.removeReport(id)
    await this.persistOutsideTransaction()
    return result
  }

  async saveSettings(settings) {
    const result = await super.saveSettings(settings)
    await this.persistOutsideTransaction()
    return result
  }

  async saveTechnician(technician) {
    const result = await super.saveTechnician(technician)
    await this.persistOutsideTransaction()
    return result
  }

  async removeTechnician(id) {
    const result = await super.removeTechnician(id)
    await this.persistOutsideTransaction()
    return result
  }

  async saveNotification(notification) {
    const result = await super.saveNotification(notification)
    await this.persistOutsideTransaction()
    return result
  }

  async saveAttachment(attachment) {
    const result = await super.saveAttachment(attachment)
    await this.persistOutsideTransaction()
    return result
  }

  async removeAttachment(id) {
    const result = await super.removeAttachment(id)
    await this.persistOutsideTransaction()
    return result
  }

  async markNotificationRead(id, recipientId, readAt) {
    const result = await super.markNotificationRead(id, recipientId, readAt)
    await this.persistOutsideTransaction()
    return result
  }

  async markNotificationsRead(recipientId, readAt) {
    const result = await super.markNotificationsRead(recipientId, readAt)
    await this.persistOutsideTransaction()
    return result
  }

  async replaceNotifications(notifications) {
    const result = await super.replaceNotifications(notifications)
    await this.persistOutsideTransaction()
    return result
  }

  async saveUser(user) {
    const result = await super.saveUser(user)
    await this.persistOutsideTransaction()
    return result
  }

  async saveSession(session) {
    const result = await super.saveSession(session)
    await this.persistOutsideTransaction()
    return result
  }

  async updateSessionCsrf(tokenHash, csrfHash) {
    await super.updateSessionCsrf(tokenHash, csrfHash)
    await this.persistOutsideTransaction()
  }

  async removeSessionByTokenHash(tokenHash) {
    await super.removeSessionByTokenHash(tokenHash)
    await this.persistOutsideTransaction()
  }

  async removeUserSessions(userId) {
    await super.removeUserSessions(userId)
    await this.persistOutsideTransaction()
  }

  async removeExpiredSessions(now) {
    await super.removeExpiredSessions(now)
    await this.persistOutsideTransaction()
  }

  async saveImport(fingerprint, result) {
    await super.saveImport(fingerprint, result)
    await this.persistOutsideTransaction()
  }

  async health() {
    await this.writeQueue
    return true
  }

  async disconnect() {
    await this.writeQueue
  }
}
