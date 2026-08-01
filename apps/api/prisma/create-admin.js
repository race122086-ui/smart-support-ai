import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { AuthService, normalizeEmail } from '../src/auth/auth-service.js'
import { loadConfig } from '../src/config.js'
import { FileRepository } from '../src/repositories/file-repository.js'
import { PrismaRepository } from '../src/repositories/prisma-repository.js'

async function resolveName(value) {
  if (value) return value
  const terminal = createInterface({ input: stdin, output: stdout })
  try {
    return await terminal.question('Nombre del administrador: ')
  } finally {
    terminal.close()
  }
}

async function main() {
  const config = loadConfig()
  const email = normalizeEmail(process.env.ADMIN_EMAIL)
  const password = process.env.ADMIN_PASSWORD
  if (!email) throw new TypeError('Define ADMIN_EMAIL')
  if (!password) throw new TypeError('Define ADMIN_PASSWORD de forma temporal para ejecutar este comando')
  const name = await resolveName(process.env.ADMIN_NAME)
  const repository = config.databaseUrl
    ? new PrismaRepository(undefined, { datasourceUrl: config.databaseUrl })
    : new FileRepository(config.dataFile)
  await repository.connect()
  try {
    if (await repository.getUserByEmail(email)) {
      throw new Error('Ya existe un usuario con ese correo')
    }
    const service = new AuthService(repository)
    const user = await service.createUser({
      name,
      email,
      password,
      role: 'ADMIN',
      active: true,
    })
    stdout.write(`Administrador creado: ${user.email}\n`)
  } finally {
    await repository.disconnect()
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
})
