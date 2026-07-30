import { PRIORITIES, SORT_ORDERS, STATUSES } from '@smartsupport/contracts'

export const DEFAULT_REPORT_FILTERS = {
  q: '',
  status: '',
  priority: '',
  technician: '',
  sort: 'recent',
  page: 1,
  pageSize: 12,
}

export function parseReportSearchParams(searchParams) {
  const status = searchParams.get('status') || ''
  const priority = searchParams.get('priority') || ''
  const sort = searchParams.get('sort') || 'recent'
  const page = Number.parseInt(searchParams.get('page') || '1', 10)

  return {
    q: (searchParams.get('q') || '').slice(0, 200),
    status: STATUSES.includes(status) ? status : '',
    priority: PRIORITIES.includes(priority) ? priority : '',
    technician: searchParams.get('technician') || '',
    sort: SORT_ORDERS.includes(sort) ? sort : 'recent',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: 12,
  }
}

export function updateReportSearchParams(current, changes) {
  const next = new URLSearchParams(current)
  Object.entries(changes).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined || (key === 'page' && value === 1)) {
      next.delete(key)
    } else {
      next.set(key, String(value))
    }
  })
  if (!Object.hasOwn(changes, 'page')) next.delete('page')
  return next
}
