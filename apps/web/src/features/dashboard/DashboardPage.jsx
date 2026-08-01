import { Link } from 'react-router-dom'
import { api } from '../../api/client.js'
import { useSession } from '../../app/session.jsx'
import { queryKeys, useApiQuery, useReports } from '../../api/queries.js'
import { ErrorState, LoadingState } from '../../components/ui/Feedback.jsx'
import { formatDate, formatTicket } from '../../utils/format.js'

export function DashboardPage() {
  const { user } = useSession()
  const metrics = useApiQuery(queryKeys.metrics, api.getMetrics, { enabled: user.role === 'ADMIN' })
  const reports = useReports({ sort: 'recent', page: 1, pageSize: user.role === 'ADMIN' ? 5 : 100 })
  if ((user.role === 'ADMIN' && metrics.isLoading) || reports.isLoading) return <LoadingState message="Preparando el dashboard…" />
  if ((user.role === 'ADMIN' && metrics.isError) || reports.isError) return <ErrorState error={metrics.error || reports.error} onRetry={() => { metrics.refetch(); reports.refetch() }} />
  const visible = reports.data.items
  const derived = {
    total: reports.data.total,
    pending: visible.filter((item) => item.status === 'Pendiente').length,
    inProgress: visible.filter((item) => item.status === 'En progreso').length,
    resolved: visible.filter((item) => item.status === 'Resuelto').length,
  }
  derived.resolutionRate = derived.total ? Math.round((derived.resolved / derived.total) * 100) : 0
  const data = metrics.data || derived

  return (
    <>
      <div className="page-heading"><div><span className="page-kicker">CENTRO DE OPERACIONES</span><h2>Resumen operativo</h2><p>Visión general del servicio técnico.</p></div>{user.role !== 'TECHNICIAN' && <Link className="btn btn--primary" to="/tickets/new">Nueva incidencia</Link>}</div>
      <section className="hero-summary">
        <div className="hero-summary__content"><span className="hero-summary__eyebrow"><i></i> ESTADO ACTUAL</span><h2>{data.pending ? `${data.pending} incidencias requieren seguimiento` : 'Todas las incidencias están atendidas'}</h2><p>La tasa global de resolución es de <strong>{data.resolutionRate}%</strong>.</p><div className="hero-summary__actions"><Link className="btn btn--hero" to="/tickets?status=Pendiente">Ver pendientes</Link></div></div>
        <div className="hero-summary__visual"><div className="resolution-ring" style={{ '--progress': `${data.resolutionRate * 3.6}deg` }}><div><strong>{data.resolutionRate}%</strong><span>resolución</span></div></div></div>
      </section>
      <div className="stats-grid">
        {[['Total de incidencias', data.total, ''], ['Pendientes', data.pending, 'Pendiente'], ['En progreso', data.inProgress, 'En progreso'], ['Resueltas', data.resolved, 'Resuelto']].map(([label, value, status], index) => (
          <Link key={label} className={`stat-card stat-card--${['total', 'pending', 'progress', 'resolved'][index]}`} to={status ? `/tickets?status=${encodeURIComponent(status)}` : '/tickets'}><span className="stat-label">{label}</span><div className="stat-card__value"><span className="stat-value">{value}</span></div></Link>
        ))}
      </div>
      <section className="workspace-card recent-activity"><header className="panel__header"><div className="panel__title"><h2>Tickets recientes</h2></div><Link to="/tickets">Ver todos →</Link></header><ul className="module-list">{reports.data.items.map((report) => <li className="module-list__item" key={report.id}><Link to={`/tickets/${report.id}`}><strong>{formatTicket(report.ticketNumber)} · {report.userName}</strong><span>{report.description}</span></Link><time dateTime={report.createdAt}>{formatDate(report.createdAt)}</time></li>)}</ul></section>
    </>
  )
}
