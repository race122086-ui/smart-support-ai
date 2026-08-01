export class NotificationHub {
  constructor() {
    this.subscribers = new Map()
  }

  subscribe(recipientId, listener) {
    const listeners = this.subscribers.get(recipientId) || new Set()
    listeners.add(listener)
    this.subscribers.set(recipientId, listeners)
    return () => {
      listeners.delete(listener)
      if (!listeners.size) this.subscribers.delete(recipientId)
    }
  }

  publish(notification) {
    for (const listener of this.subscribers.get(notification.recipientId) || []) {
      listener(notification)
    }
  }

  clear() {
    this.subscribers.clear()
  }
}
