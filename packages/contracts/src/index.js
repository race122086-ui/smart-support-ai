export const API_PREFIX = '/api/v1'

export const PRIORITIES = ['Baja', 'Media', 'Alta']
export const STATUSES = ['Pendiente', 'En progreso', 'Resuelto']
export const ROLES = ['Administrador', 'Técnico', 'Consulta']
export const DEPARTMENTS = [
  'Administración',
  'Almacén',
  'Comercial',
  'Contabilidad',
  'Finanzas',
  'Infraestructura',
  'Operaciones',
  'Sistemas',
]
export const UNASSIGNED_TECHNICIAN = 'Sin asignar'
export const SORT_ORDERS = ['recent', 'oldest', 'priority', 'deadline']

export const DEFAULT_SETTINGS = {
  profile: { name: 'Administrador', role: 'Administrador' },
  sla: { Baja: 72, Media: 24, Alta: 8 },
}

export const errorSchema = {
  $id: 'Error',
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'array', items: { type: 'object' } },
      },
    },
  },
}

export const activitySchema = {
  $id: 'Activity',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'message', 'createdAt'],
  properties: {
    id: { type: 'string', minLength: 1 },
    message: { type: 'string' },
    type: { type: 'string', minLength: 1 },
    reportId: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
}

export const reportSchema = {
  $id: 'Report',
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'ticketNumber',
    'userName',
    'contactEmail',
    'contactPhone',
    'department',
    'description',
    'priority',
    'status',
    'technician',
    'createdAt',
    'activity',
  ],
  properties: {
    id: { type: 'string', minLength: 1 },
    ticketNumber: { type: 'integer', minimum: 1 },
    userName: { type: 'string', minLength: 1 },
    contactEmail: { type: 'string', minLength: 1, format: 'email' },
    contactPhone: { type: 'string', minLength: 1 },
    department: { type: 'string', enum: DEPARTMENTS },
    description: { type: 'string', minLength: 1 },
    priority: { type: 'string', enum: PRIORITIES },
    status: { type: 'string', enum: STATUSES },
    technician: { type: 'string', minLength: 1 },
    createdById: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    activity: { type: 'array', items: { $ref: 'Activity#' } },
  },
}

export const technicianSchema = {
  $id: 'Technician',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'active'],
  properties: {
    id: { type: 'string', minLength: 1 },
    name: { type: 'string', minLength: 1 },
    active: { type: 'boolean' },
  },
}

export const notificationSchema = {
  $id: 'Notification',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'message', 'type', 'reportId', 'createdAt', 'read'],
  properties: {
    id: { type: 'string', minLength: 1 },
    message: { type: 'string' },
    type: { type: 'string', minLength: 1 },
    reportId: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
    read: { type: 'boolean' },
  },
}

export const attachmentSchema = {
  $id: 'Attachment',
  type: 'object',
  additionalProperties: false,
  required: ['id', 'reportId', 'fileName', 'mimeType', 'size', 'uploadedById', 'createdAt'],
  properties: {
    id: { type: 'string', minLength: 1 },
    reportId: { type: 'string', minLength: 1 },
    fileName: { type: 'string', minLength: 1 },
    mimeType: { type: 'string', minLength: 1 },
    size: { type: 'integer', minimum: 1 },
    uploadedBy: { type: ['string', 'null'] },
    uploadedById: { type: ['string', 'null'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
}

export const settingsSchema = {
  $id: 'Settings',
  type: 'object',
  additionalProperties: false,
  required: ['profile', 'technicians', 'sla'],
  properties: {
    profile: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'role'],
      properties: {
        name: { type: 'string', minLength: 1 },
        role: { type: 'string', enum: ROLES },
      },
    },
    technicians: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      uniqueItems: true,
    },
    sla: {
      type: 'object',
      additionalProperties: false,
      required: PRIORITIES,
      properties: Object.fromEntries(
        PRIORITIES.map((priority) => [
          priority,
          { type: 'number', minimum: 1, maximum: 720 },
        ])
      ),
    },
  },
}

export const editableReportProperties = {
  userName: { type: 'string', minLength: 1, maxLength: 120, pattern: '\\S' },
  contactEmail: { type: 'string', minLength: 1, maxLength: 254, format: 'email' },
  contactPhone: { type: 'string', minLength: 1, maxLength: 40, pattern: '\\S' },
  department: { type: 'string', enum: DEPARTMENTS },
  description: { type: 'string', minLength: 1, maxLength: 2000, pattern: '\\S' },
  priority: { type: 'string', enum: PRIORITIES },
}


function activitySequence(message = '') {
  if (message === 'Reporte creado') return 0
  if (message === 'Estado inicial: Pendiente') return 1
  if (message.startsWith('Asignado a')) return 2
  if (message === 'Estado cambiado a En progreso') return 3
  if (message === 'Estado cambiado a Resuelto') return 4
  if (message.startsWith('Comentario:')) return 5
  if (message === 'Reporte cerrado') return 6
  return 2
}

export function sortReportActivity(activity = []) {
  const commentMessages = new Set()
  const uniqueActivity = activity.filter((item) => {
    if (!item.message?.startsWith('Comentario:')) return true
    const normalized = item.message.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('es-MX')
    if (commentMessages.has(normalized)) return false
    commentMessages.add(normalized)
    return true
  })
  return uniqueActivity.sort((left, right) => {
    const leftClosed = left.message === 'Reporte cerrado'
    const rightClosed = right.message === 'Reporte cerrado'
    if (leftClosed !== rightClosed) return leftClosed ? 1 : -1
    const dateDifference = new Date(left.createdAt) - new Date(right.createdAt)
    if (dateDifference) return dateDifference
    return activitySequence(left.message) - activitySequence(right.message)
  })
}
