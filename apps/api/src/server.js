import { buildApp } from './app.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const app = await buildApp({ config })
let closing = false

async function shutdown(signal) {
  if (closing) return
  closing = true
  app.log.info({ signal }, 'Cerrando SmartSupport API')
  await app.close()
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))

try {
  await app.listen({ host: config.host, port: config.port })
} catch (error) {
  app.log.error({ err: error }, 'No se pudo iniciar SmartSupport API')
  process.exitCode = 1
}
