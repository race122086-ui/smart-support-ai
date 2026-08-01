import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { DomainError } from '../errors/domain-error.js'

export function buildAttachmentKey(reportId, storedName) {
  return `attachments/${reportId}/${storedName}`
}

export class LocalAttachmentStorage {
  constructor(baseDir) {
    this.baseDir = resolve(baseDir || '.smartsupport/uploads')
  }

  resolvePath(key) {
    const target = resolve(this.baseDir, key)
    const prefix = `${this.baseDir}${this.baseDir.endsWith('/') ? '' : '/'}`
    if (target !== this.baseDir && !target.startsWith(prefix)) {
      throw new DomainError('INVALID_STORAGE_KEY', 'Ruta de almacenamiento inválida', 500)
    }
    return target
  }

  async save(key, buffer) {
    const target = this.resolvePath(key)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, buffer)
  }

  async read(key) {
    return readFile(this.resolvePath(key))
  }

  async openReadStream(key) {
    return createReadStream(this.resolvePath(key))
  }

  async remove(key) {
    await rm(this.resolvePath(key), { force: true })
  }
}

export class S3AttachmentStorage {
  constructor(config = {}) {
    this.bucket = config.bucket
    this.prefix = config.prefix || ''
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: config.forcePathStyle || false,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })
  }

  keyFor(key) {
    return this.prefix ? `${this.prefix}/${key}` : key
  }

  async save(key, buffer) {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: this.keyFor(key),
      Body: buffer,
      ContentLength: buffer.length,
    }))
  }

  async read(key) {
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.keyFor(key),
    }))
    return Buffer.from(await response.Body.transformToByteArray())
  }

  async openReadStream(key) {
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.keyFor(key),
    }))
    return response.Body
  }

  async remove(key) {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: this.keyFor(key),
    }))
  }
}

export function createAttachmentStorage(config) {
  if (config.storageDriver === 's3') return new S3AttachmentStorage(config.s3)
  return new LocalAttachmentStorage(config.attachment.localDir)
}
