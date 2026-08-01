const allowedLogLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']

function parseSmtpPort(value) {
  if (!value) return 587
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new TypeError('SMTP_PORT debe ser un entero entre 1 y 65535')
  }
  return port
}

function parseBoolean(value, name) {
  if (value === undefined || value === '') return false
  if (value === 'true') return true
  if (value === 'false') return false
  throw new TypeError(`${name} debe ser true o false`)
}

function optionalWebUrl(environment) {
  const value = environment.FRONTEND_URL || environment.WEB_APP_URL
  if (!value) return null
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    return url.origin
  } catch {
    throw new TypeError('FRONTEND_URL o WEB_APP_URL debe ser un origen HTTP o HTTPS válido')
  }
}

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
  const production = environment.NODE_ENV === 'production'
  if (production && !environment.DATABASE_URL) {
    throw new TypeError('DATABASE_URL es obligatoria en producción')
  }
  const smtp = {
    host: environment.SMTP_HOST?.trim() || null,
    port: parseSmtpPort(environment.SMTP_PORT),
    user: environment.SMTP_USER?.trim() || null,
    password: environment.SMTP_PASSWORD || null,
    from: environment.SMTP_FROM?.trim() || null,
    secure: parseBoolean(environment.SMTP_SECURE, 'SMTP_SECURE'),
    frontendUrl: optionalWebUrl(environment),
  }
  smtp.enabled = Boolean(smtp.host && smtp.user && smtp.password && smtp.from)
  return {
    production,
    host: environment.API_HOST || (environment.PORT ? '0.0.0.0' : '127.0.0.1'),
    port: parsePort(environment.PORT || environment.API_PORT),
    corsOrigin: parsedOrigin,
    logLevel,
    databaseUrl: environment.DATABASE_URL || null,
    dataFile: environment.API_DATA_FILE || '.smartsupport/data.json',
    smtp,
  }
}
