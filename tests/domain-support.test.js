import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeBackup } from '../src/domain/backups.js'
import {
  markAllNotificationsAsRead,
  normalizeNotifications,
} from '../src/domain/notifications.js'
import { normalizeSettings } from '../src/domain/settings.js'
import { escapeHtml } from '../src/domain/text.js'

test('aplica configuración predeterminada a valores vacíos o inválidos', () => {
  assert.deepEqual(normalizeSettings(null), {
    profile: { name: 'Administrador', role: 'Administrador' },
    technicians: ['Ana Torres', 'Carlos Ruiz', 'Laura Méndez'],
    sla: { Baja: 72, Media: 24, Alta: 8 },
  })

  const settings = normalizeSettings({
    profile: { name: '', role: 'Dueño' },
    technicians: [' Ana ', '', 7, 'Ana'],
    sla: { Baja: 0, Media: 12, Alta: 900 },
  })
  assert.deepEqual(settings.technicians, ['Ana'])
  assert.deepEqual(settings.sla, { Baja: 72, Media: 12, Alta: 8 })
})

test('normaliza notificaciones y las marca como leídas sin mutar la entrada', () => {
  const notifications = normalizeNotifications([
    { message: 'Nueva', read: 'sí', createdAt: 'fecha inválida' },
  ], { now: '2026-07-29T12:00:00.000Z' })
  const read = markAllNotificationsAsRead(notifications)

  assert.equal(notifications[0].read, false)
  assert.equal(read[0].read, true)
  assert.notEqual(read[0], notifications[0])
})

test('rechaza respaldos sin lista de reportes', () => {
  assert.throws(() => normalizeBackup({ settings: {} }), /lista de reportes/)
  assert.throws(() => normalizeBackup(null), /lista de reportes/)
})

test('normaliza respaldos válidos y completa secciones ausentes', () => {
  const backup = normalizeBackup({ reports: [{}] }, {
    now: '2026-07-29T12:00:00.000Z',
  })

  assert.equal(backup.reports.length, 1)
  assert.equal(backup.reports[0].status, 'Pendiente')
  assert.deepEqual(backup.notifications, [])
  assert.equal(backup.settings.profile.role, 'Administrador')
})

test('escapa texto de usuario antes de interpolarlo en HTML', () => {
  assert.equal(
    escapeHtml('<img src="x" onerror=\'alert(1)\'>&'),
    '&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;'
  )
  assert.equal(escapeHtml(null), '')
})
