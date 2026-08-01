import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { MemoryRepository } from '../src/repositories/memory-repository.js'
import { LocalAttachmentStorage } from '../src/storage/attachment-storage.js'
import { AttachmentService } from '../src/services/attachment-service.js'
import { SupportService } from '../src/services/support-service.js'

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
const html = Buffer.from('<!doctype html><script>alert(1)</script>', 'utf8')

const admin = { id: 'admin-1', name: 'Admin', email: 'admin@test', role: 'ADMIN' }
const user1 = { id: 'user-1', name: 'Usuario Uno', email: 'usuario1@test', role: 'USER' }
const user2 = { id: 'user-2', name: 'Usuario Dos', email: 'usuario2@test', role: 'USER' }
const techAna = { id: 'tech-1', name: 'Ana Torres', email: 'ana@test', role: 'TECHNICIAN', technicianId: 'tecnico-ana-torres' }

const validReport = {
  userName: 'Usuario Uno',
  contactEmail: 'usuario1@test',
  contactPhone: '+52 55 0000 0042',
  department: 'Sistemas',
  description: 'No puede iniciar sesión',
  priority: 'Alta',
}

async function createContext(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'smartsupport-svc-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  let sequence = 0
  const repository = new MemoryRepository()
  const support = new SupportService(repository, {
    clock: () => new Date('2026-07-29T12:00:00.000Z'),
    idFactory: () => `id-${++sequence}`,
  })
  const storage = new LocalAttachmentStorage(dir)
  const attachments = new AttachmentService(repository, storage, {
    support,
    maxBytes: options.maxBytes || 1024 * 1024,
    maxCount: options.maxCount ?? 3,
  })
  return { repository, support, storage, attachments, dir }
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

test('subir adjunto guarda metadatos, actividad y notificación sin exponer claves', async (t) => {
  const { repository, attachments } = await createContext(t)
  const report = await attachments.support.createReport(validReport, user1)

  const result = await attachments.upload(report.id, { filename: 'captura.png', buffer: png }, admin)

  assert.equal(result.fileName, 'captura.png')
  assert.equal(result.mimeType, 'image/png')
  assert.equal(result.size, png.length)
  assert.ok(!('storageKey' in result))
  assert.ok(!('storedName' in result))

  const stored = await repository.listAttachments(report.id)
  assert.equal(stored.length, 1)
  assert.equal(stored[0].reportId, report.id)
  assert.ok(stored[0].storageKey.includes(report.id))

  const detail = await repository.getReport(report.id)
  assert.ok(detail.activity.some((item) => item.message.startsWith('Se adjuntó el archivo')))

  const notifications = await repository.listNotifications(user1.id)
  assert.ok(notifications.some((item) => item.type === 'attachment_added'))
})

test('respeta límites de cantidad y formato, sin dejar archivos huérfanos', async (t) => {
  const { attachments, dir } = await createContext(t, { maxCount: 1 })
  const report = await attachments.support.createReport(validReport, user1)

  await attachments.upload(report.id, { filename: 'a.png', buffer: png }, admin)
  await assert.rejects(
    attachments.upload(report.id, { filename: 'b.png', buffer: png }, admin),
    (error) => error.code === 'VALIDATION_ERROR' && /límite/.test(error.message)
  )
  await assert.rejects(
    attachments.upload(report.id, { filename: 'malware.html', buffer: html }, admin),
    (error) => error.code === 'VALIDATION_ERROR'
  )
  await assert.rejects(
    attachments.upload(report.id, { filename: 'grande.png', buffer: Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]) }, admin),
    (error) => error.code === 'VALIDATION_ERROR'
  )
  const remaining = await readdir(join(dir, 'attachments', report.id))
  assert.equal(remaining.length, 1)
})

test('aplica permisos por rol para subir, listar y descargar', async (t) => {
  const { attachments } = await createContext(t)
  const report = await attachments.support.createReport(validReport, user1)

  await assert.rejects(
    attachments.upload(report.id, { filename: 'x.png', buffer: png }, user2),
    (error) => error.code === 'FORBIDDEN'
  )
  await assert.rejects(
    attachments.list(report.id, user2),
    (error) => error.code === 'FORBIDDEN'
  )

  const uploaded = await attachments.upload(report.id, { filename: 'captura.png', buffer: png }, admin)
  const listed = await attachments.list(report.id, admin)
  assert.equal(listed.length, 1)
  assert.ok(listed.every((item) => !('storageKey' in item)))

  const { attachment, stream } = await attachments.download(report.id, uploaded.id, admin)
  assert.equal(attachment.mimeType, 'image/png')
  assert.deepEqual(await streamToBuffer(stream), png)

  await assert.rejects(
    attachments.download(report.id, uploaded.id, user2),
    (error) => error.code === 'FORBIDDEN'
  )
})

test('el técnico asignado adjunta y descarga, el no asignado no', async (t) => {
  const { attachments } = await createContext(t)
  const report = await attachments.support.createReport(validReport, user1)
  await attachments.support.assignTechnician(report.id, 'Ana Torres', admin)

  const uploaded = await attachments.upload(report.id, { filename: 'evidencia.png', buffer: png }, techAna)
  assert.equal(uploaded.mimeType, 'image/png')

  const { stream } = await attachments.download(report.id, uploaded.id, techAna)
  assert.deepEqual(await streamToBuffer(stream), png)

  const otherTech = { id: 'tech-2', name: 'Carlos Ruiz', email: 'carlos@test', role: 'TECHNICIAN', technicianId: 'tecnico-carlos-ruiz' }
  await assert.rejects(
    attachments.upload(report.id, { filename: 'otro.png', buffer: png }, otherTech),
    (error) => error.code === 'FORBIDDEN'
  )
})

test('eliminar exige permiso y borra el binario del almacenamiento', async (t) => {
  const { repository, attachments } = await createContext(t)
  const report = await attachments.support.createReport(validReport, user1)
  const uploaded = await attachments.upload(report.id, { filename: 'foto.png', buffer: png }, user1)
  const storedKey = (await repository.listAttachments(report.id))[0].storageKey

  await assert.rejects(
    attachments.remove(report.id, uploaded.id, user2),
    (error) => error.code === 'FORBIDDEN'
  )
  assert.deepEqual(await attachments.storage.read(storedKey), png)

  await attachments.remove(report.id, uploaded.id, admin)
  assert.equal((await repository.listAttachments(report.id)).length, 0)
  await assert.rejects(attachments.storage.read(storedKey), { code: 'ENOENT' })
})

test('purgar binarios al eliminar un ticket', async (t) => {
  const { repository, attachments, dir } = await createContext(t)
  const report = await attachments.support.createReport(validReport, admin)
  await attachments.upload(report.id, { filename: 'a.png', buffer: png }, admin)
  await attachments.upload(report.id, { filename: 'b.png', buffer: png }, admin)

  await attachments.purgeReportBlobs(report.id, admin)
  assert.equal((await readdir(join(dir, 'attachments', report.id))).length, 0)

  await attachments.support.deleteReport(report.id, admin)
  assert.equal((await repository.listAttachments(report.id)).length, 0)
})

test('purgar binarios está restringido a administradores', async (t) => {
  const { attachments } = await createContext(t)
  const report = await attachments.support.createReport(validReport, user1)
  await attachments.upload(report.id, { filename: 'a.png', buffer: png }, admin)
  await assert.rejects(
    attachments.purgeReportBlobs(report.id, user1),
    (error) => error.code === 'FORBIDDEN'
  )
})
