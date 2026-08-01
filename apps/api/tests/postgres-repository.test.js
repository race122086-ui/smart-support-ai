import assert from 'node:assert/strict'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { PrismaRepository } from '../src/repositories/prisma-repository.js'
import { hashPassword } from '../src/auth/auth-service.js'
import { SupportService } from '../src/services/support-service.js'

const databaseUrl = process.env.TEST_DATABASE_URL
const integrationTest = databaseUrl ? test : test.skip

const admin = { id: '00000000-0000-4000-8000-000000000001', name: 'Admin DB', email: 'admin-db@example.test', role: 'ADMIN' }

const validReport = {
  userName: 'Persona de prueba',
  contactEmail: 'prueba@empresa.test',
  contactPhone: '+52 55 0000 0000',
  department: 'Sistemas',
  description: 'Incidencia de integración',
  priority: 'Alta',
}

async function cleanDatabase(client) {
  await client.session.deleteMany()
  await client.reportActivity.deleteMany()
  await client.report.deleteMany()
  await client.notification.deleteMany()
  await client.backupImport.deleteMany()
  await client.technician.deleteMany()
  await client.user.deleteMany()
  await client.counter.updateMany({ data: { value: 0 } })
}

async function seedAdmin(repository) {
  await repository.saveUser({ ...admin, passwordHash: await hashPassword('SeguraPruebas123'), active: true })
}

integrationTest('persiste reinicios y reserva folios concurrentes sin duplicarlos', async (t) => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl })
  const repository = new PrismaRepository(client)
  await repository.connect()
  await cleanDatabase(client)
  await seedAdmin(repository)
  const service = new SupportService(repository)
  t.after(async () => {
    await cleanDatabase(client)
    await repository.disconnect()
  })

  const created = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      service.createReport({ ...validReport, userName: `Persona ${index}` })
    )
  )
  assert.equal(new Set(created.map((report) => report.ticketNumber)).size, 10)

  const secondClient = new PrismaClient({ datasourceUrl: databaseUrl })
  const restartedRepository = new PrismaRepository(secondClient)
  await restartedRepository.connect()
  assert.equal((await restartedRepository.listReports()).length, 10)
  await restartedRepository.disconnect()
})

integrationTest('revierte una importación completa cuando falla una restricción', async (t) => {
  const client = new PrismaClient({ datasourceUrl: databaseUrl })
  const repository = new PrismaRepository(client)
  await repository.connect()
  await cleanDatabase(client)
  await seedAdmin(repository)
  const service = new SupportService(repository)
  t.after(async () => {
    await cleanDatabase(client)
    await repository.disconnect()
  })

  await service.createReport(validReport, admin)
  const before = await repository.snapshot()
  await assert.rejects(
    service.importBackup({
      reports: [
        { id: 'igual', ticketNumber: 1 },
        { id: 'igual', ticketNumber: 2 },
      ],
    }),
    { code: 'REPORT_ALREADY_EXISTS' }
  )
  assert.deepEqual(await repository.snapshot(), before)
})
