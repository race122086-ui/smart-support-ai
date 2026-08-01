import { queryKeys } from './queries.js'

export function removeTicketFromLists(client, reportId) {
  client.setQueriesData({ queryKey: ['reports'] }, (current) => {
    if (!current?.items) return current
    const items = current.items.filter((item) => item.id !== reportId)
    return items.length === current.items.length
      ? current
      : { ...current, items, total: Math.max(0, current.total - 1) }
  })
}

export async function applyTicketDeleted(client, reportId, eventTarget = window) {
  removeTicketFromLists(client, reportId)
  eventTarget.dispatchEvent(new CustomEvent('smartsupport:ticket-deleted', {
    detail: { reportId },
  }))
  client.removeQueries({ queryKey: queryKeys.report(reportId) })
  client.removeQueries({ queryKey: queryKeys.activity(reportId) })
  client.removeQueries({ queryKey: queryKeys.sla(reportId) })
  await Promise.all([
    client.invalidateQueries({ queryKey: ['reports'] }),
    client.invalidateQueries({ queryKey: queryKeys.metrics }),
  ])
}


export async function invalidateTicketEvent(client, event) {
  if (!event.reportId) {
    if (event.type === 'ticket_created') {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['reports'] }),
        client.invalidateQueries({ queryKey: queryKeys.metrics }),
      ])
    }
    return
  }
  await Promise.all([
    client.invalidateQueries({ queryKey: ['reports'] }),
    client.invalidateQueries({ queryKey: queryKeys.report(event.reportId) }),
    client.invalidateQueries({ queryKey: queryKeys.activity(event.reportId) }),
    client.invalidateQueries({ queryKey: queryKeys.sla(event.reportId) }),
    client.invalidateQueries({ queryKey: queryKeys.metrics }),
  ])
}
