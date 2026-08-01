import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { MemoryRepository } from '../src/repositories/memory-repository.js'
import { SupportService } from '../src/services/support-service.js'

const admin = { id: 'admin', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' }

test('la migración conserva reportes históricos sin inventar propietario', async () => {
  const migration = await readFile(
    new URL('../prisma/migrations/20260731000000_authentication_and_authorization/migration.sql', import.meta.url),
    'utf8'
  )
  assert.match(migration, /ADD COLUMN "created_by_id" UUID/)
  assert.doesNotMatch(migration, /UPDATE\s+"reports"/i)

  const repository = new MemoryRepository()
  const service = new SupportService(repository)
  await service.importBackup({
    version: 1,
    reports: [{
      id: 'reporte-antiguo',
      ticketNumber: 7,
      userName: 'Registro histórico',
      contactEmail: 'historico@example.test',
      contactPhone: '+52 55 0000 0000',
      department: 'Sistemas',
      description: 'Reporte previo a usuarios',
      priority: 'Media',
      status: 'Pendiente',
      technician: 'Sin asignar',
    }],
  })
  const report = (await service.listReports({}, admin)).items[0]
  assert.equal(report.createdById ?? null, null)
})
