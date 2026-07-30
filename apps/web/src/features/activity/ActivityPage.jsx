import { api } from '../../api/client.js'
import { useApiQuery } from '../../api/queries.js'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/Feedback.jsx'
import { formatDate, formatTicket } from '../../utils/format.js'

export function ActivityPage() {
  const reports = useApiQuery(['reports', 'all-activity'], () => api.listReports({ page: 1, pageSize: 100 }))
  if (reports.isLoading) return <LoadingState message="Cargando actividad…" />
  if (reports.isError) return <ErrorState error={reports.error} onRetry={reports.refetch} />
  const activity = reports.data.items.flatMap((report) => report.activity.map((entry) => ({ ...entry, report }))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return (
    <>
      <div className="page-heading"><div><span className="page-kicker">AUDITORÍA</span><h2>Actividad general</h2><p>Cambios y comentarios registrados en los tickets.</p></div></div>
      <section className="workspace-card">{activity.length ? <ol className="module-timeline">{activity.map((entry) => <li key={`${entry.report.id}-${entry.id}`}><span className="activity-avatar" aria-hidden="true">{entry.report.userName[0]}</span><div><strong>{formatTicket(entry.report.ticketNumber)} · {entry.report.userName}</strong><p>{entry.message}</p><time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time></div></li>)}</ol> : <EmptyState title="Sin actividad registrada." description="Los cambios y comentarios aparecerán aquí." />}</section>
    </>
  )
}
