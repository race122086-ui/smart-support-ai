import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { DomainError } from '../errors/domain-error.js'

const scrypt = promisify(scryptCallback)
const roles = ['ADMIN', 'TECHNICIAN', 'USER']
const sessionDurationMs = 8 * 60 * 60 * 1000
export const sessionCookieName = 'smartsupport_session'

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : ''
}

export function validatePassword(password) {
  return typeof password === 'string'
    && password.length >= 12
    && password.length <= 128
    && /[a-záéíóúñ]/u.test(password)
    && /[A-ZÁÉÍÓÚÑ]/u.test(password)
    && /\d/u.test(password)
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex')
}

export async function hashPassword(password) {
  if (!validatePassword(password)) {
    throw new DomainError(
      'WEAK_PASSWORD',
      'La contraseña debe tener entre 12 y 128 caracteres e incluir mayúscula, minúscula y número',
      422
    )
  }
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, 64)
  return `scrypt$16384$8$1$${salt.toString('base64')}$${derived.toString('base64')}`
}

export async function verifyPassword(password, encoded) {
  const parts = typeof encoded === 'string' ? encoded.split('$') : []
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    await scrypt(String(password), randomBytes(16), 64)
    return false
  }
  try {
    const salt = Buffer.from(parts[4], 'base64')
    const expected = Buffer.from(parts[5], 'base64')
    const actual = await scrypt(String(password), salt, expected.length)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    active: user.active,
    createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
    updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt,
  }
}

export function serializeSessionCookie(token, { secure = false, maxAge = sessionDurationMs / 1000 } = {}) {
  return [
    `${sessionCookieName}=${encodeURIComponent(token)}`,
    'Path=/api/v1',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAge)}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ')
}

export function clearSessionCookie({ secure = false } = {}) {
  return serializeSessionCookie('', { secure, maxAge: 0 })
}

export function readSessionCookie(header = '') {
  const item = header.split(';').map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`))
  return item ? decodeURIComponent(item.slice(sessionCookieName.length + 1)) : null
}

export class AuthService {
  constructor(repository, options = {}) {
    this.repository = repository
    this.clock = options.clock || (() => new Date())
    this.idFactory = options.idFactory || randomUUID
  }

  async login(email, password) {
    const normalized = normalizeEmail(email)
    const user = normalized ? await this.repository.getUserByEmail(normalized) : null
    const valid = await verifyPassword(password, user?.passwordHash)
    if (!valid || !user?.active) {
      throw new DomainError('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos', 401)
    }
    const token = randomBytes(32).toString('base64url')
    const csrfToken = randomBytes(32).toString('base64url')
    const expiresAt = new Date(this.clock().getTime() + sessionDurationMs)
    await this.repository.removeExpiredSessions(this.clock())
    await this.repository.saveSession({
      id: this.idFactory(),
      tokenHash: digest(token),
      csrfHash: digest(csrfToken),
      userId: user.id,
      expiresAt: expiresAt.toISOString(),
      createdAt: this.clock().toISOString(),
    })
    return { user: publicUser(user), token, csrfToken, expiresAt: expiresAt.toISOString() }
  }

  async authenticate(cookieHeader, csrfToken, requireCsrf = false) {
    const token = readSessionCookie(cookieHeader)
    if (!token) throw new DomainError('AUTH_REQUIRED', 'Debes iniciar sesión', 401)
    const session = await this.repository.getSessionByTokenHash(digest(token))
    if (!session || new Date(session.expiresAt) <= this.clock() || !session.user.active) {
      if (session) await this.repository.removeSessionByTokenHash(digest(token))
      throw new DomainError('AUTH_REQUIRED', 'La sesión no es válida o expiró', 401)
    }
    if (requireCsrf && (!csrfToken || digest(csrfToken) !== session.csrfHash)) {
      throw new DomainError('CSRF_INVALID', 'La solicitud no superó la validación CSRF', 403)
    }
    const user = publicUser(session.user)
    if (user.role === 'TECHNICIAN') {
      const technician = (await this.repository.listTechnicians())
        .find((item) => item.userId === user.id)
      user.technicianId = technician?.id || null
    }
    return { user, csrfToken: requireCsrf ? csrfToken : undefined }
  }

  async me(cookieHeader) {
    const authenticated = await this.authenticate(cookieHeader)
    const token = readSessionCookie(cookieHeader)
    const csrfToken = randomBytes(32).toString('base64url')
    await this.repository.updateSessionCsrf(digest(token), digest(csrfToken))
    return { user: authenticated.user, csrfToken }
  }

  async logout(cookieHeader, csrfToken) {
    const token = readSessionCookie(cookieHeader)
    if (!token) return
    await this.authenticate(cookieHeader, csrfToken, true)
    await this.repository.removeSessionByTokenHash(digest(token))
  }

  async listUsers() {
    return (await this.repository.listUsers()).map(publicUser)
  }

  async createUser(input) {
    const email = normalizeEmail(input.email)
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
      throw new DomainError('INVALID_EMAIL', 'El correo no es válido', 422)
    }
    if (!roles.includes(input.role)) {
      throw new DomainError('INVALID_ROLE', 'El rol no es válido', 422)
    }
    if (await this.repository.getUserByEmail(email)) {
      throw new DomainError('USER_ALREADY_EXISTS', 'Ya existe un usuario con ese correo', 409)
    }
    const now = this.clock().toISOString()
    const user = {
      id: this.idFactory(),
      name: input.name.normalize('NFKC').trim(),
      email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      active: input.active !== false,
      createdAt: now,
      updatedAt: now,
    }
    await this.repository.transaction(async (repository) => {
      await repository.saveUser(user)
      if (user.role === 'TECHNICIAN') {
        await repository.saveTechnician({
          id: this.idFactory(),
          name: user.name,
          active: user.active,
          userId: user.id,
        })
      }
    })
    return publicUser(user)
  }

  async updateUser(id, changes) {
    const user = await this.repository.getUser(id)
    if (!user) throw new DomainError('NOT_FOUND', 'Usuario no encontrado', 404)
    if (changes.email !== undefined) {
      const email = normalizeEmail(changes.email)
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
        throw new DomainError('INVALID_EMAIL', 'El correo no es válido', 422)
      }
      const duplicate = await this.repository.getUserByEmail(email)
      if (duplicate && duplicate.id !== id) {
        throw new DomainError('USER_ALREADY_EXISTS', 'Ya existe un usuario con ese correo', 409)
      }
      user.email = email
    }
    if (changes.name !== undefined) user.name = changes.name.normalize('NFKC').trim()
    if (changes.role !== undefined) {
      if (!roles.includes(changes.role)) throw new DomainError('INVALID_ROLE', 'El rol no es válido', 422)
      user.role = changes.role
    }
    if (changes.active !== undefined) user.active = changes.active
    if (changes.password !== undefined) user.passwordHash = await hashPassword(changes.password)
    user.updatedAt = this.clock().toISOString()
    await this.repository.transaction(async (repository) => {
      await repository.saveUser(user)
      const technicians = await repository.listTechnicians()
      const linked = technicians.find((item) => item.userId === id)
      if (user.role === 'TECHNICIAN') {
        await repository.saveTechnician({
          id: linked?.id || this.idFactory(),
          name: linked?.name || user.name,
          active: user.active,
          userId: user.id,
        })
      } else if (linked) {
        await repository.saveTechnician({ ...linked, userId: null })
      }
      if (changes.active !== undefined || changes.password !== undefined || changes.role !== undefined) {
        await repository.removeUserSessions(id)
      }
    })
    return publicUser(user)
  }
}
