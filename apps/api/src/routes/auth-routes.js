import { clearSessionCookie, serializeSessionCookie } from '../auth/auth-service.js'
import { DomainError } from '../errors/domain-error.js'

const loginAttempts = new Map()
const windowMs = 15 * 60 * 1000
const maxAttempts = 5

const authErrorResponses = {
  400: { $ref: 'Error#' },
  401: { $ref: 'Error#' },
  403: { $ref: 'Error#' },
  409: { $ref: 'Error#' },
  422: { $ref: 'Error#' },
  429: { $ref: 'Error#' },
}

const userProperties = {
  id: { type: 'string' },
  name: { type: 'string' },
  email: { type: 'string', format: 'email' },
  role: { type: 'string', enum: ['ADMIN', 'TECHNICIAN', 'USER'] },
  active: { type: 'boolean' },
  createdAt: { type: ['string', 'null'] },
  updatedAt: { type: ['string', 'null'] },
}

const userResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'email', 'role', 'active'],
  properties: userProperties,
}

const sessionResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['user', 'csrfToken'],
  properties: {
    user: userResponse,
    csrfToken: { type: 'string' },
  },
}

function rateKey(request, email = '') {
  return `${request.ip}:${String(email).trim().toLowerCase()}`
}

function checkRateLimit(key, now) {
  const previous = loginAttempts.get(key)
  const item = !previous || now - previous.startedAt >= windowMs
    ? { count: 0, startedAt: now }
    : previous
  if (item.count >= maxAttempts) {
    throw new DomainError('LOGIN_RATE_LIMITED', 'Demasiados intentos. Intenta más tarde', 429)
  }
  return item
}

export async function authRoutes(app, options) {
  const { authService, secureCookies } = options

  app.post('/auth/login', {
    schema: {
      tags: ['Autenticación'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254 },
          password: { type: 'string', minLength: 1, maxLength: 128 },
        },
      },
      response: { 200: sessionResponse, ...authErrorResponses },
    },
  }, async (request, reply) => {
    const key = rateKey(request, request.body.email)
    const now = Date.now()
    const attempt = checkRateLimit(key, now)
    try {
      const session = await authService.login(request.body.email, request.body.password)
      loginAttempts.delete(key)
      request.log.info({ userId: session.user.id, email: session.user.email }, 'Inicio de sesión exitoso')
      return reply
        .header('Set-Cookie', serializeSessionCookie(session.token, { secure: secureCookies }))
        .send({ user: session.user, csrfToken: session.csrfToken })
    } catch (error) {
      attempt.count += 1
      loginAttempts.set(key, attempt)
      request.log.warn({ email: String(request.body.email).trim().toLowerCase() }, 'Inicio de sesión rechazado')
      throw error
    }
  })

  app.get('/auth/me', {
    schema: { tags: ['Autenticación'], response: { 200: sessionResponse, ...authErrorResponses } },
  }, async (request) => {
    const session = await authService.me(request.headers.cookie)
    return { user: session.user, csrfToken: session.csrfToken }
  })

  app.post('/auth/logout', {
    schema: { tags: ['Autenticación'], response: { 204: { type: 'null' }, ...authErrorResponses } },
  }, async (request, reply) => {
    await authService.logout(request.headers.cookie, request.headers['x-csrf-token'])
    request.log.info({ userId: request.user?.id }, 'Cierre de sesión')
    return reply
      .header('Set-Cookie', clearSessionCookie({ secure: secureCookies }))
      .code(204)
      .send()
  })

  app.get('/users', {
    schema: {
      tags: ['Usuarios'],
      response: { 200: { type: 'array', items: userResponse }, ...authErrorResponses },
    },
  }, async () => authService.listUsers())

  app.post('/users', {
    schema: {
      tags: ['Usuarios'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'email', 'password', 'role'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120, pattern: '\\S' },
          email: { type: 'string', format: 'email', maxLength: 254 },
          password: { type: 'string', minLength: 12, maxLength: 128 },
          role: { type: 'string', enum: ['ADMIN', 'TECHNICIAN', 'USER'] },
          active: { type: 'boolean' },
        },
      },
      response: { 201: userResponse, ...authErrorResponses },
    },
  }, async (request, reply) => {
    const user = await authService.createUser(request.body)
    request.log.info({ actorId: request.user.id, userId: user.id, role: user.role }, 'Usuario creado')
    return reply.code(201).send(user)
  })

  app.patch('/users/:id', {
    schema: {
      tags: ['Usuarios'],
      params: {
        type: 'object',
        additionalProperties: false,
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120, pattern: '\\S' },
          email: { type: 'string', format: 'email', maxLength: 254 },
          password: { type: 'string', minLength: 12, maxLength: 128 },
          role: { type: 'string', enum: ['ADMIN', 'TECHNICIAN', 'USER'] },
          active: { type: 'boolean' },
        },
      },
      response: { 200: userResponse, ...authErrorResponses },
    },
  }, async (request) => {
    const user = await authService.updateUser(request.params.id, request.body)
    request.log.info({ actorId: request.user.id, userId: user.id }, 'Usuario actualizado')
    return user
  })
}
