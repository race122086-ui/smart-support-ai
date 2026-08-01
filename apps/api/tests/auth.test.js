import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { buildApp } from '../src/app.js'
import { AuthService, hashPassword } from '../src/auth/auth-service.js'
import { MemoryRepository } from '../src/repositories/memory-repository.js'

const reportInput = {
  userName: 'Nombre enviado',
  contactEmail: 'enviado@example.test',
  contactPhone: '+52 55 0000 0000',
  department: 'Sistemas',
  description: 'Incidencia de autorización',
  priority: 'Alta',
}

async function user(id, role, active = true) {
  return {
    id,
    name: id,
    email: `${id}@example.test`,
    passwordHash: await hashPassword('SeguraPruebas123'),
    role,
    active,
    createdAt: '2026-07-31T12:00:00.000Z',
    updatedAt: '2026-07-31T12:00:00.000Z',
  }
}

async function createAuthApp(options = {}) {
  const users = [
    await user('admin', 'ADMIN'),
    await user('tecnico', 'TECHNICIAN'),
    await user('usuario-a', 'USER'),
    await user('usuario-b', 'USER'),
    await user('inactivo', 'USER', false),
  ]
  const repository = new MemoryRepository({
    users,
    technicians: [{
      id: 'tech-id',
      name: 'tecnico',
      active: true,
      userId: 'tecnico',
    }],
    reports: options.reports || [],
  })
  const app = await buildApp({
    logger: false,
    repository,
    config: {
      host: '127.0.0.1',
      port: 3000,
      corsOrigin: 'http://localhost:5173',
      logLevel: 'silent',
      production: options.production === true,
    },
  })
  return { app, repository }
}

async function login(app, id, password = 'SeguraPruebas123') {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: `${id}@example.test`, password },
  })
  const cookie = response.headers['set-cookie']?.split(';')[0]
  return { response, cookie, csrf: response.json().csrfToken }
}

function authenticated(session, options) {
  return {
    ...options,
    headers: {
      cookie: session.cookie,
      'x-csrf-token': session.csrf,
      ...options.headers,
    },
  }
}

test('login correcto e incorrecto no revela existencia y rechaza usuarios desactivados', async (t) => {
  const { app } = await createAuthApp()
  t.after(() => app.close())

  const valid = await login(app, 'admin')
  assert.equal(valid.response.statusCode, 200)
  assert.match(valid.response.headers['set-cookie'], /HttpOnly/)
  assert.match(valid.response.headers['set-cookie'], /SameSite=Lax/)
  assert.doesNotMatch(valid.response.headers['set-cookie'], /Secure/)

  const wrong = await login(app, 'admin', 'Incorrecta123A')
  const missing = await login(app, 'no-existe', 'Incorrecta123A')
  const inactive = await login(app, 'inactivo')
  for (const response of [wrong.response, missing.response, inactive.response]) {
    assert.equal(response.statusCode, 401)
    assert.equal(response.json().error.message, 'Correo o contraseña incorrectos')
  }
})

test('requiere sesión y CSRF, rota CSRF en me y elimina la cookie al cerrar sesión', async (t) => {
  const { app } = await createAuthApp()
  t.after(() => app.close())

  const anonymous = await app.inject({ method: 'GET', url: '/api/v1/reports' })
  assert.equal(anonymous.statusCode, 401)

  const session = await login(app, 'admin')
  const withoutCsrf = await app.inject({
    method: 'POST',
    url: '/api/v1/reports',
    headers: { cookie: session.cookie },
    payload: reportInput,
  })
  assert.equal(withoutCsrf.statusCode, 403)

  const me = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { cookie: session.cookie },
  })
  assert.equal(me.statusCode, 200)
  assert.notEqual(me.json().csrfToken, session.csrf)
  session.csrf = me.json().csrfToken

  const logout = await app.inject(authenticated(session, {
    method: 'POST',
    url: '/api/v1/auth/logout',
  }))
  assert.equal(logout.statusCode, 204)
  assert.match(logout.headers['set-cookie'], /Max-Age=0/)
  const after = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    headers: { cookie: session.cookie },
  })
  assert.equal(after.statusCode, 401)
})

test('aplica permisos ADMIN, TECHNICIAN y USER y aísla tickets entre usuarios', async (t) => {
  const historical = {
    id: 'historico',
    ticketNumber: 1,
    ...reportInput,
    status: 'Pendiente',
    technician: 'Sin asignar',
    createdById: null,
    createdAt: '2026-07-01T12:00:00.000Z',
    activity: [],
  }
  const { app } = await createAuthApp({ reports: [historical] })
  t.after(() => app.close())
  const admin = await login(app, 'admin')
  const technician = await login(app, 'tecnico')
  const userA = await login(app, 'usuario-a')
  const userB = await login(app, 'usuario-b')

  const created = await app.inject(authenticated(userA, {
    method: 'POST',
    url: '/api/v1/reports',
    payload: reportInput,
  }))
  assert.equal(created.statusCode, 201)
  assert.equal(created.json().createdById, 'usuario-a')
  assert.equal(created.json().userName, 'usuario-a')

  const own = await app.inject(authenticated(userA, {
    method: 'GET',
    url: `/api/v1/reports/${created.json().id}`,
  }))
  assert.equal(own.statusCode, 200)
  const isolated = await app.inject(authenticated(userB, {
    method: 'GET',
    url: `/api/v1/reports/${created.json().id}`,
  }))
  assert.equal(isolated.statusCode, 403)

  const userAdmin = await app.inject(authenticated(userA, {
    method: 'GET',
    url: '/api/v1/users',
  }))
  assert.equal(userAdmin.statusCode, 403)

  const techList = await app.inject(authenticated(technician, {
    method: 'GET',
    url: '/api/v1/reports',
  }))
  assert.equal(techList.statusCode, 200)
  assert.ok(techList.json().items.every((item) => item.id !== 'historico'))

  const hiddenUnassigned = await app.inject(authenticated(technician, {
    method: 'GET',
    url: '/api/v1/reports/historico',
  }))
  assert.equal(hiddenUnassigned.statusCode, 403)

  for (const session of [technician, userA]) {
    const listTechnicians = await app.inject(authenticated(session, {
      method: 'GET',
      url: '/api/v1/technicians',
    }))
    assert.equal(listTechnicians.statusCode, 403)

    const createTechnician = await app.inject(authenticated(session, {
      method: 'POST',
      url: '/api/v1/technicians',
      payload: { name: `No autorizado ${session === technician ? 'técnico' : 'usuario'}` },
    }))
    assert.equal(createTechnician.statusCode, 403)

    const deleteTechnician = await app.inject(authenticated(session, {
      method: 'DELETE',
      url: '/api/v1/technicians/tech-id',
    }))
    assert.equal(deleteTechnician.statusCode, 403)
  }

  const adminTechnicians = await app.inject(authenticated(admin, {
    method: 'GET',
    url: '/api/v1/technicians',
  }))
  assert.equal(adminTechnicians.statusCode, 200)

  const adminCreatedTechnician = await app.inject(authenticated(admin, {
    method: 'POST',
    url: '/api/v1/technicians',
    payload: { name: 'Técnico administrado' },
  }))
  assert.equal(adminCreatedTechnician.statusCode, 201)

  const adminDeletedTechnician = await app.inject(authenticated(admin, {
    method: 'DELETE',
    url: `/api/v1/technicians/${adminCreatedTechnician.json().id}`,
  }))
  assert.equal(adminDeletedTechnician.statusCode, 204)

  const selfAssigned = await app.inject(authenticated(technician, {
    method: 'PUT',
    url: '/api/v1/reports/historico/technician',
    payload: { technician: 'tecnico' },
  }))
  assert.equal(selfAssigned.statusCode, 200)
  const assignedList = await app.inject(authenticated(technician, {
    method: 'GET',
    url: '/api/v1/reports',
  }))
  assert.ok(assignedList.json().items.some((item) => item.id === 'historico'))

  const techSettings = await app.inject(authenticated(technician, {
    method: 'GET',
    url: '/api/v1/settings',
  }))
  assert.equal(techSettings.statusCode, 403)

  const adminUsers = await app.inject(authenticated(admin, {
    method: 'GET',
    url: '/api/v1/users',
  }))
  assert.equal(adminUsers.statusCode, 200)
  assert.equal(adminUsers.json().length, 5)
  const adminHistorical = await app.inject(authenticated(admin, {
    method: 'GET',
    url: '/api/v1/reports/historico',
  }))
  assert.equal(adminHistorical.statusCode, 200)
})

test('usa cookie Secure en producción', async (t) => {
  const { app } = await createAuthApp({ production: true })
  t.after(() => app.close())
  const session = await login(app, 'admin')
  assert.match(session.response.headers['set-cookie'], /Secure/)
})

test('creación del primer administrador rechaza contraseña débil y duplicados', async () => {
  const repository = new MemoryRepository()
  const auth = new AuthService(repository)
  await assert.rejects(
    auth.createUser({
      name: 'Administración',
      email: 'admin@example.test',
      password: 'debil',
      role: 'ADMIN',
    }),
    { code: 'WEAK_PASSWORD' }
  )
  await auth.createUser({
    name: 'Administración',
    email: 'admin@example.test',
    password: 'SeguraPruebas123',
    role: 'ADMIN',
  })
  await assert.rejects(
    auth.createUser({
      name: 'Otra',
      email: 'ADMIN@example.test',
      password: 'SeguraPruebas456',
      role: 'ADMIN',
    }),
    { code: 'USER_ALREADY_EXISTS' }
  )
  const source = await readFile(new URL('../prisma/create-admin.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /SeguraPruebas/)
  assert.doesNotMatch(source, /password\s*[:=]\s*['"][^'"]+['"]/)
})


test('aísla notificaciones por destinatario y aplica eventos según rol y actor', async (t) => {
  const { app, repository } = await createAuthApp()
  t.after(() => app.close())
  const adminSession = await login(app, 'admin')
  const technicianSession = await login(app, 'tecnico')
  const userA = await login(app, 'usuario-a')
  const userB = await login(app, 'usuario-b')

  const created = await app.inject(authenticated(userA, {
    method: 'POST', url: '/api/v1/reports', payload: reportInput,
  }))
  const report = created.json()
  assert.equal(created.statusCode, 201)
  assert.equal((await repository.listNotifications('usuario-a')).length, 1)
  assert.equal((await repository.listNotifications('admin')).length, 1)
  assert.equal((await repository.listNotifications('tecnico')).length, 0)
  assert.equal((await repository.listNotifications('usuario-b')).length, 0)

  await app.inject(authenticated(adminSession, {
    method: 'PUT', url: `/api/v1/reports/${report.id}/technician`,
    payload: { technician: 'tecnico' },
  }))
  assert.equal((await repository.listNotifications('usuario-a')).length, 2)
  assert.equal((await repository.listNotifications('tecnico')).length, 1)
  assert.equal((await repository.listNotifications('admin')).length, 1)

  await app.inject(authenticated(technicianSession, {
    method: 'PUT', url: `/api/v1/reports/${report.id}/status`,
    payload: { status: 'En progreso' },
  }))
  assert.equal((await repository.listNotifications('usuario-a')).length, 3)
  assert.equal((await repository.listNotifications('tecnico')).length, 1)
  assert.equal((await repository.listNotifications('admin')).length, 2)

  await app.inject(authenticated(userA, {
    method: 'POST', url: `/api/v1/reports/${report.id}/comments`,
    payload: { message: 'Sigue ocurriendo' },
  }))
  assert.equal((await repository.listNotifications('usuario-a')).length, 3)
  assert.equal((await repository.listNotifications('tecnico')).length, 2)
  assert.equal((await repository.listNotifications('admin')).length, 3)

  await app.inject(authenticated(technicianSession, {
    method: 'POST', url: `/api/v1/reports/${report.id}/comments`,
    payload: { message: 'Problema resuelto' },
  }))
  assert.equal((await repository.listNotifications('usuario-a')).length, 4)
  assert.equal((await repository.listNotifications('tecnico')).length, 2)
  assert.equal((await repository.listNotifications('admin')).length, 4)
  const adminActivity = await app.inject(authenticated(adminSession, {
    method: 'GET', url: `/api/v1/reports/${report.id}/activity`,
  }))
  assert.ok(adminActivity.json().some((item) => item.message === 'Comentario: Problema resuelto'))

  const userANotification = (await repository.listNotifications('usuario-a'))[0]
  const forbiddenRead = await app.inject(authenticated(userB, {
    method: 'POST', url: `/api/v1/notifications/${userANotification.id}/read`,
  }))
  assert.equal(forbiddenRead.statusCode, 404)

  const ownList = await app.inject(authenticated(userA, {
    method: 'GET', url: '/api/v1/notifications',
  }))
  assert.equal(ownList.statusCode, 200)
  assert.ok(ownList.json().every((item) => item.reportId === report.id))
  assert.ok(ownList.json().every((item) => !('recipientId' in item)))

  const readOne = await app.inject(authenticated(userA, {
    method: 'POST', url: `/api/v1/notifications/${userANotification.id}/read`,
  }))
  assert.equal(readOne.statusCode, 200)
  assert.equal(readOne.json().read, true)

  const readAll = await app.inject(authenticated(userA, {
    method: 'POST', url: '/api/v1/notifications/read-all',
  }))
  assert.ok(readAll.json().every((item) => item.read))

  await repository.saveNotification({
    id: 'legacy-notification', recipientId: null, reportId: null,
    message: 'Aviso heredado', type: 'info', read: false,
    createdAt: '2026-07-01T00:00:00.000Z',
  })
  const afterLegacy = await app.inject(authenticated(adminSession, {
    method: 'GET', url: '/api/v1/notifications',
  }))
  assert.ok(afterLegacy.json().every((item) => item.id !== 'legacy-notification'))
})

test('rechaza el flujo SSE sin una sesión válida', async (t) => {
  const { app } = await createAuthApp()
  t.after(() => app.close())
  const response = await app.inject({
    method: 'GET', url: '/api/v1/notifications/stream',
    headers: { accept: 'text/event-stream' },
  })
  assert.equal(response.statusCode, 401)
})
