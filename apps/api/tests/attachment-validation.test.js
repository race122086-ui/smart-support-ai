import assert from 'node:assert/strict'
import test from 'node:test'
import {
  allowedExtensionList,
  attachmentDisposition,
  detectAttachmentMimeType,
  inspectAttachmentFile,
  isLikelyText,
  sanitizeFileName,
} from '../src/services/attachment-validation.js'

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d])
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49])
const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00])
const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a])
const text = Buffer.from('Folio INC-0001\nSegunda línea en español', 'utf8')

test('detecta la firma real (magic bytes) de formatos permitidos', () => {
  assert.equal(detectAttachmentMimeType(png), 'image/png')
  assert.equal(detectAttachmentMimeType(jpeg), 'image/jpeg')
  assert.equal(detectAttachmentMimeType(gif), 'image/gif')
  assert.equal(detectAttachmentMimeType(webp), 'image/webp')
  assert.equal(detectAttachmentMimeType(pdf), 'application/pdf')
  assert.equal(detectAttachmentMimeType(text), null)
})

test('clasifica texto legible y descarta binarios arbitrarios', () => {
  assert.equal(isLikelyText(text), true)
  assert.equal(isLikelyText(Buffer.from([0x68, 0x00, 0x69, 0x00])), false)
  assert.equal(isLikelyText(Buffer.alloc(0)), false)
})

test('acepta pares válidos de extensión y contenido', () => {
  const result = inspectAttachmentFile({ fileName: 'captura.png', buffer: png, maxBytes: 1024 })
  assert.deepEqual(result, { fileName: 'captura.png', mimeType: 'image/png', size: png.length })

  const reporte = inspectAttachmentFile({ fileName: 'reporte.pdf', buffer: pdf, maxBytes: 1024 })
  assert.equal(reporte.mimeType, 'application/pdf')

  const texto = inspectAttachmentFile({ fileName: 'nota.csv', buffer: text, maxBytes: 1024 })
  assert.equal(texto.mimeType, 'text/plain')
})

test('rechaza extensión que no coincide con el contenido', () => {
  assert.throws(
    () => inspectAttachmentFile({ fileName: 'foto.jpg', buffer: png, maxBytes: 1024 }),
    (error) => error.code === 'VALIDATION_ERROR'
      && error.details?.[0]?.reason === 'Extensión inválida'
  )
})

test('rechaza formatos no permitidos (HTML, scripts, binarios desconocidos)', () => {
  const html = Buffer.from('<!doctype html><script>alert(1)</script>', 'utf8')
  assert.throws(
    () => inspectAttachmentFile({ fileName: 'pagina.html', buffer: html, maxBytes: 1024 }),
    (error) => error.details?.[0]?.reason === 'Formato no permitido'
  )
  assert.throws(
    () => inspectAttachmentFile({ fileName: 'script.js', buffer: text, maxBytes: 1024 }),
    (error) => error.details?.[0]?.reason === 'Formato no permitido'
  )
  assert.throws(
    () => inspectAttachmentFile({ fileName: 'archivo.exe', buffer: Buffer.from([0x4d, 0x5a, 0x90]), maxBytes: 1024 }),
    (error) => error.details?.[0]?.reason === 'Formato no permitido'
  )
})

test('rechaza archivos vacíos y que superan el límite de tamaño', () => {
  assert.throws(
    () => inspectAttachmentFile({ fileName: 'vacio.png', buffer: Buffer.alloc(0), maxBytes: 10 }),
    (error) => error.details?.[0]?.reason === 'Archivo vacío'
  )
  assert.throws(
    () => inspectAttachmentFile({ fileName: 'grande.png', buffer: Buffer.concat([png, Buffer.alloc(50)]), maxBytes: 40 }),
    (error) => error.details?.[0]?.reason === 'Tamaño excedido'
  )
})

test('sanitiza nombres de archivo y elimina rutas', () => {
  assert.equal(sanitizeFileName('C:\\fakepath\\reporte.png'), 'reporte.png')
  assert.equal(sanitizeFileName('../../etc/passwd.txt'), 'passwd.txt')
  assert.equal(sanitizeFileName('  documento.pdf  '), 'documento.pdf')
  assert.equal(sanitizeFileName(''), '')
  assert.equal(sanitizeFileName(null), '')
})

test('genera Content-Disposition segura sin inyección de cabeceras', () => {
  const disposition = attachmentDisposition('informe "final"\\.txt')
  assert.match(disposition, /^attachment; filename=/)
  assert.equal((disposition.match(/"/g) || []).length, 2)
  assert.ok(!disposition.includes('\r') && !disposition.includes('\n'))
  const unicode = attachmentDisposition('factura 2026.pdf')
  assert.match(unicode, /filename\*=UTF-8''/)
})

test('lista de extensiones permitidas cubre los formatos soportados', () => {
  const extensions = allowedExtensionList()
  for (const expected of ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf', '.txt', '.csv']) {
    assert.ok(extensions.includes(expected))
  }
})
