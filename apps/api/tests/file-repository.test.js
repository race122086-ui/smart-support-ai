import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { FileRepository } from '../src/repositories/file-repository.js'

async function temporaryFile(t) {
  const directory = await mkdtemp(join(tmpdir(), 'smartsupport-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return join(directory, 'data.json')
}

test('conserva los datos locales después de volver a abrir el repositorio', async (t) => {
  const filePath = await temporaryFile(t)
  const first = new FileRepository(filePath)
  await first.saveReport({ id: 'reporte-persistente', ticketNumber: 8 })
  await first.disconnect()

  const reopened = new FileRepository(filePath)
  await reopened.connect()

  assert.equal((await reopened.listReports())[0].id, 'reporte-persistente')
})

test('persiste una transacción exitosa y no escribe una transacción fallida', async (t) => {
  const filePath = await temporaryFile(t)
  const repository = new FileRepository(filePath)
  await repository.saveReport({ id: 'original', ticketNumber: 1 })

  await assert.rejects(
    repository.transaction(async (transaction) => {
      await transaction.saveReport({ id: 'no-guardar', ticketNumber: 2 })
      throw new Error('fallo intencional')
    }),
    /fallo intencional/
  )

  const stored = JSON.parse(await readFile(filePath, 'utf8'))
  assert.deepEqual(stored.reports.map((report) => report.id), ['original'])
})

test('rechaza un archivo local alterado sin sobrescribirlo', async (t) => {
  const filePath = await temporaryFile(t)
  await writeFile(filePath, '{"reports":"dato inválido"}', 'utf8')
  const repository = new FileRepository(filePath)

  await assert.rejects(repository.connect(), /estructura válida/)
  assert.equal(await readFile(filePath, 'utf8'), '{"reports":"dato inválido"}')
})
