import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConfig } from '../src/config.js'

test('carga valores predeterminados seguros para desarrollo local', () => {
  assert.deepEqual(loadConfig({}), {
    host: '127.0.0.1',
    port: 3000,
    corsOrigin: 'http://localhost:5173',
    logLevel: 'info',
    databaseUrl: null,
    dataFile: '.smartsupport/data.json',
    storageDriver: 'local',
    s3: {
      bucket: null, region: null, accessKeyId: null, secretAccessKey: null,
      endpoint: null, forcePathStyle: false, prefix: '',
    },
    attachment: {
      maxBytes: 10485760,
      maxCount: 5,
      localDir: '.smartsupport/uploads',
    },
    smtp: {
      host: null, port: 587, user: null, password: null, from: null,
      secure: false, frontendUrl: null, enabled: false,
    },
    production: false,
  })
})

test('rechaza puerto, origen y nivel de log inválidos', () => {
  assert.throws(() => loadConfig({ API_PORT: '0' }), /API_PORT/)
  assert.throws(() => loadConfig({ PORT: '70000', API_PORT: '3000' }), /PORT/)
  assert.throws(() => loadConfig({ API_CORS_ORIGIN: 'archivo-local' }), /API_CORS_ORIGIN/)
  assert.throws(() => loadConfig({ API_CORS_ORIGIN: '*' }), /API_CORS_ORIGIN/)
  assert.throws(() => loadConfig({ API_LOG_LEVEL: 'verbose' }), /API_LOG_LEVEL/)
})

test('prioriza PORT y escucha externamente en plataformas de despliegue', () => {
  const config = loadConfig({
    PORT: '8080',
    API_PORT: '3000',
    API_CORS_ORIGIN: 'https://app.example.com',
    DATABASE_URL: 'postgresql://user:password@database.example.com:5432/smartsupport',
  })

  assert.equal(config.port, 8080)
  assert.equal(config.host, '0.0.0.0')
  assert.equal(config.corsOrigin, 'https://app.example.com')
  assert.equal(config.databaseUrl, 'postgresql://user:password@database.example.com:5432/smartsupport')
})

test('usa un archivo local solo cuando DATABASE_URL no existe', () => {
  const config = loadConfig({ API_DATA_FILE: '/tmp/smartsupport-prueba.json' })

  assert.equal(config.databaseUrl, null)
  assert.equal(config.dataFile, '/tmp/smartsupport-prueba.json')
})

test('permite que API_HOST sobrescriba el host inferido', () => {
  assert.equal(loadConfig({ PORT: '8080', API_HOST: '127.0.0.1' }).host, '127.0.0.1')
})

test('exige PostgreSQL y almacenamiento S3 en producción', () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: 'production' }),
    /DATABASE_URL es obligatoria en producción/
  )
  assert.throws(
    () => loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://local:test@127.0.0.1:5432/smartsupport_test' }),
    /STORAGE_DRIVER debe ser s3 en producción/
  )
  assert.throws(
    () => loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://local:test@127.0.0.1:5432/smartsupport_test',
      STORAGE_DRIVER: 's3',
    }),
    /S3_BUCKET/
  )
  assert.equal(
    loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://local:test@127.0.0.1:5432/smartsupport_test',
      STORAGE_DRIVER: 's3',
      S3_BUCKET: 'smart-support-uploads',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'fixture',
      S3_SECRET_ACCESS_KEY: 'fixture',
    }).databaseUrl,
    'postgresql://local:test@127.0.0.1:5432/smartsupport_test'
  )
})

test('carga la configuración de adjuntos y S3 con valores por defecto', () => {
  const local = loadConfig({ ATTACHMENT_MAX_BYTES: '2048' })
  assert.equal(local.attachment.maxBytes, 2048)
  assert.equal(local.attachment.maxCount, 5)
  assert.equal(local.attachment.localDir, '.smartsupport/uploads')
  assert.equal(local.storageDriver, 'local')

  const s3 = loadConfig({
    STORAGE_DRIVER: 's3',
    S3_BUCKET: 'bucket-prueba',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'key-fixture',
    S3_SECRET_ACCESS_KEY: 'secret-fixture',
    S3_ENDPOINT: 'https://minio.local:9000',
    S3_FORCE_PATH_STYLE: 'true',
    S3_PREFIX: 'adjuntos/',
  })
  assert.equal(s3.s3.bucket, 'bucket-prueba')
  assert.equal(s3.s3.endpoint, 'https://minio.local:9000')
  assert.equal(s3.s3.forcePathStyle, true)
  assert.equal(s3.s3.prefix, 'adjuntos')
  assert.throws(() => loadConfig({ ATTACHMENT_MAX_COUNT: '0' }), /ATTACHMENT_MAX_COUNT/)
  assert.throws(() => loadConfig({ ATTACHMENT_MAX_BYTES: 'x' }), /ATTACHMENT_MAX_BYTES/)
})

test('valida y carga SMTP y el origen web opcional', () => {
  const config = loadConfig({
    SMTP_HOST: 'smtp.example.com', SMTP_PORT: '465', SMTP_USER: 'mailer',
    SMTP_PASSWORD: 'valor-solo-fixture', SMTP_FROM: 'Soporte <support@example.com>',
    SMTP_SECURE: 'true', FRONTEND_URL: 'https://app.example.com/ruta-ignorada',
  })
  assert.equal(config.smtp.enabled, true)
  assert.equal(config.smtp.port, 465)
  assert.equal(config.smtp.secure, true)
  assert.equal(config.smtp.frontendUrl, 'https://app.example.com')
  assert.throws(() => loadConfig({ SMTP_PORT: '70000' }), /SMTP_PORT/)
  assert.throws(() => loadConfig({ SMTP_SECURE: 'yes' }), /SMTP_SECURE/)
  assert.throws(() => loadConfig({ WEB_APP_URL: 'archivo-local' }), /WEB_APP_URL/)
})
