import cors from '@fastify/cors'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify from 'fastify'
import { API_PREFIX } from '@smartsupport/contracts'
import { loadConfig } from './config.js'
import { DomainError } from './errors/domain-error.js'
import { FileRepository } from './repositories/file-repository.js'
import { PrismaRepository } from './repositories/prisma-repository.js'
import { apiRoutes, sharedSchemas } from './routes/api-routes.js'
import { SupportService } from './services/support-service.js'

function validationDetails(validation = []) {
  return validation.map((issue) => ({
    field: issue.instancePath || issue.params?.missingProperty || 'request',
    reason: issue.message || 'Valor inválido',
  }))
}

export async function buildApp(options = {}) {
  const config = options.config || loadConfig()
  const app = Fastify({
    logger: options.logger ?? { level: config.logLevel },
    bodyLimit: 1024 * 1024,
    requestIdHeader: 'x-request-id',
    ajv: {
      customOptions: {
        removeAdditional: false,
      },
    },
  })
  const repository = options.repository || (
    config.databaseUrl
      ? new PrismaRepository(undefined, { datasourceUrl: config.databaseUrl })
      : new FileRepository(config.dataFile)
  )
  const service = options.service || new SupportService(repository, options.serviceOptions)

  if (repository.connect) await repository.connect()

  await app.register(cors, {
    origin: config.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  await app.register(swagger, {
    stripBasePath: false,
    openapi: {
      info: {
        title: 'SmartSupport API',
        description: 'API local para la gestión de incidencias de SmartSupport',
        version: '1.0.0',
      },
      servers: [{ url: API_PREFIX }],
      tags: [
        { name: 'Reportes' },
        { name: 'Técnicos' },
        { name: 'Configuración' },
        { name: 'Notificaciones' },
        { name: 'Métricas' },
        { name: 'Respaldos' },
      ],
    },
  })
  await app.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  })
  for (const schema of sharedSchemas) app.addSchema(schema)

  app.get('/health', {
    schema: {
      tags: ['Salud'],
      response: {
        200: {
          type: 'object',
          additionalProperties: false,
          required: ['status'],
          properties: { status: { type: 'string', const: 'ok' } },
        },
      },
    },
  }, async () => {
    await repository.health()
    return { status: 'ok' }
  })

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: { code: 'ROUTE_NOT_FOUND', message: 'Ruta no encontrada' },
    })
  })

  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      const isBody = error.validationContext === 'body'
      return reply.code(isBody ? 422 : 400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'La solicitud contiene campos inválidos',
          details: validationDetails(error.validation),
        },
      })
    }
    if (error instanceof DomainError) {
      const payload = {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      }
      return reply.code(error.statusCode).send({ error: payload })
    }
    request.log.error({ err: error }, 'Error inesperado al procesar la solicitud')
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocurrió un error inesperado',
      },
    })
  })

  await app.register(apiRoutes, { prefix: API_PREFIX, service })

  app.decorate('supportRepository', repository)
  app.decorate('supportService', service)
  app.addHook('onClose', async () => {
    if (repository.disconnect) await repository.disconnect()
  })
  await app.ready()
  return app
}
