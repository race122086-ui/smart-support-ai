import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConfig } from '../src/config.js'

test('carga valores predeterminados seguros para desarrollo local', () => {
  assert.deepEqual(loadConfig({}), {
    host: '127.0.0.1',
    port: 3000,
    corsOrigin: 'http://localhost:5173',
    logLevel: 'info',
  })
})

test('rechaza puerto, origen y nivel de log inválidos', () => {
  assert.throws(() => loadConfig({ API_PORT: '0' }), /API_PORT/)
  assert.throws(() => loadConfig({ API_CORS_ORIGIN: 'archivo-local' }), /API_CORS_ORIGIN/)
  assert.throws(() => loadConfig({ API_LOG_LEVEL: 'verbose' }), /API_LOG_LEVEL/)
})
