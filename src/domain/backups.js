import { normalizeNotifications } from './notifications.js'
import { normalizeReports } from './reports.js'
import { normalizeSettings } from './settings.js'

export function normalizeBackup(value, options = {}) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.reports)) {
    throw new TypeError('El respaldo debe contener una lista de reportes')
  }

  return {
    reports: normalizeReports(value.reports, options),
    settings: normalizeSettings(value.settings),
    notifications: normalizeNotifications(value.notifications, options),
  }
}
export function createBackup(reports, settings, notifications) {
  return {
    reports,
    settings,
    notifications,
  }
}
