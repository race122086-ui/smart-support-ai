const allowedLogLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']

function parsePort(value) {
  const port = Number(value || 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError('PORT o API_PORT debe ser un entero entre 1 y 65535')
  }
  return port
}

export function loadConfig(environment = process.env) {
  const logLevel = environment.API_LOG_LEVEL || 'info'
  if (!allowedLogLevels.includes(logLevel)) {
    throw new TypeError(`API_LOG_LEVEL debe ser uno de: ${allowedLogLevels.join(', ')}`)
  }
  const corsOrigin = environment.API_CORS_ORIGIN || 'http://localhost:5173'
  let parsedOrigin
  try {
    parsedOrigin = new URL(corsOrigin).origin
  } catch {
    throw new TypeError('API_CORS_ORIGIN debe ser un origen HTTP o HTTPS válido')
  }
  if (!['http:', 'https:'].includes(new URL(corsOrigin).protocol)) {
    throw new TypeError('API_CORS_ORIGIN debe usar HTTP o HTTPS')
  }
  return {
    host: environment.API_HOST || (environment.PORT ? '0.0.0.0' : '127.0.0.1'),
    port: parsePort(environment.PORT || environment.API_PORT),
    corsOrigin: parsedOrigin,
    logLevel,
    databaseUrl: environment.DATABASE_URL || null,
    dataFile: environment.API_DATA_FILE || '.smartsupport/data.json',
  }
}
