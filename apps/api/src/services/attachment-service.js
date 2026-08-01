import { DomainError, notFound, validationError } from '../errors/domain-error.js'
import {
  attachmentExtension,
  inspectAttachmentFile,
} from './attachment-validation.js'
import { buildAttachmentKey } from '../storage/attachment-storage.js'

function publicAttachment(attachment) {
  return {
    id: attachment.id,
    reportId: attachment.reportId,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    uploadedBy: attachment.uploadedBy || null,
    uploadedById: attachment.uploadedById || null,
    createdAt: attachment.createdAt,
  }
}

export class AttachmentService {
  constructor(repository, storage, options = {}) {
    this.repository = repository
    this.storage = storage
    this.support = options.support
    this.maxBytes = options.maxBytes
    this.maxCount = options.maxCount
  }

  async finishTransaction(work) {
    const result = await this.repository.transaction(work)
    this.support.publishNotifications(result.notifications)
    this.support.dispatchMail(result.mail)
    return result.value
  }

  async getAccessibleReport(reportId, actor) {
    const report = await this.repository.getReport(reportId)
    if (!report) throw notFound('Reporte')
    if (!this.support.canAccessReport(report, actor)) this.support.forbidden()
    return report
  }

  async upload(reportId, file, actor) {
    const now = this.support.now()
    const id = this.support.idFactory()
    let storageKey = null
    try {
      const result = await this.repository.transaction(async (repository) => {
        const report = await repository.getReport(reportId)
        if (!report) throw notFound('Reporte')
        if (!this.support.canAccessReport(report, actor)) this.support.forbidden()
        const count = (await repository.listAttachments(reportId)).length
        if (count >= this.maxCount) {
          throw validationError('Se alcanzó el límite de adjuntos del ticket', [
            { field: 'file', reason: `Máximo ${this.maxCount} archivos por ticket` },
          ])
        }
        const inspected = inspectAttachmentFile({
          fileName: file.filename,
          buffer: file.buffer,
          maxBytes: this.maxBytes,
        })
        const storedName = `${id}${attachmentExtension(inspected.mimeType)}`
        storageKey = buildAttachmentKey(reportId, storedName)
        await this.storage.save(storageKey, file.buffer)
        const attachment = {
          id,
          reportId,
          fileName: inspected.fileName,
          storedName,
          mimeType: inspected.mimeType,
          size: inspected.size,
          storageKey,
          uploadedById: actor.id,
          uploadedBy: actor.name,
          createdAt: now,
        }
        try {
          await repository.saveAttachment(attachment)
          report.activity.push(
            this.support.activity(`Se adjuntó el archivo ${attachment.fileName}`, now)
          )
          await repository.saveReport(report)
        } catch (error) {
          await this.storage.remove(storageKey).catch(() => {})
          throw error
        }
        const recipients = await this.support.notificationRecipients(report, {
          creator: true,
          technician: true,
          admins: true,
          excludeActorId: actor.id,
        }, repository)
        const notifications = await this.support.notifyRecipients(repository, recipients, {
          reportId: report.id,
          type: 'attachment_added',
          message: `Se adjuntó un archivo al ticket INC-${String(report.ticketNumber).padStart(4, '0')}`,
        }, now)
        const mailRecipients = await this.support.mailRecipients(repository, recipients, actor.id)
        return {
          value: publicAttachment(attachment),
          notifications,
          mail: {
            eventType: 'attachment_added',
            report,
            recipients: mailRecipients,
            detail: attachment.fileName,
          },
        }
      })
      this.support.publishNotifications(result.notifications)
      this.support.dispatchMail(result.mail)
      return result.value
    } catch (error) {
      if (storageKey) await this.storage.remove(storageKey).catch(() => {})
      throw error
    }
  }

  async list(reportId, actor) {
    await this.getAccessibleReport(reportId, actor)
    const attachments = await this.repository.listAttachments(reportId)
    return attachments.map(publicAttachment)
  }

  async download(reportId, attachmentId, actor) {
    await this.getAccessibleReport(reportId, actor)
    const attachment = await this.repository.getAttachment(attachmentId)
    if (!attachment || attachment.reportId !== reportId) throw notFound('Adjunto')
    const stream = await this.storage.openReadStream(attachment.storageKey)
    return { attachment: publicAttachment(attachment), stream }
  }

  async remove(reportId, attachmentId, actor) {
    let storageKey = null
    const value = await this.finishTransaction(async (repository) => {
      const report = await repository.getReport(reportId)
      if (!report) throw notFound('Reporte')
      if (!this.support.canAccessReport(report, actor)) this.support.forbidden()
      const attachment = await repository.getAttachment(attachmentId)
      if (!attachment || attachment.reportId !== reportId) throw notFound('Adjunto')
      const canDelete = actor.role === 'ADMIN'
        || attachment.uploadedById === actor.id
        || report.createdById === actor.id
      if (!canDelete) this.support.forbidden()
      await repository.removeAttachment(attachmentId)
      const now = this.support.now()
      report.activity.push(
        this.support.activity(`Se eliminó el archivo ${attachment.fileName}`, now)
      )
      await repository.saveReport(report)
      const recipients = await this.support.notificationRecipients(report, {
        creator: true,
        technician: true,
        admins: true,
        excludeActorId: actor.id,
      }, repository)
      const notifications = await this.support.notifyRecipients(repository, recipients, {
        reportId: report.id,
        type: 'attachment_removed',
        message: `Se eliminó un archivo del ticket INC-${String(report.ticketNumber).padStart(4, '0')}`,
      }, now)
      const mailRecipients = await this.support.mailRecipients(repository, recipients, actor.id)
      storageKey = attachment.storageKey
      return {
        value: publicAttachment(attachment),
        notifications,
        mail: {
          eventType: 'attachment_removed',
          report,
          recipients: mailRecipients,
          detail: attachment.fileName,
        },
      }
    })
    if (storageKey) await this.storage.remove(storageKey).catch(() => {})
    return value
  }

  async purgeReportBlobs(reportId, actor) {
    const report = await this.repository.getReport(reportId)
    if (!report) throw notFound('Reporte')
    if (actor.role !== 'ADMIN' || !this.support.canAccessReport(report, actor)) {
      this.support.forbidden()
    }
    const attachments = await this.repository.listAttachments(reportId)
    await Promise.all(attachments.map((attachment) =>
      this.storage.remove(attachment.storageKey).catch(() => {})
    ))
  }
}
