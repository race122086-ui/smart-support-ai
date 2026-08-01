import nodemailer from 'nodemailer'

const summaryLimit = 500
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function limitedSummary(value) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  return normalized.length > summaryLimit ? `${normalized.slice(0, summaryLimit - 1)}…` : normalized
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && emailPattern.test(value)
}

function eventTitle(eventType) {
  return ({ ticket_created: 'Ticket creado', technician_assigned: 'Técnico asignado',
    status_changed: 'Estado actualizado', comment_added: 'Nuevo comentario',
    ticket_closed: 'Ticket cerrado', attachment_added: 'Archivo adjuntado',
    attachment_removed: 'Archivo eliminado' })[eventType] || 'Actualización del ticket'
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }).format(new Date(value))
  } catch {
    return String(value || '')
  }
}

export function buildTicketEmail({ eventType, report, detail, frontendUrl }) {
  const title = eventTitle(eventType)
  const folio = `INC-${String(report.ticketNumber).padStart(4, '0')}`
  const summary = limitedSummary(detail || report.description)
  const link = frontendUrl ? `${frontendUrl}/tickets/${encodeURIComponent(report.id)}` : null
  const fields = [['Folio', folio], ['Estado', report.status], ['Prioridad', report.priority],
    ['Fecha', formatDate(report.createdAt)], ['Usuario', report.userName], ['Técnico', report.technician]]
  const text = [title, '', ...fields.map(([label, value]) => `${label}: ${value || 'No disponible'}`),
    `Resumen: ${summary || 'Sin resumen'}`, ...(link ? [`Enlace: ${link}`] : [])].join('\n')
  const rows = fields.map(([label, value]) => `<tr><th style="padding:8px;text-align:left;vertical-align:top;color:#475569">${escapeHtml(label)}</th><td style="padding:8px;color:#0f172a">${escapeHtml(value || 'No disponible')}</td></tr>`).join('')
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:640px;margin:0 auto;padding:24px 12px"><div style="background:#fff;border-radius:12px;padding:24px"><h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(title)}</h1><table role="presentation" style="width:100%;border-collapse:collapse">${rows}</table><h2 style="font-size:16px;margin:20px 0 8px">Resumen</h2><p style="line-height:1.5;overflow-wrap:anywhere">${escapeHtml(summary || 'Sin resumen')}</p>${link ? `<p style="margin-top:24px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Abrir ticket</a></p>` : ''}</div></div></body></html>`
  return { subject: `${title}: ${folio}`, text, html }
}

export class MailService {
  constructor(config = {}, options = {}) {
    this.config = config
    this.logger = options.logger || console
    this.transport = options.transport || (config.enabled ? nodemailer.createTransport({
      host: config.host, port: config.port, secure: config.secure,
      auth: { user: config.user, pass: config.password },
      connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
    }) : null)
  }

  async sendTicketEvent({ eventType, report, recipients, detail }) {
    const uniqueRecipients = [...new Set(recipients
      .map((recipient) => recipient?.email?.trim().toLowerCase()).filter(validEmail))]
    if (!uniqueRecipients.length) return { sent: 0 }
    const content = buildTicketEmail({ eventType, report, detail, frontendUrl: this.config.frontendUrl })
    if (!this.transport) {
      for (const recipient of uniqueRecipients) this.logger.info(
        { recipient, subject: content.subject, eventType }, 'Correo omitido: SMTP no configurado')
      return { sent: 0, simulated: uniqueRecipients.length }
    }
    try {
      await this.transport.sendMail({ from: this.config.from, to: uniqueRecipients,
        subject: content.subject, text: content.text, html: content.html })
      return { sent: uniqueRecipients.length }
    } catch {
      this.logger.warn({ recipients: uniqueRecipients, eventType }, 'No se pudo enviar el correo del ticket')
      return { sent: 0, failed: uniqueRecipients.length }
    }
  }
}
