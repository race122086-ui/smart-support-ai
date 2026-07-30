export function calculateStats(reports) {
  return reports.reduce(
    (stats, report) => {
      stats.total += 1

      if (report.status === 'Pendiente') stats.pending += 1
      if (report.status === 'En progreso') stats.inProgress += 1
      if (report.status === 'Resuelto') stats.resolved += 1

      return stats
    },
    { total: 0, pending: 0, inProgress: 0, resolved: 0 }
  )
}

export function formatTicket(number) {
  return `INC-${String(number).padStart(4, '0')}`
}
