import { extname } from 'node:path'
import { validationError } from '../errors/domain-error.js'

const signatures = {
  'image/png': {
    extensions: ['.png'],
    sequences: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg'],
    sequences: [[0xff, 0xd8, 0xff]],
  },
  'image/gif': {
    extensions: ['.gif'],
    sequences: [[0x47, 0x49, 0x46, 0x38]],
  },
  'image/webp': {
    extensions: ['.webp'],
    sequences: [[0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50]],
  },
  'application/pdf': {
    extensions: ['.pdf'],
    sequences: [[0x25, 0x50, 0x44, 0x46, 0x2d]],
  },
}

const textType = {
  mime: 'text/plain',
  extensions: ['.txt', '.csv', '.md', '.log', '.json'],
}

export function detectAttachmentMimeType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null
  for (const [mime, spec] of Object.entries(signatures)) {
    if (spec.sequences.some((sequence) =>
      sequence.every((byte, index) => byte === null || buffer[index] === byte)
    )) {
      return mime
    }
  }
  return null
}

export function isLikelyText(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false
  const sample = buffer.subarray(0, 8192)
  for (const byte of sample) {
    if (byte === 0x00) return false
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) return false
    if (byte === 0x7f) return false
  }
  return true
}

export function sanitizeFileName(value) {
  if (typeof value !== 'string') return ''
  const base = value.split(/[\\/]/).pop() || ''
  return base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255)
}

export function attachmentExtension(mimeType) {
  if (mimeType === textType.mime) return '.txt'
  return signatures[mimeType]?.extensions?.[0] || '.txt'
}

export function allowedExtensionList() {
  return [...new Set([
    ...Object.values(signatures).flatMap((spec) => spec.extensions),
    ...textType.extensions,
  ])]
}

export function inspectAttachmentFile({ fileName, buffer, maxBytes }) {
  const name = sanitizeFileName(fileName)
  if (!name) {
    throw validationError('El archivo no tiene un nombre válido', [
      { field: 'file', reason: 'Nombre de archivo inválido' },
    ])
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw validationError('El archivo está vacío', [
      { field: 'file', reason: 'Archivo vacío' },
    ])
  }
  if (buffer.length > maxBytes) {
    throw validationError(`El archivo supera el límite de ${maxBytes} bytes`, [
      { field: 'file', reason: 'Tamaño excedido' },
    ])
  }
  const extension = extname(name).toLowerCase()
  const detected = detectAttachmentMimeType(buffer)
  if (detected) {
    if (!signatures[detected].extensions.includes(extension)) {
      throw validationError('La extensión no coincide con el contenido del archivo', [
        { field: 'file', reason: 'Extensión inválida' },
      ])
    }
    return { fileName: name, mimeType: detected, size: buffer.length }
  }
  if (textType.extensions.includes(extension) && isLikelyText(buffer)) {
    return { fileName: name, mimeType: textType.mime, size: buffer.length }
  }
  throw validationError('El tipo de archivo no está permitido', [
    { field: 'file', reason: 'Formato no permitido' },
  ])
}

export function attachmentDisposition(fileName) {
  const ascii = String(fileName || 'adjunto')
    .replace(/[\u0080-\uffff]/g, '_')
    .replace(/["\\]/g, '_')
    .replace(/[\r\n]/g, '')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

export function formatBytes(value) {
  const bytes = Number(value) || 0
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
