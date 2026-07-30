import { normalizeBackup } from '../domain/backups.js'
import { STORAGE_KEYS } from '../domain/constants.js'

const migrationMarker = 'smartsupport-postgresql-migration'

function readJson(storage, key, fallback) {
  try {
    const value = storage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch {
    return fallback
  }
}

export function getLegacyMigration(storage = globalThis.localStorage) {
  const presentKeys = Object.values(STORAGE_KEYS).filter(
    (key) => storage.getItem(key) !== null
  )
  if (!presentKeys.length || storage.getItem(migrationMarker)) return null
  let backup
  try {
    backup = normalizeBackup({
      reports: readJson(storage, STORAGE_KEYS.reports, []),
      settings: readJson(storage, STORAGE_KEYS.settings, null),
      notifications: readJson(storage, STORAGE_KEYS.notifications, []),
    })
  } catch {
    return null
  }
  return {
    backup,
    counts: {
      reports: backup.reports.length,
      technicians: backup.settings.technicians.length,
      notifications: backup.notifications.length,
    },
  }
}

export function markLegacyMigrationComplete(fingerprint, storage = globalThis.localStorage) {
  storage.setItem(migrationMarker, JSON.stringify({
    fingerprint,
    completedAt: new Date().toISOString(),
  }))
}
