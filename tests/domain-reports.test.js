import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canTransitionStatus,
  createContactEmail,
  createReport,
  filterReports,
  getSlaDeadline,
  isSlaOverdue,
  normalizeReport,
  sortReports,
  suggestDepartment,
} from '../src/domain/reports.js'

const now = '2026-07-29T12:00:00.000Z'

test('normaliza un reporte antiguo y completa sus datos compatibles', () => {
  const report = normalizeReport({
    userName: 'José Pérez',
    description: 'No tengo acceso al sistema',
  }, 1, { now })

  assert.equal(report.id, 'reporte-2')
  assert.equal(report.ticketNumber, 2)
  assert.equal(report.contactEmail, 'jose.perez@empresa.com')
  assert.equal(report.contactPhone, '+52 55 0000 0002')
  assert.equal(report.department, 'Sistemas')
  assert.equal(report.priority, 'Media')
  assert.equal(report.status, 'Pendiente')
  assert.equal(report.technician, 'Sin asignar')
  assert.deepEqual(report.activity, [])
})

test('normaliza entradas malformadas sin propagar formas inválidas', () => {
  const report = normalizeReport({
    userName: 42,
    priority: 'Urgente',
    status: 'Cerrado',
    department: 'Desconocido',
    activity: 'no es una lista',
  }, 0, { now })

  assert.equal(report.userName, '')
  assert.equal(report.priority, 'Media')
  assert.equal(report.status, 'Pendiente')
  assert.equal(report.department, 'Operaciones')
  assert.deepEqual(report.activity, [])
})

test('crea reportes con folio incremental y dependencias controlables', () => {
  const ids = ['reporte-nuevo', 'actividad-nueva']
  const report = createReport({
    userName: 'María',
    contactEmail: 'maria@empresa.com',
    contactPhone: '5555',
    department: 'Sistemas',
    description: 'Sin acceso',
    priority: 'Alta',
  }, [{ ticketNumber: 8 }], {
    now,
    idFactory: () => ids.shift(),
  })

  assert.equal(report.id, 'reporte-nuevo')
  assert.equal(report.ticketNumber, 9)
  assert.equal(report.createdAt, now)
  assert.equal(report.activity[0].id, 'actividad-nueva')
})

test('genera contacto y departamento sugeridos para entradas vacías y conocidas', () => {
  assert.equal(createContactEmail(''), 'usuario@empresa.com')
  assert.equal(suggestDepartment('Falla de fibra e internet'), 'Infraestructura')
  assert.equal(suggestDepartment(), 'Operaciones')
})

test('aplica filtros combinados y ordena por prioridad', () => {
  const reports = [
    normalizeReport({
      id: '1',
      ticketNumber: 1,
      userName: 'Ana',
      contactEmail: 'ana@empresa.com',
      contactPhone: '111',
      department: 'Sistemas',
      description: 'Acceso',
      priority: 'Baja',
      status: 'Pendiente',
      technician: 'Carlos',
      createdAt: '2026-07-28T12:00:00.000Z',
    }, 0, { now }),
    normalizeReport({
      id: '2',
      ticketNumber: 2,
      userName: 'Bruno',
      contactEmail: 'bruno@empresa.com',
      contactPhone: '222',
      department: 'Sistemas',
      description: 'Correo',
      priority: 'Alta',
      status: 'Pendiente',
      technician: 'Carlos',
      createdAt: now,
    }, 1, { now }),
  ]

  const filtered = filterReports(reports, {
    query: 'sistemas',
    status: 'Pendiente',
    priority: 'Todas',
    technician: 'Carlos',
  })

  assert.deepEqual(sortReports(filtered, 'priority').map((report) => report.id), ['2', '1'])
  assert.deepEqual(filterReports(reports, { query: 'INC-0002' }).map((report) => report.id), ['2'])
})

test('acepta transiciones entre estados válidos y rechaza valores ajenos', () => {
  assert.equal(canTransitionStatus('Pendiente', 'Resuelto'), true)
  assert.equal(canTransitionStatus('Resuelto', 'En progreso'), true)
  assert.equal(canTransitionStatus('Pendiente', 'Cerrado'), false)
})

test('considera vigente el SLA en el límite exacto y vencido después', () => {
  const report = normalizeReport({
    createdAt: '2026-07-29T10:00:00.000Z',
    priority: 'Alta',
    status: 'Pendiente',
  }, 0, { now })
  const sla = { Alta: 2 }

  assert.equal(getSlaDeadline(report, sla).toISOString(), now)
  assert.equal(isSlaOverdue(report, sla, now), false)
  assert.equal(isSlaOverdue(report, sla, '2026-07-29T12:00:00.001Z'), true)
  assert.equal(isSlaOverdue({ ...report, status: 'Resuelto' }, sla, '2026-07-30T12:00:00.000Z'), false)
})
