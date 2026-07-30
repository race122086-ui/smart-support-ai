import { STORAGE_KEYS } from '../domain/constants.js'
import { normalizeNotifications } from '../domain/notifications.js'
import { normalizeReports } from '../domain/reports.js'
import { normalizeSettings } from '../domain/settings.js'

function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value))
}

export function createLocalRepositories(storage = globalThis.localStorage) {
  return {
    reports: {
      list() {
        return normalizeReports(readJson(storage, STORAGE_KEYS.reports, []))
      },
      getById(id) {
        return this.list().find((report) => report.id === id)
      },
      create(input) {
        const reports = this.list()
        reports.unshift(input)
        writeJson(storage, STORAGE_KEYS.reports, reports)
        return input
      },
      update(id, changes) {
        const reports = this.list()
        const index = reports.findIndex((report) => report.id === id)
        if (index === -1) return null
        reports[index] = normalizeReports([{ ...reports[index], ...changes }])[0]
        writeJson(storage, STORAGE_KEYS.reports, reports)
        return reports[index]
      },
      remove(id) {
        const reports = this.list()
        const nextReports = reports.filter((report) => report.id !== id)
        writeJson(storage, STORAGE_KEYS.reports, nextReports)
        return nextReports.length !== reports.length
      },
      replaceAll(reports) {
        const normalized = normalizeReports(reports)
        writeJson(storage, STORAGE_KEYS.reports, normalized)
        return normalized
      },
    },
    settings: {
      get() {
        return normalizeSettings(readJson(storage, STORAGE_KEYS.settings, null))
      },
      update(changes) {
        const current = this.get()
        const settings = normalizeSettings({
          ...current,
          ...changes,
          profile: { ...current.profile, ...changes?.profile },
          sla: { ...current.sla, ...changes?.sla },
        })
        writeJson(storage, STORAGE_KEYS.settings, settings)
        return settings
      },
    },
    notifications: {
      list() {
        return normalizeNotifications(readJson(storage, STORAGE_KEYS.notifications, []))
      },
      replaceAll(notifications) {
        const normalized = normalizeNotifications(notifications)
        writeJson(storage, STORAGE_KEYS.notifications, normalized)
        return normalized
      },
      markAllAsRead() {
        const notifications = this.list().map((item) => ({ ...item, read: true }))
        writeJson(storage, STORAGE_KEYS.notifications, notifications)
        return notifications
      },
    },
  }
}
