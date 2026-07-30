import { DEFAULT_SETTINGS } from '@smartsupport/contracts'

const defaultTechnicians = [
  { id: 'tecnico-ana-torres', name: 'Ana Torres', active: true },
  { id: 'tecnico-carlos-ruiz', name: 'Carlos Ruiz', active: true },
  { id: 'tecnico-laura-mendez', name: 'Laura Méndez', active: true },
]

function clone(value) {
  return structuredClone(value)
}

export class MemoryRepository {
  constructor(initialState = {}) {
    this.state = {
      reports: clone(initialState.reports || []),
      settings: clone(initialState.settings || DEFAULT_SETTINGS),
      technicians: clone(initialState.technicians || defaultTechnicians),
      notifications: clone(initialState.notifications || []),
    }
  }

  async snapshot() {
    return clone(this.state)
  }

  async replace(snapshot) {
    this.state = clone(snapshot)
  }

  async listReports() {
    return clone(this.state.reports)
  }

  async getReport(id) {
    return clone(this.state.reports.find((report) => report.id === id) || null)
  }

  async saveReport(report) {
    const index = this.state.reports.findIndex((item) => item.id === report.id)
    if (index === -1) this.state.reports.push(clone(report))
    else this.state.reports[index] = clone(report)
    return clone(report)
  }

  async removeReport(id) {
    const index = this.state.reports.findIndex((report) => report.id === id)
    if (index === -1) return false
    this.state.reports.splice(index, 1)
    return true
  }

  async getSettings() {
    return clone(this.state.settings)
  }

  async saveSettings(settings) {
    this.state.settings = clone(settings)
    return clone(settings)
  }

  async listTechnicians() {
    return clone(this.state.technicians)
  }

  async saveTechnician(technician) {
    const index = this.state.technicians.findIndex((item) => item.id === technician.id)
    if (index === -1) this.state.technicians.push(clone(technician))
    else this.state.technicians[index] = clone(technician)
    return clone(technician)
  }

  async removeTechnician(id) {
    const index = this.state.technicians.findIndex((item) => item.id === id)
    if (index === -1) return false
    this.state.technicians.splice(index, 1)
    return true
  }

  async listNotifications() {
    return clone(this.state.notifications)
  }

  async saveNotification(notification) {
    this.state.notifications.unshift(clone(notification))
    return clone(notification)
  }

  async replaceNotifications(notifications) {
    this.state.notifications = clone(notifications)
    return clone(notifications)
  }
}
