function asIsoDate(value, fallback) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return fallback
  return new Date(value).toISOString()
}

export function createNotification(message, options = {}) {
  const idFactory = options.idFactory || (() => crypto.randomUUID())
  const now = options.now || new Date().toISOString()
  return {
    id: idFactory(),
    message: typeof message === 'string' ? message.trim() : '',
    createdAt: asIsoDate(now, new Date().toISOString()),
    read: false,
  }
}

export function normalizeNotifications(value, options = {}) {
  if (!Array.isArray(value)) return []
  const fallbackDate = asIsoDate(options.now, new Date().toISOString())

  return value.map((item, index) => ({
    id: typeof item?.id === 'string' ? item.id : `notificacion-${index + 1}`,
    message: typeof item?.message === 'string' ? item.message : '',
    createdAt: asIsoDate(item?.createdAt, fallbackDate),
    read: item?.read === true,
  }))
}

export function markAllNotificationsAsRead(notifications) {
  return notifications.map((notification) => ({ ...notification, read: true }))
}
