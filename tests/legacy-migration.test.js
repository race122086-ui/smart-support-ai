import assert from 'node:assert/strict'
import test from 'node:test'
import { STORAGE_KEYS } from '../src/domain/constants.js'
import {
  getLegacyMigration,
  markLegacyMigrationComplete,
} from '../src/persistence/legacy-migration.js'

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null
    },
    setItem(key, value) {
      values.set(key, value)
    },
    values,
  }
}

test('detecta y resume los datos históricos sin modificarlos', () => {
  const reports = JSON.stringify([{
    id: 'reporte-anterior',
    ticketNumber: 7,
    userName: 'Persona de prueba',
    description: 'Incidencia histórica',
  }])
  const storage = createStorage({
    [STORAGE_KEYS.reports]: reports,
    [STORAGE_KEYS.settings]: JSON.stringify({ technicians: ['Técnico Demo'] }),
    [STORAGE_KEYS.notifications]: JSON.stringify([]),
  })

  const migration = getLegacyMigration(storage)

  assert.equal(migration.counts.reports, 1)
  assert.equal(migration.counts.technicians, 1)
  assert.equal(storage.getItem(STORAGE_KEYS.reports), reports)
})

test('marca una migración sin borrar las claves históricas', () => {
  const storage = createStorage({
    [STORAGE_KEYS.reports]: '[]',
  })

  markLegacyMigrationComplete('huella-de-prueba', storage)

  assert.equal(storage.getItem(STORAGE_KEYS.reports), '[]')
  assert.equal(getLegacyMigration(storage), null)
})
