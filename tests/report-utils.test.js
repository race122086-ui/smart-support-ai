import test from 'node:test'
import assert from 'node:assert/strict'

import { calculateStats, formatTicket } from '../src/report-utils.js'

test('calcula correctamente las estadísticas de los reportes', () => {
  const reports = [
    { status: 'Pendiente' },
    { status: 'Pendiente' },
    { status: 'En progreso' },
    { status: 'Resuelto' },
    { status: 'Resuelto' },
    { status: 'Resuelto' },
  ]

  assert.deepEqual(calculateStats(reports), {
    total: 6,
    pending: 2,
    inProgress: 1,
    resolved: 3,
  })
})

test('devuelve estadísticas en cero cuando no existen reportes', () => {
  assert.deepEqual(calculateStats([]), {
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
  })
})

test('genera folios con cuatro dígitos', () => {
  assert.equal(formatTicket(1), 'INC-0001')
  assert.equal(formatTicket(42), 'INC-0042')
  assert.equal(formatTicket(1250), 'INC-1250')
})
