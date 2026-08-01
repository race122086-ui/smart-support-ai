import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  LocalAttachmentStorage,
  S3AttachmentStorage,
  buildAttachmentKey,
  createAttachmentStorage,
} from '../src/storage/attachment-storage.js'

async function withTempDir(run) {
  const dir = await mkdtemp(join(tmpdir(), 'smartsupport-storage-'))
  try {
    await run(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('guardar, leer, transmitir y eliminar con almacenamiento local', async () => {
  await withTempDir(async (dir) => {
    const storage = new LocalAttachmentStorage(dir)
    const key = buildAttachmentKey('reporte-1', 'archivo.png')
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47])

    await storage.save(key, bytes)
    assert.deepEqual(await storage.read(key), bytes)

    const stream = await storage.openReadStream(key)
    const chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    assert.deepEqual(Buffer.concat(chunks), bytes)

    await storage.remove(key)
    await assert.rejects(storage.read(key), { code: 'ENOENT' })
  })
})

test('rechaza rutas internas que escapan del directorio base', async () => {
  await withTempDir(async (dir) => {
    const storage = new LocalAttachmentStorage(dir)
    await assert.rejects(
      storage.save('../../escapar.txt', Buffer.from('x')),
      (error) => error.code === 'INVALID_STORAGE_KEY'
    )
    await assert.rejects(
      storage.openReadStream('/etc/passwd'),
      (error) => error.code === 'INVALID_STORAGE_KEY'
    )
  })
})

test('la clave de almacenamiento no revela rutas locales', () => {
  const key = buildAttachmentKey('reporte-1', 'adjunto.pdf')
  assert.equal(key, 'attachments/reporte-1/adjunto.pdf')
  assert.ok(!key.includes('..'))
})

test('la fábrica selecciona almacenamiento local y S3 según la configuración', () => {
  const local = createAttachmentStorage({ storageDriver: 'local', attachment: { localDir: '.smartsupport/uploads' } })
  assert.ok(local instanceof LocalAttachmentStorage)

  const s3 = createAttachmentStorage({
    storageDriver: 's3',
    s3: { bucket: 'bucket', region: 'us-east-1', accessKeyId: 'k', secretAccessKey: 's', prefix: 'adjuntos' },
  })
  assert.ok(s3 instanceof S3AttachmentStorage)
  assert.equal(s3.keyFor('attachments/r/1.png'), 'adjuntos/attachments/r/1.png')
})

test('el almacenamiento S3 no registra credenciales en la clave', () => {
  const s3 = createAttachmentStorage({
    storageDriver: 's3',
    s3: { bucket: 'bucket', region: 'us-east-1', accessKeyId: 'secreto', secretAccessKey: 'supersecreto' },
  })
  const key = s3.keyFor(buildAttachmentKey('r', 'f.png'))
  assert.ok(!key.includes('secreto'))
  assert.ok(!key.includes('supersecreto'))
})

test('persiste archivos sin dejar entradas sobrantes al eliminar', async () => {
  await withTempDir(async (dir) => {
    const storage = new LocalAttachmentStorage(dir)
    await storage.save(buildAttachmentKey('r', 'a.txt'), Buffer.from('a'))
    await storage.save(buildAttachmentKey('r', 'b.txt'), Buffer.from('b'))
    assert.equal((await readdir(join(dir, 'attachments', 'r'))).length, 2)
    await storage.remove(buildAttachmentKey('r', 'a.txt'))
    assert.equal((await readdir(join(dir, 'attachments', 'r'))).length, 1)
  })
})
