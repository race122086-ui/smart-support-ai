import assert from 'node:assert/strict'
import test from 'node:test'
import { MemoryRepository } from '../src/repositories/memory-repository.js'
import { SupportService } from '../src/services/support-service.js'

function createService(initialState = {}) {
  let sequence = 0
  const repository = new MemoryRepository(initialState)
  const service = new SupportService(repository, {
    clock: () => new Date('2026-07-29T12:00:00.000Z'),
    idFactory: () => `id-${++sequence}`,
  })
  return { repository, service }
}

const admin = { id: 'admin-test', name: 'Admin', email: 'admin.local', role: 'ADMIN' }

const validReport = {
  userName: 'María López',
  contactEmail: 'maria@empresa.com',
  contactPhone: '+52 55 0000 0042',
  department: 'Sistemas',
  description: 'No puede iniciar sesión',
  priority: 'Alta',
}

test('crea folio, actividad y notificación en el servicio', async () => {
  const { repository, service } = createService()
  const report = await service.createReport(validReport, admin)

  assert.equal(report.ticketNumber, 1)
  assert.equal(report.status, 'Pendiente')
  assert.equal(report.technician, 'Sin asignar')
  assert.equal(report.activity[0].message, 'Reporte creado')
  assert.equal((await repository.listNotifications(admin.id)).length, 1)
})

test('calcula SLA en el límite exacto y después del límite', async () => {
  const baseState = {
    reports: [{
      id: 'reporte-1',
      ticketNumber: 1,
      ...validReport,
      status: 'Pendiente',
      technician: 'Sin asignar',
      createdAt: '2026-07-29T04:00:00.000Z',
      activity: [],
    }],
  }
  const { service } = createService(baseState)

  assert.deepEqual(await service.getSla('reporte-1', admin), {
    deadline: '2026-07-29T12:00:00.000Z',
    overdue: false,
  })

  service.clock = () => new Date('2026-07-29T12:00:00.001Z')
  assert.equal((await service.getSla('reporte-1', admin)).overdue, true)
})

test('la importación inválida es atómica', async () => {
  const { repository, service } = createService()
  await service.createReport(validReport, admin)
  const before = await repository.snapshot()

  await assert.rejects(
    service.importBackup({
      reports: [{ id: 'duplicado', ticketNumber: 1 }, { id: 'duplicado', ticketNumber: 2 }],
    }),
    { code: 'REPORT_ALREADY_EXISTS' }
  )
  assert.deepEqual(await repository.snapshot(), before)
})

test('filtra, ordena y pagina sin exponer el arreglo del repositorio', async () => {
  const { repository, service } = createService()
  await service.createReport(validReport, admin)
  await service.createReport({
    ...validReport,
    userName: 'Carlos Ruiz',
    priority: 'Baja',
  }, admin)

  const result = await service.listReports({
    q: 'maría',
    priority: 'Alta',
    page: 1,
    pageSize: 1,
  }, admin)
  assert.equal(result.total, 1)
  assert.equal(result.items[0].userName, 'María López')

  result.items[0].userName = 'Mutado'
  assert.equal((await repository.listReports())[0].userName, 'María López')
})


test('elimina como ADMIN y publica ticket_deleted a creador y técnico autorizados', async () => {
  const events = []
  const repository = new MemoryRepository({
    users: [
      { id: 'admin-test', name: 'Admin', role: 'ADMIN', active: true },
      { id: 'usuario-creador', name: 'Usuario', role: 'USER', active: true },
      { id: 'tecnico-user', name: 'Técnico', role: 'TECHNICIAN', active: true },
    ],
    technicians: [{
      id: 'tecnico-id', name: 'Técnico', userId: 'tecnico-user', active: true,
    }],
    reports: [{
      id: 'reporte-eliminado', ticketNumber: 42, ...validReport,
      status: 'Pendiente', technician: 'Técnico', technicianId: 'tecnico-id',
      createdById: 'usuario-creador', createdAt: '2026-07-29T12:00:00.000Z', activity: [],
    }],
  })
  const service = new SupportService(repository, {
    clock: () => new Date('2026-07-29T12:00:00.000Z'),
    idFactory: () => 'evento-eliminacion',
    notificationHub: { publish: (event) => events.push(event) },
  })

  await service.deleteReport('reporte-eliminado', admin)

  assert.equal(await repository.getReport('reporte-eliminado'), null)
  assert.deepEqual(new Set(events.map((event) => event.recipientId)),
    new Set(['admin-test', 'usuario-creador', 'tecnico-user']))
  assert.ok(events.every((event) => event.type === 'ticket_deleted'))
  assert.ok(events.every((event) => event.reportId === 'reporte-eliminado'))
})


test('registra el cierre una sola vez cuando el reporte cambia a Resuelto', async () => {
  const { repository, service } = createService({
    reports: [{
      id: 'reporte-cierre', ticketNumber: 9, ...validReport, status: 'En progreso',
      technician: 'Admin', createdById: 'admin-test',
      createdAt: '2026-07-29T10:00:00.000Z', activity: [],
    }],
    users: [admin],
  })

  await service.changeStatus('reporte-cierre', 'Resuelto', admin)
  let report = await repository.getReport('reporte-cierre')
  assert.ok(report.activity.some((item) => item.message === 'Estado cambiado a Resuelto'))
  assert.equal(report.activity.filter((item) => item.message === 'Reporte cerrado').length, 1)

  await service.changeStatus('reporte-cierre', 'Resuelto', admin)
  report = await repository.getReport('reporte-cierre')
  assert.equal(report.activity.filter((item) => item.message === 'Reporte cerrado').length, 1)
})

test('envía los cinco eventos a los destinatarios correctos sin incluir al actor', async () => {
  const sent = []
  const users = [
    { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN', active: true },
    { id: 'creator-1', name: 'Creadora', email: 'creator@example.com', role: 'USER', active: true },
    { id: 'tech-user-1', name: 'Técnica', email: 'tech@example.com', role: 'TECHNICIAN', technicianId: 'tech-1', active: true },
  ]
  const repository = new MemoryRepository({
    users,
    technicians: [{ id: 'tech-1', name: 'Técnica', userId: 'tech-user-1', active: true }],
  })
  let sequence = 0
  const service = new SupportService(repository, {
    clock: () => new Date('2026-08-01T12:00:00.000Z'),
    idFactory: () => `mail-id-${++sequence}`,
    mailService: { sendTicketEvent: async (event) => { sent.push(event) } },
  })
  const creator = users[1]
  const technician = users[2]
  const report = await service.createReport(validReport, creator)
  await service.assignTechnician(report.id, 'Técnica', users[0])
  await service.changeStatus(report.id, 'En progreso', technician)
  await service.addComment(report.id, 'Necesito seguimiento', creator)
  await service.changeStatus(report.id, 'Resuelto', users[0])
  await new Promise((resolve) => setImmediate(resolve))

  assert.deepEqual(sent.map((event) => event.eventType), [
    'ticket_created', 'technician_assigned', 'status_changed', 'comment_added', 'ticket_closed',
  ])
  assert.deepEqual(sent.map((event) => event.recipients.map((recipient) => recipient.email).sort()), [
    ['admin@example.com'],
    ['creator@example.com', 'tech@example.com'],
    ['admin@example.com', 'creator@example.com'],
    ['admin@example.com', 'tech@example.com'],
    ['creator@example.com', 'tech@example.com'],
  ])
})

test('un fallo de correo no impide crear el ticket', async () => {
  const repository = new MemoryRepository({
    users: [{ id: 'admin-test', name: 'Admin', email: 'admin@example.com', role: 'ADMIN', active: true }],
  })
  const service = new SupportService(repository, {
    idFactory: () => crypto.randomUUID(),
    mailService: { sendTicketEvent: async () => { throw new Error('fallo simulado') } },
  })
  const report = await service.createReport(validReport, admin)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(report.ticketNumber, 1)
  assert.equal((await repository.listReports()).length, 1)
})
