export function mergeNotification(notifications = [], notification) {
  return notifications.some((item) => item.id === notification.id)
    ? notifications
    : [notification, ...notifications]
}
