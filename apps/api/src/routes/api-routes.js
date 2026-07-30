import {
  activitySchema,
  errorSchema,
  notificationSchema,
  reportSchema,
  settingsSchema,
  technicianSchema,
} from '@smartsupport/contracts'
import {
  backupImportBody,
  backupResponse,
  commentBody,
  idParams,
  importResultResponse,
  metricsResponse,
  reportCreateBody,
  reportListResponse,
  reportQuery,
  reportUpdateBody,
  settingsUpdateBody,
  slaResponse,
  statusBody,
  technicianAssignmentBody,
  technicianCreateBody,
} from '../schemas/api-schemas.js'

const errorResponses = {
  400: { $ref: 'Error#' },
  404: { $ref: 'Error#' },
  409: { $ref: 'Error#' },
  422: { $ref: 'Error#' },
}

export async function apiRoutes(app, options) {
  const { service } = options

  app.get('/reports', {
    schema: {
      tags: ['Reportes'],
      querystring: reportQuery,
      response: { 200: reportListResponse, ...errorResponses },
    },
  }, async (request) => service.listReports(request.query))

  app.post('/reports', {
    schema: {
      tags: ['Reportes'],
      body: reportCreateBody,
      response: { 201: { $ref: 'Report#' }, ...errorResponses },
    },
  }, async (request, reply) => {
    const report = await service.createReport(request.body)
    return reply
      .code(201)
      .header('Location', `/api/v1/reports/${report.id}`)
      .send(report)
  })

  app.get('/reports/:id', {
    schema: {
      tags: ['Reportes'],
      params: idParams,
      response: { 200: { $ref: 'Report#' }, ...errorResponses },
    },
  }, async (request) => service.getReport(request.params.id))

  app.patch('/reports/:id', {
    schema: {
      tags: ['Reportes'],
      params: idParams,
      body: reportUpdateBody,
      response: { 200: { $ref: 'Report#' }, ...errorResponses },
    },
  }, async (request) => service.updateReport(request.params.id, request.body))

  app.delete('/reports/:id', {
    schema: {
      tags: ['Reportes'],
      params: idParams,
      response: { ...errorResponses },
    },
  }, async (request, reply) => {
    await service.deleteReport(request.params.id)
    return reply.code(204).send()
  })

  app.put('/reports/:id/status', {
    schema: {
      tags: ['Reportes'],
      params: idParams,
      body: statusBody,
      response: { 200: { $ref: 'Report#' }, ...errorResponses },
    },
  }, async (request) => service.changeStatus(request.params.id, request.body.status))

  app.put('/reports/:id/technician', {
    schema: {
      tags: ['Reportes'],
      params: idParams,
      body: technicianAssignmentBody,
      response: { 200: { $ref: 'Report#' }, ...errorResponses },
    },
  }, async (request) =>
    service.assignTechnician(request.params.id, request.body.technician)
  )

  app.post('/reports/:id/comments', {
    schema: {
      tags: ['Reportes'],
      params: idParams,
      body: commentBody,
      response: { 201: { $ref: 'Activity#' }, ...errorResponses },
    },
  }, async (request, reply) => {
    const activity = await service.addComment(request.params.id, request.body.message)
    return reply.code(201).send(activity)
  })

  app.get('/reports/:id/activity', {
    schema: {
      tags: ['Reportes'],
      params: idParams,
      response: {
        200: { type: 'array', items: { $ref: 'Activity#' } },
        ...errorResponses,
      },
    },
  }, async (request) => service.getActivity(request.params.id))

  app.get('/reports/:id/sla', {
    schema: {
      tags: ['Reportes'],
      params: idParams,
      response: { 200: slaResponse, ...errorResponses },
    },
  }, async (request) => service.getSla(request.params.id))

  app.get('/metrics', {
    schema: {
      tags: ['Métricas'],
      response: { 200: metricsResponse, ...errorResponses },
    },
  }, async () => service.getMetrics())

  app.get('/technicians', {
    schema: {
      tags: ['Técnicos'],
      response: {
        200: { type: 'array', items: { $ref: 'Technician#' } },
        ...errorResponses,
      },
    },
  }, async () => service.listTechnicians())

  app.post('/technicians', {
    schema: {
      tags: ['Técnicos'],
      body: technicianCreateBody,
      response: { 201: { $ref: 'Technician#' }, ...errorResponses },
    },
  }, async (request, reply) => {
    const technician = await service.addTechnician(request.body.name)
    return reply.code(201).send(technician)
  })

  app.delete('/technicians/:id', {
    schema: {
      tags: ['Técnicos'],
      params: idParams,
      response: { ...errorResponses },
    },
  }, async (request, reply) => {
    await service.deleteTechnician(request.params.id)
    return reply.code(204).send()
  })

  app.get('/settings', {
    schema: {
      tags: ['Configuración'],
      response: { 200: { $ref: 'Settings#' }, ...errorResponses },
    },
  }, async () => service.getSettings())

  app.patch('/settings', {
    schema: {
      tags: ['Configuración'],
      body: settingsUpdateBody,
      response: { 200: { $ref: 'Settings#' }, ...errorResponses },
    },
  }, async (request) => service.updateSettings(request.body))

  app.get('/notifications', {
    schema: {
      tags: ['Notificaciones'],
      response: {
        200: { type: 'array', items: { $ref: 'Notification#' } },
        ...errorResponses,
      },
    },
  }, async () => service.listNotifications())

  app.post('/notifications/read-all', {
    schema: {
      tags: ['Notificaciones'],
      response: {
        200: { type: 'array', items: { $ref: 'Notification#' } },
        ...errorResponses,
      },
    },
  }, async () => service.markNotificationsRead())

  app.get('/backups/current', {
    schema: {
      tags: ['Respaldos'],
      response: { 200: backupResponse, ...errorResponses },
    },
  }, async () => service.exportBackup())

  app.post('/backups/import', {
    schema: {
      tags: ['Respaldos'],
      body: backupImportBody,
      response: { 200: importResultResponse, ...errorResponses },
    },
  }, async (request) => service.importBackup(request.body))
}

export const sharedSchemas = [
  activitySchema,
  errorSchema,
  notificationSchema,
  reportSchema,
  settingsSchema,
  technicianSchema,
]
