import test from 'node:test'
import assert from 'node:assert/strict'

import { STORAGE_KEYS } from '../src/domain/constants.js'
import { createLocalRepositories } from '../src/persistence/local-storage.js'

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

test('aísla y normaliza lecturas de las tres claves persistentes', () => {
  const storage = createMemoryStorage({
    [STORAGE_KEYS.reports]: JSON.stringify([{ userName: 'Ana' }]),
    [STORAGE_KEYS.settings]: '{json roto',
    [STORAGE_KEYS.notifications]: JSON.stringify([{ message: 'Aviso' }]),
  })
  const repositories = createLocalRepositories(storage)

  assert.equal(repositories.reports.list()[0].contactEmail, 'ana@empresa.com')
  assert.equal(repositories.settings.get().profile.name, 'Administrador')
  assert.equal(repositories.notifications.list()[0].read, false)
})

test('crea, actualiza y elimina reportes mediante el repositorio', () => {
  const repositories = createLocalRepositories(createMemoryStorage())
  const report = {
    id: 'reporte-1',
    ticketNumber: 1,
    userName: 'Ana',
    description: 'Acceso',
    priority: 'Media',
    status: 'Pendiente',
    createdAt: '2026-07-29T12:00:00.000Z',
  }

  repositories.reports.create(report)
  assert.equal(repositories.reports.getById('reporte-1').userName, 'Ana')
  assert.equal(repositories.reports.update('reporte-1', { status: 'Resuelto' }).status, 'Resuelto')
  assert.equal(repositories.reports.update('ausente', {}), null)
  assert.equal(repositories.reports.remove('reporte-1'), true)
  assert.deepEqual(repositories.reports.list(), [])
})
