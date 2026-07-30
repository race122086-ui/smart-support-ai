import { PRIORITIES, SORT_ORDERS, STATUSES } from '@smartsupport/contracts'
import { useSearchParams } from 'react-router-dom'
import { api } from '../../../api/client.js'
import { queryKeys, useApiQuery, useReports } from '../../../api/queries.js'
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui/Feedback.jsx'
import { TicketCard } from '../components/TicketCard.jsx'
import { parseReportSearchParams, updateReportSearchParams } from '../search-params.js'

const sortLabels = { recent: 'Más recientes', oldest: 'Más antiguos', priority: 'Prioridad', deadline: 'Fecha límite' }

export function TicketsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseReportSearchParams(searchParams)
  const reports = useReports(filters)
  const technicians = useApiQuery(queryKeys.technicians, api.listTechnicians)

  function update(changes) {
    setSearchParams(updateReportSearchParams(searchParams, changes), { replace: true })
  }

  if (reports.isLoading) return <LoadingState message="Cargando tickets…" />
  if (reports.isError) return <ErrorState error={reports.error} onRetry={reports.refetch} />

  const pages = Math.max(1, Math.ceil(reports.data.total / filters.pageSize))
  return (
    <>
      <div className="page-heading"><div><span className="page-kicker">WORKSPACE</span><h2>Tickets de soporte</h2><p>Consulta, filtra y abre las solicitudes registradas.</p></div></div>
      <section className="panel">
        <header className="panel__header"><div className="panel__title"><h2>Incidencias</h2><span className="panel__count">{reports.data.total}</span></div></header>
        <div className="report-controls">
          <label className="search-box"><span className="sr-only">Buscar</span><input className="search-input" type="search" value={filters.q} onChange={(event) => update({ q: event.target.value })} placeholder="Buscar tickets…" /></label>
          <div className="filters">
            <label className="filter-group">Estado<select className="filter-select" value={filters.status} onChange={(event) => update({ status: event.target.value })}><option value="">Todos</option>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label className="filter-group">Prioridad<select className="filter-select" value={filters.priority} onChange={(event) => update({ priority: event.target.value })}><option value="">Todas</option>{PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
            <label className="filter-group">Técnico<select className="filter-select" value={filters.technician} onChange={(event) => update({ technician: event.target.value })}><option value="">Todos</option>{technicians.data?.map((technician) => <option key={technician.id} value={technician.name}>{technician.name}</option>)}</select></label>
            <label className="filter-group">Orden<select className="filter-select" value={filters.sort} onChange={(event) => update({ sort: event.target.value })}>{SORT_ORDERS.map((sort) => <option key={sort} value={sort}>{sortLabels[sort]}</option>)}</select></label>
          </div>
        </div>
        {reports.data.items.length ? <div className="reports-grid">{reports.data.items.map((report) => <TicketCard key={report.id} report={report} />)}</div> : <EmptyState title="Ningún reporte coincide con los filtros." description="Prueba con otros términos de búsqueda o criterios." />}
        {pages > 1 && <nav className="pagination" aria-label="Paginación"><button className="btn btn--secondary" type="button" disabled={filters.page === 1} onClick={() => update({ page: filters.page - 1 })}>Anterior</button><span>Página {filters.page} de {pages}</span><button className="btn btn--secondary" type="button" disabled={filters.page >= pages} onClick={() => update({ page: filters.page + 1 })}>Siguiente</button></nav>}
      </section>
    </>
  )
}
