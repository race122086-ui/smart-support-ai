export const STORAGE_KEYS = {
  reports: 'smartsupport-reports',
  settings: 'smartsupport-settings',
  notifications: 'smartsupport-notifications',
}

export const PRIORITIES = ['Baja', 'Media', 'Alta']

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

export const STATUSES = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En progreso',
  RESOLVED: 'Resuelto',
}

export const ROLES = ['Administrador', 'Técnico', 'Consulta']

export const UNASSIGNED_TECHNICIAN = 'Sin asignar'

export const DEFAULT_SETTINGS = {
  profile: { name: 'Administrador', role: 'Administrador' },
  technicians: ['Ana Torres', 'Carlos Ruiz', 'Laura Méndez'],
  sla: { Baja: 72, Media: 24, Alta: 8 },
}
