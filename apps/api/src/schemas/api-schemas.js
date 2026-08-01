import {
  DEPARTMENTS,
  PRIORITIES,
  ROLES,
  SORT_ORDERS,
  STATUSES,
  UNASSIGNED_TECHNICIAN,
  editableReportProperties,
} from '@smartsupport/contracts'

export const idParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id'],
  properties: { id: { type: 'string', minLength: 1 } },
}

export const attachmentParams = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'attachmentId'],
  properties: {
    id: { type: 'string', minLength: 1 },
    attachmentId: { type: 'string', minLength: 1 },
  },
}

export const reportCreateBody = {
  type: 'object',
  additionalProperties: false,
  required: Object.keys(editableReportProperties),
  properties: editableReportProperties,
}

export const reportUpdateBody = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: editableReportProperties,
}

export const reportQuery = {
  type: 'object',
  additionalProperties: false,
  properties: {
    q: { type: 'string', maxLength: 200 },
    status: { type: 'string', enum: STATUSES },
    priority: { type: 'string', enum: PRIORITIES },
    technician: { type: 'string', minLength: 1 },
    sort: { type: 'string', enum: SORT_ORDERS, default: 'recent' },
    page: { type: 'integer', minimum: 1, default: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
}

export const statusBody = {
  type: 'object',
  additionalProperties: false,
  required: ['status'],
  properties: { status: { type: 'string', enum: STATUSES } },
}

export const technicianAssignmentBody = {
  type: 'object',
  additionalProperties: false,
  required: ['technician'],
  properties: {
    technician: {
      type: 'string',
      minLength: 1,
      maxLength: 120,
      pattern: '\\S',
      examples: [UNASSIGNED_TECHNICIAN],
    },
  },
}

export const commentBody = {
  type: 'object',
  additionalProperties: false,
  required: ['message'],
  properties: {
    message: { type: 'string', minLength: 1, maxLength: 160, pattern: '\\S' },
  },
}

export const technicianCreateBody = {
  type: 'object',
  additionalProperties: false,
  required: ['name'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120, pattern: '\\S' },
  },
}

export const settingsUpdateBody = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    profile: {
      type: 'object',
      additionalProperties: false,
      minProperties: 1,
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 120, pattern: '\\S' },
        role: { type: 'string', enum: ROLES },
      },
    },
    sla: {
      type: 'object',
      additionalProperties: false,
      minProperties: 1,
      properties: Object.fromEntries(
        PRIORITIES.map((priority) => [
          priority,
          { type: 'number', minimum: 1, maximum: 720 },
        ])
      ),
    },
  },
}

export const backupImportBody = {
  type: 'object',
  additionalProperties: true,
}

export const reportListResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'total'],
  properties: {
    items: { type: 'array', items: { $ref: 'Report#' } },
    total: { type: 'integer', minimum: 0 },
  },
}

export const metricsResponse = {
  type: 'object',
  additionalProperties: false,
  required: [
    'total',
    'pending',
    'inProgress',
    'resolved',
    'resolutionRate',
    'priorities',
  ],
  properties: {
    total: { type: 'integer', minimum: 0 },
    pending: { type: 'integer', minimum: 0 },
    inProgress: { type: 'integer', minimum: 0 },
    resolved: { type: 'integer', minimum: 0 },
    resolutionRate: { type: 'integer', minimum: 0, maximum: 100 },
    priorities: {
      type: 'object',
      additionalProperties: false,
      required: PRIORITIES,
      properties: Object.fromEntries(
        PRIORITIES.map((priority) => [priority, { type: 'integer', minimum: 0 }])
      ),
    },
  },
}

export const slaResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['deadline', 'overdue'],
  properties: {
    deadline: { type: 'string', format: 'date-time' },
    overdue: { type: 'boolean' },
  },
}

export const backupResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['version', 'reports', 'settings', 'notifications'],
  properties: {
    version: { type: 'integer', const: 2 },
    reports: { type: 'array', items: { $ref: 'Report#' } },
    settings: { $ref: 'Settings#' },
    notifications: { type: 'array', items: { $ref: 'Notification#' } },
  },
}

export const importResultResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['reports', 'technicians', 'notifications', 'fingerprint', 'duplicate'],
  properties: {
    reports: { type: 'integer', minimum: 0 },
    technicians: { type: 'integer', minimum: 0 },
    notifications: { type: 'integer', minimum: 0 },
    fingerprint: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    duplicate: { type: 'boolean' },
  },
}

export const editableDepartmentValues = DEPARTMENTS
