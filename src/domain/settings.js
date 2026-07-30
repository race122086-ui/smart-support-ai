import {
  DEFAULT_SETTINGS,
  PRIORITIES,
  ROLES,
  UNASSIGNED_TECHNICIAN,
} from './constants.js'

function cloneDefaults() {
  return {
    profile: { ...DEFAULT_SETTINGS.profile },
    technicians: [...DEFAULT_SETTINGS.technicians],
    sla: { ...DEFAULT_SETTINGS.sla },
  }
}

export function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {}
  const defaults = cloneDefaults()
  const profile = source.profile && typeof source.profile === 'object' ? source.profile : {}
  const technicians = Array.isArray(source.technicians)
    ? [...new Set(source.technicians.filter((name) => typeof name === 'string').map((name) => name.trim()).filter(Boolean))]
    : defaults.technicians

  return {
    profile: {
      name: typeof profile.name === 'string' && profile.name.trim()
        ? profile.name.trim()
        : defaults.profile.name,
      role: ROLES.includes(profile.role) ? profile.role : defaults.profile.role,
    },
    technicians,
    sla: Object.fromEntries(
      PRIORITIES.map((priority) => {
        const hours = Number(source.sla?.[priority])
        return [priority, Number.isFinite(hours) && hours >= 1 && hours <= 720
          ? hours
          : defaults.sla[priority]]
      })
    ),
  }
}

export function getTechnicians(settings) {
  return [...new Set([
    UNASSIGNED_TECHNICIAN,
    settings.profile.name,
    ...settings.technicians,
  ])]
}
