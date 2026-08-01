import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTicketEmail, MailService } from '../src/services/mail-service.js'

const report = {
  id: 'ticket/uno', ticketNumber: 7, status: 'Pendiente', priority: 'Alta',
  createdAt: '2026-08-01T12:00:00.000Z', userName: '<María>',
  technician: 'Ana & Asociados', description: `<script>alert('dato')</script>${'x'.repeat(700)}`,
}

const config = { enabled: true, from: 'soporte@example.com', frontendUrl: 'https://app.example.com' }

test('genera HTML escapado, texto plano, resumen limitado y enlace seguro', () => {
  const email = buildTicketEmail({ eventType: 'ticket_created', report, frontendUrl: config.frontendUrl })
  assert.match(email.subject, /INC-0007/)
  assert.match(email.text, /Folio: INC-0007/)
  assert.match(email.text, /Enlace: https:\/\/app\.example\.com\/tickets\/ticket%2Funo/)
  assert.doesNotMatch(email.html, /<script>/)
  assert.match(email.html, /&lt;María&gt;/)
  assert.match(email.html, /Ana &amp; Asociados/)
  assert.ok(email.text.length < 1000)
})

test('deduplica destinatarios y descarta direcciones vacías o inválidas', async () => {
  const messages = []
  const service = new MailService(config, { transport: { sendMail: async (message) => messages.push(message) } })
  const result = await service.sendTicketEvent({
    eventType: 'ticket_created', report,
    recipients: [{ email: 'User@Example.com' }, { email: 'user@example.com' }, { email: '' }, { email: 'invalida' }],
  })
  assert.equal(result.sent, 1)
  assert.deepEqual(messages[0].to, ['user@example.com'])
  assert.ok(messages[0].text)
  assert.ok(messages[0].html)
})

test('sin SMTP registra solo metadatos permitidos', async () => {
  const entries = []
  const service = new MailService({ enabled: false }, { logger: { info: (...args) => entries.push(args) } })
  await service.sendTicketEvent({ eventType: 'comment_added', report, recipients: [{ email: 'user@example.com' }] })
  assert.deepEqual(Object.keys(entries[0][0]).sort(), ['eventType', 'recipient', 'subject'])
  assert.doesNotMatch(JSON.stringify(entries), /script|password/i)
})

test('absorbe fallos del transporte sin propagar el error ni exponerlo', async () => {
  const warnings = []
  const service = new MailService(config, {
    transport: { sendMail: async () => { throw new Error('detalle sensible') } },
    logger: { warn: (...args) => warnings.push(args) },
  })
  await assert.doesNotReject(service.sendTicketEvent({
    eventType: 'status_changed', report, recipients: [{ email: 'user@example.com' }],
  }))
  assert.equal(warnings.length, 1)
  assert.doesNotMatch(JSON.stringify(warnings), /detalle sensible/)
})
