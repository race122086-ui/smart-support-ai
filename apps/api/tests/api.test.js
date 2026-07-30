import assert from 'node:assert/strict'
import test from 'node:test'
import { buildApp } from '../src/app.js'
import { MemoryRepository } from '../src/repositories/memory-repository.js'

const validReport = {
  userName: 'María López',
  contactEmail: 'maria@empresa.com',
  contactPhone: '+52 55 0000 0042',
  department: 'Sistemas',
  description: 'No puede iniciar sesión',
  priority: 'Alta',
}

async function createTestApp() {
  let sequence = 0
  return buildApp({
    logger: false,
    config: {
      host: '127.0.0.1',
      port: 3000,
      corsOrigin: 'http://localhost:5173',
      logLevel: 'silent',
    },
    repository: new MemoryRepository(),
    serviceOptions: {
      clock: () => new Date('2026-07-29T12:00:00.000Z'),
      idFactory: () => `id-${++sequence}`,
    },
  })
}

test('publica salud, CORS limitado y contrato OpenAPI', async (t) => {
  const app = await createTestApp()
  t.after(() => app.close())

  const health = await app.inject({
    method: 'GET',
    url: '/health',
    headers: { origin: 'http://localhost:5173' },
  })
  assert.equal(health.statusCode, 200)
  assert.deepEqual(health.json(), { status: 'ok' })
  assert.equal(
    health.headers['access-control-allow-origin'],
    'http://localhost:5173'
  )

  const spec = await app.inject({ method: 'GET', url: '/documentation/json' })
  assert.equal(spec.statusCode, 200)
  assert.equal(spec.json().info.title, 'SmartSupport API')
  assert.ok(spec.json().paths['/api/v1/reports'])
})

test('cubre el ciclo de reportes, actividad, notificaciones, SLA y métricas', async (t) => {
  const app = await createTestApp()
  t.after(() => app.close())

  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/reports',
    payload: validReport,
  })
  assert.equal(created.statusCode, 201)
  const report = created.json()
  assert.equal(created.headers.location, `/api/v1/reports/${report.id}`)
  assert.equal(report.ticketNumber, 1)

  const list = await app.inject({
    method: 'GET',
    url: '/api/v1/reports?q=mar%C3%ADa&status=Pendiente&page=1&pageSize=1',
  })
  assert.equal(list.statusCode, 200)
  assert.equal(list.json().total, 1)
  assert.deepEqual(Object.keys(list.json()).sort(), ['items', 'total'])

  const detail = await app.inject({
    method: 'GET',
    url: `/api/v1/reports/${report.id}`,
  })
  assert.equal(detail.statusCode, 200)

  const updated = await app.inject({
    method: 'PATCH',
    url: `/api/v1/reports/${report.id}`,
    payload: { description: 'Descripción actualizada' },
  })
  assert.equal(updated.statusCode, 200)
  assert.equal(updated.json().description, 'Descripción actualizada')

  const status = await app.inject({
    method: 'PUT',
    url: `/api/v1/reports/${report.id}/status`,
    payload: { status: 'En progreso' },
  })
  assert.equal(status.statusCode, 200)

  const assigned = await app.inject({
    method: 'PUT',
    url: `/api/v1/reports/${report.id}/technician`,
    payload: { technician: 'Ana Torres' },
  })
  assert.equal(assigned.statusCode, 200)
  assert.equal(assigned.json().technician, 'Ana Torres')

  const comment = await app.inject({
    method: 'POST',
    url: `/api/v1/reports/${report.id}/comments`,
    payload: { message: 'Validado con la persona usuaria' },
  })
  assert.equal(comment.statusCode, 201)
  assert.match(comment.json().message, /^Comentario:/)

  const activity = await app.inject({
    method: 'GET',
    url: `/api/v1/reports/${report.id}/activity`,
  })
  assert.equal(activity.statusCode, 200)
  assert.ok(activity.json().length >= 5)

  const sla = await app.inject({
    method: 'GET',
    url: `/api/v1/reports/${report.id}/sla`,
  })
  assert.deepEqual(sla.json(), {
    deadline: '2026-07-29T20:00:00.000Z',
    overdue: false,
  })

  const metrics = await app.inject({ method: 'GET', url: '/api/v1/metrics' })
  assert.equal(metrics.json().inProgress, 1)

  const notifications = await app.inject({
    method: 'GET',
    url: '/api/v1/notifications',
  })
  assert.ok(notifications.json().length >= 5)

  const read = await app.inject({
    method: 'POST',
    url: '/api/v1/notifications/read-all',
  })
  assert.ok(read.json().every((notification) => notification.read))

  const removed = await app.inject({
    method: 'DELETE',
    url: `/api/v1/reports/${report.id}`,
  })
  assert.equal(removed.statusCode, 204)
})

test('administra técnicos y configuración con conflictos de dominio', async (t) => {
  const app = await createTestApp()
  t.after(() => app.close())

  const technicians = await app.inject({
    method: 'GET',
    url: '/api/v1/technicians',
  })
  assert.equal(technicians.statusCode, 200)
  assert.equal(technicians.json().length, 3)

  const createdTechnician = await app.inject({
    method: 'POST',
    url: '/api/v1/technicians',
    payload: { name: 'Elena Vargas' },
  })
  assert.equal(createdTechnician.statusCode, 201)

  const duplicate = await app.inject({
    method: 'POST',
    url: '/api/v1/technicians',
    payload: { name: 'elena vargas' },
  })
  assert.equal(duplicate.statusCode, 409)
  assert.equal(duplicate.json().error.code, 'TECHNICIAN_ALREADY_EXISTS')

  const settings = await app.inject({
    method: 'PATCH',
    url: '/api/v1/settings',
    payload: {
      profile: { name: 'Mesa de ayuda', role: 'Técnico' },
      sla: { Alta: 4 },
    },
  })
  assert.equal(settings.statusCode, 200)
  assert.equal(settings.json().profile.role, 'Técnico')
  assert.equal(settings.json().sla.Alta, 4)
  assert.ok(settings.json().technicians.includes('Elena Vargas'))

  const deleted = await app.inject({
    method: 'DELETE',
    url: `/api/v1/technicians/${createdTechnician.json().id}`,
  })
  assert.equal(deleted.statusCode, 204)
})

test('valida entradas, parámetros, recursos inexistentes y campos del servidor', async (t) => {
  const app = await createTestApp()
  t.after(() => app.close())

  const unknownField = await app.inject({
    method: 'POST',
    url: '/api/v1/reports',
    payload: { ...validReport, id: 'inyectado' },
  })
  assert.equal(unknownField.statusCode, 422)
  assert.equal(unknownField.json().error.code, 'VALIDATION_ERROR')

  const invalidFilter = await app.inject({
    method: 'GET',
    url: '/api/v1/reports?priority=Urgente',
  })
  assert.equal(invalidFilter.statusCode, 400)

  const missing = await app.inject({
    method: 'GET',
    url: '/api/v1/reports/no-existe',
  })
  assert.equal(missing.statusCode, 404)
  assert.deepEqual(Object.keys(missing.json()), ['error'])

  const routeMissing = await app.inject({
    method: 'GET',
    url: '/api/v1/no-existe',
  })
  assert.equal(routeMissing.statusCode, 404)
  assert.equal(routeMissing.json().error.code, 'ROUTE_NOT_FOUND')
})

test('exporta e importa respaldos de forma atómica', async (t) => {
  const app = await createTestApp()
  t.after(() => app.close())

  await app.inject({
    method: 'POST',
    url: '/api/v1/reports',
    payload: validReport,
  })
  const exported = await app.inject({
    method: 'GET',
    url: '/api/v1/backups/current',
  })
  assert.equal(exported.statusCode, 200)
  assert.equal(exported.json().reports.length, 1)

  const invalid = await app.inject({
    method: 'POST',
    url: '/api/v1/backups/import',
    payload: { settings: {} },
  })
  assert.equal(invalid.statusCode, 400)
  assert.equal(invalid.json().error.code, 'INVALID_BACKUP')

  const malformedRecord = await app.inject({
    method: 'POST',
    url: '/api/v1/backups/import',
    payload: { reports: [null] },
  })
  assert.equal(malformedRecord.statusCode, 422)

  const afterInvalid = await app.inject({
    method: 'GET',
    url: '/api/v1/reports',
  })
  assert.equal(afterInvalid.json().total, 1)

  const imported = await app.inject({
    method: 'POST',
    url: '/api/v1/backups/import',
    payload: exported.json(),
  })
  assert.equal(imported.statusCode, 200)
  assert.equal(imported.json().reports, 1)
  assert.equal(imported.json().duplicate, false)

  const repeated = await app.inject({
    method: 'POST',
    url: '/api/v1/backups/import',
    payload: exported.json(),
  })
  assert.equal(repeated.statusCode, 200)
  assert.equal(repeated.json().duplicate, true)
})
