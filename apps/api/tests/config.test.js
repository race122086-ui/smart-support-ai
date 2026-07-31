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
